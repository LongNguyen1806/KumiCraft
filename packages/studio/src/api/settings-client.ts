// User settings (SPEC-03 section 5.2): kept by the server in the user's config folder, so they hold
// for every project and every browser of this computer. There is no API key (V-108).
import {
  type AgentChoice,
  type Editor,
  EDITORS,
  type InterfaceLanguage,
  PACKAGE_MANAGERS,
  type PackageManager,
  type Settings,
  type SettingsPatch,
  SettingsSchema,
  type Theme,
  THEMES,
} from '@kumicraft/shared';

import { apiGet, apiPatch, parseResponse } from './http.ts';

export {
  type AgentChoice,
  type Editor,
  EDITORS,
  type InterfaceLanguage,
  PACKAGE_MANAGERS,
  type PackageManager,
  type Settings,
  type SettingsPatch,
  type Theme,
  THEMES,
};

export async function fetchSettings(): Promise<Settings> {
  return parseResponse(SettingsSchema, await apiGet('settings'));
}

export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return parseResponse(SettingsSchema, await apiPatch('settings', patch));
}
