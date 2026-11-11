// Loop notice while editing text on the Canvas (SPEC-04 M-TX, R-TX-07).
import { useTranslation } from 'react-i18next';

export function TextEditOverlay({ loopCount }: { readonly loopCount: number | undefined }) {
  const { t } = useTranslation();
  return (
    <>
      {loopCount !== undefined && (
        <div
          data-testid="text-edit-loop-banner"
          className="absolute top-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md border border-primary/30 bg-card-solid/95 px-3 h-6 text-xs font-medium text-primary shadow-soft backdrop-blur-md"
        >
          <span>{t('textEdit.loopBanner', { count: loopCount })}</span>
        </div>
      )}
    </>
  );
}
