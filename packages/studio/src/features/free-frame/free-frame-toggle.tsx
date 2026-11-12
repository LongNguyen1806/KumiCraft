import {
  type ElementRef,
  type ElementSource,
  isContainerTag,
  type TreeNode,
} from '@kumicraft/shared';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ErrorInfo, errorText } from '../../routes/error-text.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { requestFreeMeasure } from './free-context.ts';
import {
  executeDisableFreeFrame,
  executeEnableFreeFrame,
  executeRestoreFreeFrame,
} from './free-frame-ops.ts';
import { findFreeSnapshot, type FreeSnapshot, saveFreeSnapshot } from './free-frame-snapshot.ts';

/** Shown error: a server error code, or the measure timeout (R-FF-10). */
type ToggleError = ErrorInfo | 'measureTimeout';

/** What turning the frame off gave back (spec-log #126), shown under the switch of that frame. */
type RestoreNotice = { readonly loc: string; readonly restored: number; readonly kept: number };

function useEnableFreeFrame(
  source: ElementSource | undefined,
  primaryRef: ElementRef | undefined,
  setError: (e: ToggleError | undefined) => void,
) {
  const grid = useCanvasViewStore((s) => s.grid);
  const tailwindMajor = useCanvasViewStore((s) => s.tailwindMajor);
  const projectId = useCanvasViewStore((s) => s.currentProjectId);

  return useCallback(() => {
    if (!source || !primaryRef) return;
    setError(undefined);

    void (async () => {
      const payload = await requestFreeMeasure(primaryRef, () => {
        setError('measureTimeout');
      });
      if (!payload) return;

      const currentClassName = source.className.kind === 'static' ? source.className.value : '';

      setError(
        await executeEnableFreeFrame({
          loc: source.loc,
          tag: source.tag,
          currentClassName,
          grid,
          tailwindMajor,
          measurePayload: payload,
          remember:
            projectId === undefined
              ? undefined
              : (snapshot) => {
                  saveFreeSnapshot(projectId, snapshot);
                },
        }),
      );
    })();
  }, [source, primaryRef, grid, tailwindMajor, projectId, setError]);
}

/** Turns the frame off with its record and reports what came back (spec-log #126). */
async function restoreFrame(
  source: ElementSource,
  currentClassName: string,
  treeNodes: readonly TreeNode[],
  snapshot: FreeSnapshot,
  setError: (e: ToggleError | undefined) => void,
  setNotice: (notice: RestoreNotice | undefined) => void,
): Promise<void> {
  const res = await executeRestoreFreeFrame({
    loc: source.loc,
    tag: source.tag,
    currentClassName,
    treeNodes,
    snapshot,
  });
  setError(res.error);
  if (res.error === undefined)
    setNotice({ loc: source.loc, restored: res.restored, kept: res.kept });
}

function RestoredNotice({ notice }: { readonly notice: RestoreNotice }) {
  const { t } = useTranslation();
  return (
    <div role="status" data-testid="free-frame-restored" className="text-xs text-ink-soft">
      {notice.kept === 0
        ? t('freeFrame.restoredAll', { restored: notice.restored })
        : t('freeFrame.restoredSome', { restored: notice.restored, kept: notice.kept })}
    </div>
  );
}

function useDisableFreeFrame(
  source: ElementSource | undefined,
  setError: (e: ToggleError | undefined) => void,
  setNotice: (notice: RestoreNotice | undefined) => void,
) {
  const { t } = useTranslation();
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const projectId = useCanvasViewStore((s) => s.currentProjectId);

  return useCallback(() => {
    if (!source) return;
    setNotice(undefined);
    const currentClassName = source.className.kind === 'static' ? source.className.value : '';
    const snapshot =
      projectId === undefined
        ? undefined
        : findFreeSnapshot(projectId, source.loc, currentClassName);
    if (snapshot !== undefined) {
      // What turning it on replaced is known: give it back, no question (spec-log #126).
      setError(undefined);
      void restoreFrame(source, currentClassName, treeNodes, snapshot, setError, setNotice);
      return;
    }
    // Turned on before this was recorded: children can only go back to the flow.
    const confirmed = window.confirm(
      t(
        'freeFrame.confirmDisable',
        'Tắt khung tự do sẽ chuyển các phần tử con về luồng xếp thông thường. Tiếp tục?',
      ),
    );
    if (!confirmed) return;
    setError(undefined);

    void (async () => {
      setError(
        await executeDisableFreeFrame({
          loc: source.loc,
          tag: source.tag,
          currentClassName,
          treeNodes,
        }),
      );
    })();
  }, [source, treeNodes, projectId, setError, setNotice, t]);
}

function FreeFrameSwitch({
  isFree,
  onToggle,
}: {
  readonly isFree: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      id="free-frame-checkbox"
      role="switch"
      aria-checked={isFree}
      onClick={onToggle}
      data-testid="free-frame-toggle"
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        isFree ? 'bg-primary' : 'bg-line'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          isFree ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function FreeFrameToggle({ source }: { readonly source?: ElementSource | undefined }) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const [error, setError] = useState<ToggleError | undefined>(undefined);
  const [notice, setNotice] = useState<RestoreNotice>();

  const primaryRef = selectedRefs.length === 1 ? selectedRefs[0] : undefined;
  const isEligible =
    selectedRefs.length === 1 &&
    source !== undefined &&
    isContainerTag(source.tag) &&
    (source.className.kind === 'static' || source.className.kind === 'none');

  const handleEnable = useEnableFreeFrame(source, primaryRef, setError);
  const handleDisable = useDisableFreeFrame(source, setError, setNotice);

  if (!isEligible) return <></>;

  const isFree = source.free === true;

  return (
    <div
      className="flex flex-col gap-1 border-t border-line/60 pt-2"
      data-testid="free-frame-toggle-container"
    >
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-ink" htmlFor="free-frame-checkbox">
          {t('freeFrame.toggle', 'Khung tự do')}
        </label>
        <FreeFrameSwitch
          isFree={isFree}
          onToggle={() => {
            if (isFree) {
              handleDisable();
            } else {
              handleEnable();
            }
          }}
        />
      </div>
      {notice !== undefined && notice.loc === source.loc && !isFree && (
        <RestoredNotice notice={notice} />
      )}
      {error !== undefined && (
        <div role="alert" data-testid="free-frame-error" className="text-xs text-danger">
          {error === 'measureTimeout'
            ? t('freeFrame.measureTimeout')
            : errorText(tError, error.code, error.params)}
        </div>
      )}
    </div>
  );
}
