// "Open in editor" from anywhere in the Studio (R-SL-06): asks the server, which starts the editor of
// Settings at the exact position. A failure (editor not installed, E021) is kept to be shown.
import { useState } from 'react';

import { openInEditor } from '../../api/editor-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';

export type OpenInEditor = {
  readonly open: (loc: string) => void;
  readonly errorInfo: ErrorInfo | undefined;
  /** Error code of the last attempt, until the next one. */
  readonly errorCode: string | undefined;
};

export function useOpenInEditor(): OpenInEditor {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo>();
  const open = (loc: string) => {
    setErrorInfo(undefined);
    void (async () => {
      try {
        await openInEditor(loc);
      } catch (error) {
        setErrorInfo(toErrorInfo(error));
      }
    })();
  };
  return { open, errorInfo, errorCode: errorInfo?.code };
}
