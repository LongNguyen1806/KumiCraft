// "Open in editor" from anywhere in the Studio (R-SL-06): asks the server, which starts the editor of
// Settings at the exact position. A failure (editor not installed, E021) is kept to be shown.
import { useState } from 'react';

import { openInEditor } from '../../api/editor-client.ts';
import { ApiError } from '../../api/http.ts';

export type OpenInEditor = {
  readonly open: (loc: string) => void;
  /** Error code of the last attempt, until the next one. */
  readonly errorCode: string | undefined;
};

export function useOpenInEditor(): OpenInEditor {
  const [errorCode, setErrorCode] = useState<string>();
  const open = (loc: string) => {
    setErrorCode(undefined);
    void (async () => {
      try {
        await openInEditor(loc);
      } catch (error) {
        setErrorCode(error instanceof ApiError ? (error.code ?? String(error.status)) : 'network');
      }
    })();
  };
  return { open, errorCode };
}
