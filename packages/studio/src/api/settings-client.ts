// User settings (SPEC-03 section 10.2): kept by the server in the user's config folder, so they
// hold for every workspace and every browser of this computer. API keys never come back.
import { apiGet, apiPatch } from './http.ts';

export type InterfaceLanguage = 'vi' | 'en';

export type Settings = {
  /** Unset until the user picks one; the Studio then follows the browser (ADR-FE-16). */
  readonly language?: InterfaceLanguage;
  readonly export: { readonly typecheck: boolean; readonly buildCheck: boolean };
};

export type SettingsPatch = {
  readonly language?: InterfaceLanguage;
  readonly export?: { readonly typecheck?: boolean; readonly buildCheck?: boolean };
};

export async function fetchSettings(): Promise<Settings> {
  return (await apiGet('settings')) as Settings;
}

export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return (await apiPatch('settings', patch)) as Settings;
}
