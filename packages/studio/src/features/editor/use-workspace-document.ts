// Loads the Design Document into the Editor Store when the Editor opens.
import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../../api/http.ts';
import { fetchDocument } from '../../api/workspace-client.ts';
import { useEditorStore } from '../../store/editor-store.ts';

export type DocumentLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'ready' }
  | { readonly status: 'failed'; readonly code: string };

export function useWorkspaceDocument(): {
  readonly load: DocumentLoad;
  readonly retry: () => void;
} {
  const [load, setLoad] = useState<DocumentLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;
    const run = async () => {
      try {
        const { document, revision } = await fetchDocument();
        if (!isActive) return;
        useEditorStore.getState().loadDocument(document, revision);
        setLoad({ status: 'ready' });
      } catch (error) {
        const code = error instanceof ApiError ? (error.code ?? String(error.status)) : 'network';
        if (isActive) setLoad({ status: 'failed', code });
      }
    };
    void run();
    return () => {
      isActive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  return { load, retry };
}
