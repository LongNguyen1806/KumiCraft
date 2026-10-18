import { DEFAULT_DESIGN_DIRS, type DesignDirs } from '@reactcraft/shared';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { saveDesignDirs } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';

export type DesignDirsFormProps = {
  readonly designDirs?: DesignDirs | undefined;
  readonly onSaved?: ((updated: DesignDirs) => void) | undefined;
};

function useDesignDirsState(designDirs?: DesignDirs, onSaved?: (updated: DesignDirs) => void) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');

  const [pages, setPages] = useState(designDirs?.pages ?? DEFAULT_DESIGN_DIRS.pages);
  const [layouts, setLayouts] = useState(designDirs?.layouts ?? DEFAULT_DESIGN_DIRS.layouts);
  const [components, setComponents] = useState(
    designDirs?.components ?? DEFAULT_DESIGN_DIRS.components,
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [successMsg, setSuccessMsg] = useState<string | undefined>();

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(undefined);
    setSuccessMsg(undefined);
    try {
      const payload: DesignDirs = {
        pages: pages.trim(),
        layouts: layouts.trim(),
        components: components.trim(),
      };
      await saveDesignDirs(payload);
      setSuccessMsg(t('project.designDirs.saved'));
      onSaved?.(payload);
    } catch (err) {
      const info = toErrorInfo(err);
      setErrorMsg(errorText(tError, info.code, info.params));
    } finally {
      setBusy(false);
    }
  };

  return {
    pages,
    setPages,
    layouts,
    setLayouts,
    components,
    setComponents,
    busy,
    errorMsg,
    successMsg,
    handleSubmit,
  };
}

type DesignDirsInputsProps = {
  readonly state: ReturnType<typeof useDesignDirsState>;
};

function DesignDirsInputs({ state }: DesignDirsInputsProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-2">
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('project.designDirs.pages')}
        <input
          data-testid="design-dirs-pages"
          type="text"
          disabled={state.busy}
          value={state.pages}
          onChange={(e) => {
            state.setPages(e.target.value);
          }}
          className="rounded border border-border bg-field px-2 py-1 font-mono text-ink disabled:opacity-50"
        />
      </label>
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('project.designDirs.layouts')}
        <input
          data-testid="design-dirs-layouts"
          type="text"
          disabled={state.busy}
          value={state.layouts}
          onChange={(e) => {
            state.setLayouts(e.target.value);
          }}
          className="rounded border border-border bg-field px-2 py-1 font-mono text-ink disabled:opacity-50"
        />
      </label>
      <label className="flex flex-col gap-1 text-ink-soft">
        {t('project.designDirs.components')}
        <input
          data-testid="design-dirs-components"
          type="text"
          disabled={state.busy}
          value={state.components}
          onChange={(e) => {
            state.setComponents(e.target.value);
          }}
          className="rounded border border-border bg-field px-2 py-1 font-mono text-ink disabled:opacity-50"
        />
      </label>
    </div>
  );
}

export function DesignDirsForm({ designDirs, onSaved }: DesignDirsFormProps) {
  const { t } = useTranslation();
  const state = useDesignDirsState(designDirs, onSaved);

  return (
    <form
      onSubmit={(e) => {
        void state.handleSubmit(e);
      }}
      className="flex flex-col gap-2 rounded-lg border border-border bg-field/40 p-3 text-xs"
    >
      <div className="font-medium text-ink">{t('project.designDirs.title')}</div>
      <p className="text-[11px] text-ink-faint">{t('project.designDirs.hint')}</p>
      <DesignDirsInputs state={state} />
      {state.errorMsg !== undefined && (
        <div role="alert" className="text-xs text-rose-600">
          {state.errorMsg}
        </div>
      )}
      {state.successMsg !== undefined && (
        <div className="text-xs text-emerald-600 dark:text-emerald-400">{state.successMsg}</div>
      )}
      <button
        data-testid="design-dirs-save"
        type="submit"
        disabled={state.busy}
        className="self-end rounded-lg bg-charcoal px-3 py-1.5 text-xs text-on-charcoal disabled:opacity-50"
      >
        {t('project.designDirs.save')}
      </button>
    </form>
  );
}
