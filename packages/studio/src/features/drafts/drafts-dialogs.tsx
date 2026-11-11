// The New draft and Convert dialogs of the Drafts panel.
import type { DraftInfo } from '@kumicraft/shared';

import { NewDraftDialog } from './new-draft-dialog.tsx';
import { PromoteDraftDialog } from './promote-draft-dialog.tsx';

export function DraftsDialogs({
  newOpen,
  promoting,
  projectId,
  onReload,
  onCloseNew,
  onClosePromote,
}: {
  readonly newOpen: boolean;
  readonly promoting: DraftInfo | undefined;
  readonly projectId: string | undefined;
  readonly onReload: () => void;
  readonly onCloseNew: () => void;
  readonly onClosePromote: () => void;
}) {
  return (
    <>
      {newOpen && (
        <NewDraftDialog open projectId={projectId} onClose={onCloseNew} onCreated={onReload} />
      )}
      {promoting !== undefined && (
        <PromoteDraftDialog
          open={true}
          draft={promoting}
          projectId={projectId}
          onClose={onClosePromote}
          onPromoted={onReload}
        />
      )}
    </>
  );
}
