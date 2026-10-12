import { useTranslation } from 'react-i18next';

import { EditorShell } from '../features/editor/editor-shell.tsx';
import { useWorkspaceDocument } from '../features/editor/use-workspace-document.ts';
import { useEditorStore } from '../store/editor-store.ts';
import { errorText } from './error-text.ts';
import { LoadingScreen } from './loading-screen.tsx';

/** The document is missing although the session says the workspace is open. */
const LOAD_FAILED = 'E003';

/** State `open`: the Editor (SPEC-04.1 section 6.2); narrower than 1024 px, a notice (R-SH-02). */
export function EditorScreen() {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const { load, retry } = useWorkspaceDocument();
  const document = useEditorStore((state) => state.document);

  if (load.status === 'loading' || (load.status === 'ready' && document === undefined)) {
    return <LoadingScreen />;
  }
  if (load.status === 'failed' || document === undefined) {
    return (
      <main className="grid h-full place-items-center px-4">
        <div className="grid max-w-md gap-4 rounded-panel bg-card p-8 shadow-soft">
          <p role="alert" className="text-danger">
            {errorText(tError, load.status === 'failed' ? load.code : LOAD_FAILED)}
          </p>
          <button
            type="button"
            onClick={retry}
            className="h-10 justify-self-start rounded-full bg-charcoal px-5 text-on-charcoal"
          >
            {t('workspaceError.retry')}
          </button>
        </div>
      </main>
    );
  }
  return (
    <>
      <div className="h-full max-[1023px]:hidden">
        <EditorShell document={document} />
      </div>
      <main className="hidden h-full place-items-center px-4 max-[1023px]:grid">
        <div className="grid max-w-sm gap-3 rounded-panel bg-card p-7 shadow-soft">
          <h1 className="text-[22px] font-normal text-balance">{t('editor.narrow.title')}</h1>
          <p className="text-ink-soft">{t('editor.narrow.body')}</p>
        </div>
      </main>
    </>
  );
}
