// User configuration (ADR-BE-24, SPEC-03 section 5.2): `config.json` in the user's config folder.
// Holds the interface language, the editor and package manager the user prefers, the agent choice
// the trusted projects (S-82: never stored in the project, so a project cannot trust itself) and
// the projects opened recently (R-PJ-25).
// No API key, ever (V-108).
import { type RecentProject, RecentProjectsSchema } from '@kumicraft/shared';
import { z } from 'zod';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { TrustKey } from '../workspace/trust.ts';
import { isInside } from './paths.ts';
import { err, ok, type Result } from './result.ts';
import type { Platform } from './session.ts';

export const CONFIG_FILE = 'config.json';

export const EDITORS = ['vscode', 'cursor', 'webstorm', 'zed'] as const;
export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn'] as const;
export const AGENT_CHOICES = ['auto', 'agy', 'claude'] as const;

const LanguageSchema = z.enum(['vi', 'en']);
const EditorSchema = z.enum(EDITORS);
const PackageManagerSchema = z.enum(PACKAGE_MANAGERS);
const AgentChoiceSchema = z.enum(AGENT_CHOICES);

const TrustedProjectSchema = z.strictObject({
  id: z.string(),
  path: z.string(),
  links: z.string(),
});

/**
 * V-107: a plain object, so keys of 0.18 (`ai`, `export`, `trustedWorkspaces`) are dropped when
 * read instead of failing the whole file, and disappear at the next write.
 */
const UserConfigSchema = z.object({
  language: LanguageSchema.optional(),
  editor: EditorSchema.default('vscode'),
  packageManager: PackageManagerSchema.optional(),
  agent: z.object({ preferred: AgentChoiceSchema.default('auto') }).default({ preferred: 'auto' }),
  trustedProjects: z.array(TrustedProjectSchema).default([]),
  recentProjects: RecentProjectsSchema.default([]),
});
type UserConfig = z.infer<typeof UserConfigSchema>;

/** What the Studio sees (SPEC-03 section 5.2). */
export type Settings = {
  /** Unset until the user picks one; the Studio then follows the browser (ADR-FE-16). */
  readonly language?: 'vi' | 'en';
  readonly editor: (typeof EDITORS)[number];
  readonly packageManager?: (typeof PACKAGE_MANAGERS)[number];
  readonly agent: { readonly preferred: (typeof AGENT_CHOICES)[number] };
};

export const SettingsPatchSchema = z.strictObject({
  language: LanguageSchema.optional(),
  editor: EditorSchema.optional(),
  packageManager: PackageManagerSchema.optional(),
  agent: z.strictObject({ preferred: AgentChoiceSchema.optional() }).optional(),
});
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

export type ConfigStoreDeps = {
  readonly fs: FileSystemPort;
  /** The user's config folder (env-paths, or KUMICRAFT_CONFIG_DIR). */
  readonly dir: string;
  readonly platform: Platform;
  readonly logger: LoggerPort;
};

export type ConfigStore = {
  settings(): Settings;
  updateSettings(patch: SettingsPatch): Promise<Result<Settings>>;
  isTrusted(key: TrustKey): boolean;
  setTrusted(key: TrustKey, trusted: boolean): Promise<Result<void>>;
  /** R-PJ-25: projects opened before, newest first. */
  recentProjects(): readonly RecentProject[];
  rememberProject(path: string, name: string): Promise<Result<void>>;
};

export const MAX_RECENT_PROJECTS = 8;

const defaults = (): UserConfig => UserConfigSchema.parse({});

function merge(config: UserConfig, patch: SettingsPatch): UserConfig {
  return {
    ...config,
    ...(patch.language === undefined ? {} : { language: patch.language }),
    ...(patch.editor === undefined ? {} : { editor: patch.editor }),
    ...(patch.packageManager === undefined ? {} : { packageManager: patch.packageManager }),
    agent: { preferred: patch.agent?.preferred ?? config.agent.preferred },
  };
}

const toSettings = (config: UserConfig): Settings => ({
  ...(config.language === undefined ? {} : { language: config.language }),
  editor: config.editor,
  ...(config.packageManager === undefined ? {} : { packageManager: config.packageManager }),
  agent: { ...config.agent },
});

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
  /** Same project in the same folder, whatever its links. */
  const isSameProject = (entry: { id: string; path: string }, key: TrustKey) =>
    entry.id === key.id && samePath(entry.path, key.path);

  return {
    settings: () => toSettings(config),
    async updateSettings(patch) {
      const saved = await save(merge(config, patch));
      return saved.ok ? ok(toSettings(config)) : err(saved.error);
    },
    isTrusted: (key) =>
      config.trustedProjects.some(
        (entry) => isSameProject(entry, key) && entry.links === key.links,
      ),
    async setTrusted(key, trusted) {
      const others = config.trustedProjects.filter((entry) => !isSameProject(entry, key));
      const entry = { id: key.id, path: key.path, links: key.links };
      return save({ ...config, trustedProjects: trusted ? [...others, entry] : others });
    },
    recentProjects: () => config.recentProjects,
    async rememberProject(path, name) {
      const others = config.recentProjects.filter((entry) => !samePath(entry.path, path));
      const entry = { path, name, openedAt: new Date().toISOString() };
      return save({ ...config, recentProjects: [entry, ...others].slice(0, MAX_RECENT_PROJECTS) });
    },
  };
}
