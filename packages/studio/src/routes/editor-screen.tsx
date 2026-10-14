import { useTranslation } from 'react-i18next';

import { EditorShell } from '../features/editor/editor-shell.tsx';

type EditorScreenProps = {
  readonly projectId: string;
  readonly projectName: string;
  readonly trusted: boolean;
  /** Reads the session again once the project is trusted. */
  readonly onTrusted: () => void;
};

/** State `open`: the Editor; narrower than 1024 px, a notice instead. */
export function EditorScreen({ projectId, projectName, trusted, onTrusted }: EditorScreenProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="h-full max-[1023px]:hidden">
        <EditorShell
          projectId={projectId}
          projectName={projectName}
          trusted={trusted}
          onTrusted={onTrusted}
        />
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
