// Hint shown when an insert has no place in the designed file (R-CP-11, `design.selectInFile`).
import { useTranslation } from 'react-i18next';

import type { ErrorInfo } from '../../routes/error-text.ts';
import { useDesignStore } from './design-store.ts';

function textParam(info: ErrorInfo, key: string): string {
  const value = info.params?.[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Says why the selection cannot take the insert: it sits in a layout or component outside the
 * designed file. When that component is known, a button opens it so the insert goes there.
 */
export function SelectInFileHint({ info }: { readonly info: ErrorInfo }) {
  const { t } = useTranslation();
  const file = textParam(info, 'file');
  const foreignFile = textParam(info, 'foreignFile');
  const name = textParam(info, 'component');

  if (name === '' || foreignFile === '') {
    return <span data-testid="select-in-file-hint">{t('design.selectInFile', { file })}</span>;
  }
  return (
    <span data-testid="select-in-file-hint" className="flex flex-col items-start gap-1.5">
      <span>{t('design.selectInFileForeign', { name, foreignFile, file })}</span>
      <button
        type="button"
        data-testid="select-in-file-open"
        onClick={() => {
          useDesignStore
            .getState()
            .enterComponentMode({ componentName: name, filePath: foreignFile });
        }}
        className="cursor-pointer rounded border border-current/30 px-2 py-0.5 font-medium hover:bg-current/10"
      >
        {t('design.openForeign', { name })}
      </button>
    </span>
  );
}
