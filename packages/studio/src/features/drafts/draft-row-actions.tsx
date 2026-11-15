// The icon actions of a draft row: rename, duplicate, promote, delete (with tooltips).
import type { DraftInfo } from '@kumicraft/shared';
import { ArrowUpRight, Copy, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useEditMode } from '../project/use-edit-mode.ts';

const ROW_ICON =
  'grid size-7 place-items-center rounded-md text-ink-soft transition-colors hover:bg-field hover:text-ink disabled:pointer-events-none disabled:opacity-40';

type DraftRowActionsProps = {
  readonly draft: DraftInfo;
  readonly onStartRename: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onPromote: () => void;
};

/** Icon buttons with a tooltip: the row keeps room for the draft's name in a narrow panel. */
export function DraftRowActions({
  draft,
  onStartRename,
  onDuplicate,
  onDelete,
  onPromote,
}: DraftRowActionsProps) {
  const { t } = useTranslation();
  const editMode = useEditMode();
  if (editMode === 'viewOnly') return undefined;
  const actions = [
    { id: 'rename', label: t('drafts.rename'), Icon: Pencil, onClick: onStartRename },
    { id: 'duplicate', label: t('drafts.duplicate'), Icon: Copy, onClick: onDuplicate },
    { id: 'promote', label: t('drafts.promote'), Icon: ArrowUpRight, onClick: onPromote },
  ] as const;
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {actions.map(({ id, label, Icon, onClick }) => (
        <button
          key={id}
          type="button"
          data-testid={`draft-${id}-${draft.file}`}
          aria-label={label}
          title={label}
          onClick={onClick}
          className={ROW_ICON}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        data-testid={`draft-delete-${draft.file}`}
        aria-label={t('drafts.delete')}
        title={t('drafts.delete')}
        disabled={draft.inUse}
        onClick={onDelete}
        className={`${ROW_ICON} hover:bg-danger/10 hover:text-danger`}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
