// Settings of the Studio, shared by the Settings dialog and the language switch. Every change is
// applied at once and saved to the server; a failed save puts the previous value back.
import i18next from 'i18next';
import { create } from 'zustand';

import {
  fetchSettings,
  type InterfaceLanguage,
  type Settings,
  type SettingsPatch,
  updateSettings,
} from '../api/settings-client.ts';
import { type ErrorInfo, toErrorInfo } from '../routes/error-text.ts';

export type SaveState =
  | { readonly status: 'idle' | 'saving' | 'saved' }
  | { readonly status: 'failed'; readonly info: ErrorInfo; readonly code: string };

export type SettingsState = {
  readonly settings: Settings | undefined;
  readonly save: SaveState;
  /** Reads the settings and applies the saved interface language, if any. */
  readonly load: () => Promise<void>;
  readonly update: (patch: SettingsPatch) => Promise<void>;
  /** Switches the interface at once (no reload, ADR-FE-16) and remembers the choice. */
  readonly setLanguage: (language: InterfaceLanguage) => Promise<void>;
};

function merge(settings: Settings | undefined, patch: SettingsPatch): Settings | undefined {
  if (settings === undefined) return undefined;
  return {
    ...settings,
    ...(patch.language === undefined ? {} : { language: patch.language }),
    ...(patch.editor === undefined ? {} : { editor: patch.editor }),
    ...(patch.packageManager === undefined ? {} : { packageManager: patch.packageManager }),
    agent: { preferred: patch.agent?.preferred ?? settings.agent.preferred },
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: undefined,
  save: { status: 'idle' },
  load: async () => {
    try {
      const settings = await fetchSettings();
      set({ settings });
      if (settings.language !== undefined && settings.language !== i18next.resolvedLanguage) {
        await i18next.changeLanguage(settings.language);
      }
    } catch {
      // Without settings the Studio keeps the browser language and the defaults.
    }
  },
  update: async (patch) => {
    const before = get().settings;
    set({ settings: merge(before, patch), save: { status: 'saving' } });
    try {
      set({ settings: await updateSettings(patch), save: { status: 'saved' } });
    } catch (error) {
      const info = toErrorInfo(error);
      set({ settings: before, save: { status: 'failed', info, code: info.code } });
    }
  },
  setLanguage: async (language) => {
    await i18next.changeLanguage(language);
    await get().update({ language });
  },
}));
