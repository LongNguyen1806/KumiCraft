// "Dev port" of the Canvas (SPEC-04 R-RN-27): empty reads the project's own port (R-RN-04), a
// number makes the Canvas run there. Saving restarts the dev server.
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { saveDevPort } from '../../api/project-client.ts';
import { restartRunner } from '../../api/runner-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';

function parsePort(text: string): number | 'auto' | undefined {
  if (text === '') return 'auto';
  const port = Number(text);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : undefined;
}

function useDevPortSave(devPort: number | undefined) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const [value, setValue] = useState(devPort === undefined ? '' : String(devPort));
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>();

  const save = async (e: SyntheticEvent) => {
    e.preventDefault();
    const port = parsePort(value.trim());
    if (port === undefined) {
      setErrorMsg(t('project.devPort.invalid'));
      return;
    }
    setBusy(true);
    setErrorMsg(undefined);
    try {
      await saveDevPort(port);
      await restartRunner();
    } catch (err) {
      const info = toErrorInfo(err);
      setErrorMsg(errorText(tError, info.code, info.params));
    } finally {
      setBusy(false);
    }
  };

  return { value, setValue, busy, errorMsg, save };
}

export function DevPortForm({ devPort }: { readonly devPort?: number | undefined }) {
  const { t } = useTranslation();
  const { value, setValue, busy, errorMsg, save } = useDevPortSave(devPort);

  return (
    <form
      onSubmit={(e) => {
        void save(e);
      }}
      className="flex flex-col gap-2 rounded-lg border border-border bg-field/40 p-3"
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        {t('project.devPort.title')}
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          placeholder={t('project.devPort.placeholder')}
          className="w-64 rounded border border-border bg-field px-2.5 py-1.5 font-mono text-xs text-ink focus:outline-none"
          data-testid="dev-port-input"
        />
      </label>
      <p className="text-xs text-ink-soft">{t('project.devPort.hint')}</p>
      {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}
      <button
        type="submit"
        disabled={busy}
        className="self-end rounded-lg bg-charcoal px-3 py-1.5 text-xs text-on-charcoal disabled:opacity-50"
        data-testid="dev-port-save"
      >
        {t('project.devPort.save')}
      </button>
    </form>
  );
}
