import { type ElementRef, type ElementSource, isContainerTag } from '@reactcraft/shared';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ErrorInfo, errorText } from '../../routes/error-text.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { executeDisableFreeFrame, executeEnableFreeFrame } from './free-frame-ops.ts';

/** Shown error: a server error code, or the measure timeout (R-FF-10). */
type ToggleError = ErrorInfo | 'measureTimeout';

const MEASURE_TIMEOUT_MS = 2000;

function useEnableFreeFrame(
  source: ElementSource | undefined,
  primaryRef: ElementRef | undefined,
  setError: (e: ToggleError | undefined) => void,
) {
  const bridgeChannel = useBridgeChannel();
  const grid = useCanvasViewStore((s) => s.grid);
  const tailwindMajor = useCanvasViewStore((s) => s.tailwindMajor);

  return useCallback(() => {
    if (!source || !primaryRef) return;
    setError(undefined);

    const cleanup: { unregister?: () => void } = {};
    const timer = setTimeout(() => {
      cleanup.unregister?.();
      setError('measureTimeout');
    }, MEASURE_TIMEOUT_MS);

    cleanup.unregister = bridgeChannel.registerFreeFrameListener({
      onFreeMeasure: (payload) => {
        if (payload.ref.loc !== source.loc) return;
        clearTimeout(timer);
        cleanup.unregister?.();

        const currentClassName = source.className.kind === 'static' ? source.className.value : '';

        void (async () => {
          setError(
            await executeEnableFreeFrame({
              loc: source.loc,
              tag: source.tag,
              currentClassName,
              grid,
              tailwindMajor,
              measurePayload: payload,
            }),
          );
        })();
      },
    });

    bridgeChannel.measureFree(primaryRef);
  }, [source, primaryRef, bridgeChannel, grid, tailwindMajor, setError]);
}

function useDisableFreeFrame(
  source: ElementSource | undefined,
  setError: (e: ToggleError | undefined) => void,
) {
  const { t } = useTranslation();
  const treeNodes = useSelectionStore((s) => s.treeNodes);

  return useCallback(() => {
    if (!source) return;
    const confirmed = window.confirm(
      t(
        'freeFrame.confirmDisable',
        'Tắt khung tự do sẽ chuyển các phần tử con về luồng xếp thông thường. Tiếp tục?',
      ),
    );
    if (!confirmed) return;
    setError(undefined);

    const currentClassName = source.className.kind === 'static' ? source.className.value : '';

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
  }, [source, treeNodes, setError, t]);
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

  const primaryRef = selectedRefs.length === 1 ? selectedRefs[0] : undefined;
  const isEligible =
    selectedRefs.length === 1 &&
    source !== undefined &&
    isContainerTag(source.tag) &&
    (source.className.kind === 'static' || source.className.kind === 'none');

  const handleEnable = useEnableFreeFrame(source, primaryRef, setError);
  const handleDisable = useDisableFreeFrame(source, setError);

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
