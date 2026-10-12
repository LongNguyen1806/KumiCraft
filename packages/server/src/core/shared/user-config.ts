// User configuration (ADR-BE-24, SPEC-03 section 10.2): `config.json` in the user's config folder.
// Holds the interface language, export options, AI choices and the trusted workspaces (SPEC-05
// S-82: never stored in the workspace, so a workspace cannot trust itself). API keys never leave
// the server: Settings only says whether a key is configured.
import { z } from 'zod';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { TrustKey } from '../workspace/trust.ts';
import { isInside } from './paths.ts';
import { err, ok, type Result } from './result.ts';
import type { Platform } from './session.ts';

export const CONFIG_FILE = 'config.json';
export const AI_PROVIDERS = ['openai', 'anthropic', 'deepseek', 'ollama'] as const;
export type AIProviderName = (typeof AI_PROVIDERS)[number];

/** Environment variables that win over a stored key (ADR-BE-24). */
const KEY_ENV: Readonly<Record<AIProviderName, string | undefined>> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  ollama: undefined,
};

const LanguageSchema = z.enum(['vi', 'en']);
const ProviderSchema = z.enum(AI_PROVIDERS);

const UserConfigSchema = z.strictObject({
  language: LanguageSchema.optional(),
  ai: z
    .strictObject({
      provider: ProviderSchema.optional(),
      model: z.string().min(1).max(200).optional(),
      ollamaBaseUrl: z.url().default('http://127.0.0.1:11434'),
      keys: z.partialRecord(ProviderSchema, z.string().min(1)).default({}),
    })
    .default({ ollamaBaseUrl: 'http://127.0.0.1:11434', keys: {} }),
  export: z
    .strictObject({ typecheck: z.boolean().default(true), buildCheck: z.boolean().default(false) })
    .default({ typecheck: true, buildCheck: false }),
  trustedWorkspaces: z
    .array(z.strictObject({ id: z.string(), path: z.string(), links: z.string().default('') }))
    .default([]),
});
type UserConfig = z.infer<typeof UserConfigSchema>;

/** What the Studio sees (SPEC-03 section 10.2). No key value is ever included. */
export type Settings = {
  /** Unset until the user picks one; the Studio then follows the browser (ADR-FE-16). */
  readonly language?: 'vi' | 'en';
  readonly ai: {
    readonly provider?: AIProviderName;
    readonly model?: string;
    readonly ollamaBaseUrl: string;
    readonly keys: Readonly<Record<AIProviderName, 'configured' | 'missing' | 'fromEnv'>>;
  };
  readonly export: { readonly typecheck: boolean; readonly buildCheck: boolean };
};

export const SettingsPatchSchema = z.strictObject({
  language: LanguageSchema.optional(),
  ai: z
    .strictObject({
      provider: ProviderSchema.optional(),
      model: z.string().min(1).max(200).optional(),
      ollamaBaseUrl: z.url().optional(),
    })
    .optional(),
  export: z
    .strictObject({ typecheck: z.boolean().optional(), buildCheck: z.boolean().optional() })
    .optional(),
});
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

export type ConfigStoreDeps = {
  readonly fs: FileSystemPort;
  /** The user's config folder (env-paths). */
  readonly dir: string;
  readonly platform: Platform;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly logger: LoggerPort;
};

export type ConfigStore = {
  settings(): Settings;
  updateSettings(patch: SettingsPatch): Promise<Result<Settings>>;
  isTrusted(key: TrustKey): boolean;
  setTrusted(key: TrustKey, trusted: boolean): Promise<Result<void>>;
};

const defaults = (): UserConfig => UserConfigSchema.parse({});

/** Keeps only the fields that a patch actually sets. */
type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

const definedOnly = <T extends object>(value: T | undefined): Defined<T> =>
  Object.fromEntries(
    Object.entries(value ?? {}).filter(([, item]) => item !== undefined),
  ) as Defined<T>;

function merge(config: UserConfig, patch: SettingsPatch): UserConfig {
  return {
    ...config,
    ...(patch.language === undefined ? {} : { language: patch.language }),
    ai: { ...config.ai, ...definedOnly(patch.ai) },
    export: { ...config.export, ...definedOnly(patch.export) },
  };
}

function toSettings(config: UserConfig, env: ConfigStoreDeps['env']): Settings {
  const keyStatus = (provider: AIProviderName) => {
    const variable = KEY_ENV[provider];
    if (variable !== undefined && (env[variable] ?? '') !== '') return 'fromEnv' as const;
    return config.ai.keys[provider] === undefined ? ('missing' as const) : ('configured' as const);
  };
  return {
    ...(config.language === undefined ? {} : { language: config.language }),
    ai: {
      ...(config.ai.provider === undefined ? {} : { provider: config.ai.provider }),
      ...(config.ai.model === undefined ? {} : { model: config.ai.model }),
      ollamaBaseUrl: config.ai.ollamaBaseUrl,
      keys: Object.fromEntries(
        AI_PROVIDERS.map((provider) => [provider, keyStatus(provider)]),
      ) as Settings['ai']['keys'],
    },
    export: { ...config.export },
  };
}

/** A missing or broken `config.json` falls back to defaults, with a warning. */
async function loadConfig(deps: ConfigStoreDeps): Promise<UserConfig> {
  const read = await deps.fs.readText(deps.dir, CONFIG_FILE, { maxBytes: 1024 * 1024 });
  if (!read.ok) {
    if (read.error.code !== 'E015') {
      deps.logger.warn({ file: CONFIG_FILE, code: read.error.code }, 'user config unreadable');
    }
    return defaults();
  }
  try {
    return UserConfigSchema.parse(JSON.parse(read.value));
  } catch {
    deps.logger.warn({ file: CONFIG_FILE }, 'user config is invalid; using defaults');
    return defaults();
  }
}

export async function createConfigStore(deps: ConfigStoreDeps): Promise<ConfigStore> {
  let config = await loadConfig(deps);
  const save = async (next: UserConfig): Promise<Result<void>> => {
    const text = `${JSON.stringify(next, undefined, 2)}\n`;
    const written = await deps.fs.writeTextAtomic(deps.dir, CONFIG_FILE, text, { mode: 0o600 });
    if (written.ok) config = next;
    return written;
  };
  const samePath = (a: string, b: string) =>
    isInside(a, b, deps.platform) && isInside(b, a, deps.platform);
  /** Same workspace in the same folder, whatever its links. */
  const isSameWorkspace = (entry: { id: string; path: string }, key: TrustKey) =>
    entry.id === key.id && samePath(entry.path, key.path);

  return {
    settings: () => toSettings(config, deps.env),
    async updateSettings(patch) {
      const saved = await save(merge(config, patch));
      return saved.ok ? ok(toSettings(config, deps.env)) : err(saved.error);
    },
    isTrusted: (key) =>
      config.trustedWorkspaces.some(
        (entry) => isSameWorkspace(entry, key) && entry.links === key.links,
      ),
    async setTrusted(key, trusted) {
      const others = config.trustedWorkspaces.filter((entry) => !isSameWorkspace(entry, key));
      const entry = { id: key.id, path: key.path, links: key.links };
      return save({ ...config, trustedWorkspaces: trusted ? [...others, entry] : others });
    },
  };
}
