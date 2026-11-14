// Structure actions as an icon row (Move, Wrap, Unwrap, Duplicate, Extract, Remove) in the Inspector header (SPEC-04 R-SE-24..28, R-CP-14).
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp, Component, Copy, Eye, Trash2, Ungroup } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText } from '../../../routes/error-text.ts';
import { ExtractDialog } from '../../components-panel/extract-dialog.tsx';
import { studioBridgeChannel } from '../../selection/bridge-channel.ts';
import type { InspectorTarget } from '../types.ts';
import { InspectorListActions } from './inspector-list-actions.tsx';
import { RepeatElementControl } from './repeat-element-control.tsx';

const INTERACTIVE_PREVIEW_TAGS = new Set([
  'details',
  'summary',
  'Modal',
  'Drawer',
  'Dropdown',
  'MobileMenu',
  'Tooltip',
  'Dialog',
  'DialogTrigger',
  'Sheet',
  'SheetTrigger',
  'DropdownMenu',
]);

const KIT_PREVIEW_FILE_RE =
  /(?:^|\/)kumicraft\/(?:Modal|Drawer|Dropdown|MobileMenu|Tooltip)\.(?:tsx|jsx):/;

function isInteractivePreviewTarget(source: ElementTarget['source']): boolean {
  if (source === undefined) return false;
  return INTERACTIVE_PREVIEW_TAGS.has(source.tag) || KIT_PREVIEW_FILE_RE.test(source.loc);
}

function InteractivePreviewButton({ target }: { readonly target: ElementTarget }) {
  const { t } = useTranslation();
  if (!isInteractivePreviewTarget(target.source)) return undefined;
  return (
    <button
      type="button"
      data-testid="inspector-preview-interactive"
      onClick={() => {
        studioBridgeChannel.toggleInteractive(target.ref);
      }}
      className="border-line bg-field text-ink-soft hover:border-border hover:text-ink inline-flex h-6 cursor-pointer items-center gap-1 self-start rounded border px-2 text-[11px]"
    >
      <Eye className="size-3" aria-hidden="true" />
      <span>{t('inspector.previewInteractive')}</span>
    </button>
  );
}
import { useStructureActions } from './use-structure-actions.ts';
import { WrapMenu } from './wrap-menu.tsx';

type ElementTarget = Extract<InspectorTarget, { readonly kind: 'element' }>;
type Actions = ReturnType<typeof useStructureActions>;

type StructureActionsProps = {
  readonly target: ElementTarget;
};

const ICON_BUTTON =
  'grid size-7 shrink-0 place-items-center rounded-md text-ink-soft transition-colors hover:bg-field hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent';

function IconAction({
  testId,
  label,
  icon: Icon,
  disabled,
  danger = false,
  onClick,
}: {
  readonly testId: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly disabled: boolean;
  readonly danger?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={danger ? `${ICON_BUTTON} hover:bg-danger/10 hover:text-danger` : ICON_BUTTON}
    >
      <Icon className="size-[15px]" aria-hidden />
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-line" />;
}

function MoveAndWrap({
  off,
  actions,
  canUnwrap,
}: {
  readonly off: boolean;
  readonly actions: Actions;
  readonly canUnwrap: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <IconAction
        testId="inspector-move-up"
        label={t('inspector.moveUp')}
        icon={ArrowUp}
        disabled={off || actions.moveUpTarget === undefined}
        onClick={() => void actions.runMove('up')}
      />
      <IconAction
        testId="inspector-move-down"
        label={t('inspector.moveDown')}
        icon={ArrowDown}
        disabled={off || actions.moveDownTarget === undefined}
        onClick={() => void actions.runMove('down')}
      />
      <Divider />
      <WrapMenu disabled={off} onWrap={(wrapper) => void actions.runWrap(wrapper)} />
      <IconAction
        testId="inspector-unwrap"
        label={t('inspector.unwrap')}
        icon={Ungroup}
        disabled={off || !canUnwrap}
        onClick={() => void actions.runUnwrap()}
      />
    </>
  );
}

function ActionRow({
  target,
  actions,
  onExtract,
}: {
  readonly target: ElementTarget;
  readonly actions: Actions;
  readonly onExtract: () => void;
}) {
  const { t } = useTranslation();
  const tag = target.source?.tag;
  const isUppercaseTag = tag !== undefined && /^[A-Z]/.test(tag);
  const off =
    actions.pending || target.loading || tag === undefined || target.source?.readonly !== undefined;

  return (
    <div className="flex items-center gap-0.5">
      <MoveAndWrap off={off} actions={actions} canUnwrap={!isUppercaseTag} />
      <IconAction
        testId="inspector-duplicate"
        label={t('inspector.duplicate')}
        icon={Copy}
        disabled={off}
        onClick={() => void actions.runDuplicate()}
      />
      <IconAction
        testId="structure-extract"
        label={t('inspector.extract')}
        icon={Component}
        disabled={off}
        onClick={onExtract}
      />
      <span className="ml-auto flex items-center">
        <Divider />
        <IconAction
          testId="inspector-remove"
          label={t('inspector.remove')}
          icon={Trash2}
          disabled={off}
          danger
          onClick={() => void actions.runRemove()}
        />
      </span>
    </div>
  );
}

export function StructureActions({ target }: StructureActionsProps) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const actions = useStructureActions(target);
  const [extractOpen, setExtractOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <ActionRow
        target={target}
        actions={actions}
        onExtract={() => {
          setExtractOpen(true);
        }}
      />
      <InspectorListActions
        target={target}
        disabled={actions.pending || target.loading || target.source?.readonly !== undefined}
      />
      <RepeatElementControl target={target} />
      <InteractivePreviewButton target={target} />
      {extractOpen && (
        <ExtractDialog
          open={extractOpen}
          target={target}
          onClose={() => {
            setExtractOpen(false);
          }}
        />
      )}
      {actions.errorInfo !== undefined && (
        <p role="alert" className="text-xs text-danger" data-testid="structure-action-error">
          {errorText(tError, actions.errorInfo.code, actions.errorInfo.params)}
        </p>
      )}
      {actions.warnings.length > 0 && (
        <div
          className="flex flex-col gap-1 text-xs text-warn"
          data-testid="structure-action-warnings"
        >
          {actions.warnings.map((w) => (
            <span key={w}>{t(`inspector.warning.${w}`, { defaultValue: w })}</span>
          ))}
        </div>
      )}
    </div>
  );
}
