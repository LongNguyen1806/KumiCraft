// User settings (SPEC-03 section 5.2): kept by the server in the user's config folder, so they hold
// for every project and every browser of this computer. There is no API key (V-108).
import { apiGet, apiPatch } from './http.ts';

export type InterfaceLanguage = 'vi' | 'en';
export const EDITORS = ['vscode', 'cursor', 'webstorm', 'zed'] as const;
export type Editor = (typeof EDITORS)[number];
export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn'] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];
export type AgentChoice = 'auto' | 'agy' | 'claude';

export type Settings = {
  /** Unset until the user picks one; the Studio then follows the browser (ADR-FE-16). */
  readonly language?: InterfaceLanguage;
  readonly editor: Editor;
  readonly packageManager?: PackageManager;
  readonly agent: { readonly preferred: AgentChoice };
};

export type SettingsPatch = {
  readonly language?: InterfaceLanguage;
  readonly editor?: Editor;
  readonly packageManager?: PackageManager;
  readonly agent?: { readonly preferred?: AgentChoice };
};

export async function fetchSettings(): Promise<Settings> {
  return (await apiGet('settings')) as Settings;
}

export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return (await apiPatch('settings', patch)) as Settings;
}
