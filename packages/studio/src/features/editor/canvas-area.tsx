import { useTranslation } from 'react-i18next';

/**
 * The dotted mat where the running project shows (ADR-FE-04). The iframe on the dev server of the
 * project comes with M-RN (WP-1.04); until then the mat says what will appear here.
 */
export function CanvasArea() {
  const { t } = useTranslation();
  return (
    <main
      aria-label={t('editor.canvas')}
      data-testid="editor"
      className="relative grid min-h-0 min-w-0 place-items-center overflow-auto rounded-panel bg-card-solid/35 bg-[radial-gradient(rgb(60_52_30/0.14)_1px,transparent_1px)] bg-size-[18px_18px]"
    >
      <p className="max-w-sm px-6 text-center text-ink-soft" data-testid="canvas-placeholder">
        {t('editor.canvasPending')}
      </p>
    </main>
  );
}
