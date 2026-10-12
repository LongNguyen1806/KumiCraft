// Recovery of a workspace in `error` (SPEC-04.1 section 2.3, R-WS-02): restore the latest backup
// of a broken file, or read the files again after fixing them by hand.
import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../../api/http.ts';
import {
  type BackupSummary,
  fetchBackups,
  reloadWorkspace,
  restoreBackup,
} from '../../api/workspace-client.ts';

export type Recovery = {
  /** Newest backup of a file, if there is one. */
  readonly latestBackup: (file: string) => BackupSummary | undefined;
  readonly isBusy: boolean;
  /** Error code of the last failed action. */
  readonly failedCode: string | undefined;
  readonly restore: (backup: BackupSummary) => void;
  readonly retry: () => void;
};

const codeOf = (error: unknown): string =>
  error instanceof ApiError ? (error.code ?? String(error.status)) : 'network';

/** `onChanged` runs after every action, so the Studio reads its session again. */
export function useRecovery(onChanged: () => void): Recovery {
  const [backups, setBackups] = useState<readonly BackupSummary[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [failedCode, setFailedCode] = useState<string>();

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const list = await fetchBackups();
        if (isActive) setBackups(list);
      } catch {
        // Without the list there is simply no restore button; "Try again" still works.
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, []);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setIsBusy(true);
      setFailedCode(undefined);
      try {
        await action();
        onChanged();
      } catch (error) {
        setFailedCode(codeOf(error));
      } finally {
        setIsBusy(false);
      }
    },
    [onChanged],
  );

  return {
    latestBackup: (file) => backups.find((backup) => backup.file === file),
    isBusy,
    failedCode,
    restore: (backup) => {
      void run(() => restoreBackup(backup.id));
    },
    retry: () => {
      void run(reloadWorkspace);
    },
  };
}
