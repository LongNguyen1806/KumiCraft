// Free frame inspector section with X/Y/W/H, layer order, align and distribute (SPEC-04 section 18E, WP-2.12b).
import type { ElementRef, ElementSource } from '@reactcraft/shared';
import { applyPlacement, applySize, readClassPx } from '@reactcraft/shared';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { editSource } from '../../api/source-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { type AlignMode, runAlign, useFreeFrameErrorStore } from './align.ts';
import { freeFrameOfRef } from './free-context.ts';
import { type LayerOrderCommand, layerOrderTarget, runLayerOrder } from './layer-order.ts';

type OrderKey = 'freeFrame.front' | 'freeFrame.forward' | 'freeFrame.backward' | 'freeFrame.back';
const ORDER_BTNS: readonly (readonly [LayerOrderCommand, string, OrderKey, string])[] = [
  ['front', 'layer-order-front', 'freeFrame.front', '⤉'],
  ['forward', 'layer-order-forward', 'freeFrame.forward', '↑'],
  ['backward', 'layer-order-backward', 'freeFrame.backward', '↓'],
  ['back', 'layer-order-back', 'freeFrame.back', '⤈'],
];

type AlignKey =
  | 'freeFrame.alignLeft'
  | 'freeFrame.alignCenterX'
  | 'freeFrame.alignRight'
  | 'freeFrame.alignTop'
  | 'freeFrame.alignCenterY'
  | 'freeFrame.alignBottom';
const ALIGN_BTNS: readonly (readonly [AlignMode, string, AlignKey, string])[] = [
  ['left', 'align-left', 'freeFrame.alignLeft', '⇤'],
  ['centerX', 'align-center-x', 'freeFrame.alignCenterX', '⇥⇤'],
  ['right', 'align-right', 'freeFrame.alignRight', '⇥'],
  ['top', 'align-top', 'freeFrame.alignTop', '⤒'],
  ['centerY', 'align-center-y', 'freeFrame.alignCenterY', '⤓⤒'],
  ['bottom', 'align-bottom', 'freeFrame.alignBottom', '⤓'],
];

type DistKey = 'freeFrame.distributeX' | 'freeFrame.distributeY';
const DIST_BTNS: readonly (readonly ['distributeX' | 'distributeY', string, DistKey])[] = [
  ['distributeX', 'distribute-x', 'freeFrame.distributeX'],
  ['distributeY', 'distribute-y', 'freeFrame.distributeY'],
];

type PosKey = 'freeFrame.x' | 'freeFrame.y' | 'freeFrame.w' | 'freeFrame.h';
const POS_FIELDS: readonly (readonly ['x' | 'y' | 'w' | 'h', string, PosKey, boolean])[] = [
  ['x', 'free-pos-x', 'freeFrame.x', false],
  ['y', 'free-pos-y', 'freeFrame.y', false],
  ['w', 'free-pos-w', 'freeFrame.w', true],
  ['h', 'free-pos-h', 'freeFrame.h', true],
];

function usePositionState(staticClass: string, key: string) {
  const inits = {
    x: readClassPx(staticClass, 'left'),
    y: readClassPx(staticClass, 'top'),
    w: readClassPx(staticClass, 'width'),
    h: readClassPx(staticClass, 'height'),
  };

  const [prevKey, setPrevKey] = useState(key);
  const [prevClass, setPrevClass] = useState(staticClass);
  const [x, setX] = useState<string>(inits.x !== undefined ? String(inits.x) : '');
  const [y, setY] = useState<string>(inits.y !== undefined ? String(inits.y) : '');
  const [w, setW] = useState<string>(inits.w !== undefined ? String(inits.w) : '');
  const [h, setH] = useState<string>(inits.h !== undefined ? String(inits.h) : '');

  if (prevKey !== key || prevClass !== staticClass) {
    setPrevKey(key);
    setPrevClass(staticClass);
    setX(inits.x !== undefined ? String(inits.x) : '');
    setY(inits.y !== undefined ? String(inits.y) : '');
    setW(inits.w !== undefined ? String(inits.w) : '');
    setH(inits.h !== undefined ? String(inits.h) : '');
  }

  return { vals: { x, y, w, h }, setters: { x: setX, y: setY, w: setW, h: setH }, inits };
}

function commitPosition(
  prop: 'x' | 'y' | 'w' | 'h',
  val: string,
  staticClass: string,
  loc: string,
  tag: string,
  inits: { readonly x?: number | undefined; readonly y?: number | undefined },
  tailwindMajor: 3 | 4,
) {
  const parsed = Number(val.trim());
  if (val.trim() === '' || Number.isNaN(parsed) || parsed < 0) return;

  const after =
    prop === 'x' || prop === 'y'
      ? applyPlacement(
          staticClass,
          {
            kind: 'free',
            left: prop === 'x' ? parsed : (inits.x ?? 0),
            top: prop === 'y' ? parsed : (inits.y ?? 0),
          },
          tailwindMajor,
        )
      : applySize(
          staticClass,
          prop === 'w' ? { width: parsed } : { height: parsed },
          tailwindMajor,
        );

  if (after === staticClass) return;
  editSource({ edit: { kind: 'setClassName', loc, tag, before: staticClass, after } }).catch(
    (e: unknown) => {
      useFreeFrameErrorStore.getState().setError(toErrorInfo(e));
    },
  );
}

function FreeFramePosInput({
  id,
  label,
  val,
  placeholder,
  disabled,
  onChange,
  onCommit,
  onReset,
}: {
  readonly id: string;
  readonly label: string;
  readonly val: string;
  readonly placeholder?: string | undefined;
  readonly disabled: boolean;
  readonly onChange: (v: string) => void;
  readonly onCommit: () => void;
  readonly onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] text-ink-faint w-3 text-right">{label}</span>
      <input
        type="text"
        data-testid={id}
        value={val}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            // Blur commits, so Enter followed by leaving the field writes once.
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onReset();
          }
        }}
        className="w-full h-6 px-1.5 text-xs font-mono rounded border border-border/40 bg-field text-ink disabled:opacity-50"
      />
    </div>
  );
}

function FreeFramePositionSection({
  source,
  refObj,
  disabled,
}: {
  readonly source: ElementSource;
  readonly refObj: ElementRef;
  readonly disabled: boolean;
}) {
  const { t } = useTranslation();
  const tailwindMajor = useCanvasViewStore((s) => s.tailwindMajor);
  const staticClass = source.className.kind === 'static' ? source.className.value : '';
  const key = `${refObj.loc}#${String(refObj.index)}`;
  const { vals, setters, inits } = usePositionState(staticClass, key);
  const commit = (prop: 'x' | 'y' | 'w' | 'h', val: string) => {
    commitPosition(prop, val, staticClass, refObj.loc, source.tag, inits, tailwindMajor);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink-strong">{t('freeFrame.position')}</span>
      <div className="grid grid-cols-2 gap-2">
        {POS_FIELDS.map(([prop, id, labelKey, isSize]) => {
          const val = vals[prop];
          const init = inits[prop];
          const setter = setters[prop];
          return (
            <FreeFramePosInput
              key={id}
              id={id}
              label={t(labelKey)}
              val={val}
              placeholder={isSize ? t('freeFrame.auto') : undefined}
              disabled={disabled}
              onChange={setter}
              onCommit={() => {
                commit(prop, val);
              }}
              onReset={() => {
                setter(init !== undefined ? String(init) : '');
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function FreeFrameLayerOrderSection({
  refObj,
  tag,
  disabled,
}: {
  readonly refObj: ElementRef;
  readonly tag: string;
  readonly disabled: boolean;
}) {
  const { t } = useTranslation();
  const treeNodes = useSelectionStore((s) => s.treeNodes);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink-strong">{t('freeFrame.layerOrder')}</span>
      <div className="flex items-center gap-1">
        {ORDER_BTNS.map(([cmd, id, labelKey, icon]) => {
          const target = layerOrderTarget(cmd, refObj, tag, treeNodes);
          return (
            <button
              key={cmd}
              type="button"
              data-testid={id}
              title={t(labelKey)}
              aria-label={t(labelKey)}
              disabled={disabled || target === undefined}
              onClick={() => void runLayerOrder(cmd, refObj, tag)}
              className="flex-1 h-6 flex items-center justify-center rounded border border-border/40 bg-field text-ink hover:bg-border/30 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold"
            >
              {icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FreeFrameAlignSection({
  disabled,
  selectedCount,
}: {
  readonly disabled: boolean;
  readonly selectedCount: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink-strong">{t('freeFrame.align')}</span>
      <div className="grid grid-cols-6 gap-1">
        {ALIGN_BTNS.map(([mode, id, labelKey, icon]) => (
          <button
            key={mode}
            type="button"
            data-testid={id}
            title={t(labelKey)}
            aria-label={t(labelKey)}
            disabled={disabled}
            onClick={() => void runAlign(mode)}
            className="h-6 flex items-center justify-center rounded border border-border/40 bg-field text-ink hover:bg-border/30 disabled:opacity-30 text-xs font-bold"
          >
            {icon}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1 pt-0.5">
        {DIST_BTNS.map(([axis, id, labelKey]) => (
          <button
            key={axis}
            type="button"
            data-testid={id}
            title={t(labelKey)}
            aria-label={t(labelKey)}
            disabled={disabled || selectedCount < 3}
            onClick={() => void runAlign(axis)}
            className="h-6 px-1 flex items-center justify-center rounded border border-border/40 bg-field text-ink hover:bg-border/30 disabled:opacity-30 text-xs font-medium"
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

function FreeFrameErrorAlert() {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const error = useFreeFrameErrorStore((s) => s.error);
  if (!error) return <></>;

  const msg =
    error === 'measureTimeout'
      ? t('freeFrame.measureTimeout')
      : errorText(tError, error.code, error.params);

  return (
    <div role="alert" data-testid="free-frame-error" className="text-xs text-danger">
      {msg}
    </div>
  );
}

export function FreeFrameSection({ source }: { readonly source?: ElementSource | undefined }) {
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const primaryRef = selectedRefs[selectedRefs.length - 1];
  const ref = useMemo(
    () =>
      primaryRef?.loc === source?.loc
        ? primaryRef
        : source
          ? { loc: source.loc, index: 0 }
          : undefined,
    [primaryRef, source],
  );

  const [frame, setFrame] = useState<{ ref: ElementRef; tag: string } | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!ref) {
        setFrame(undefined);
        return;
      }
      const found = await freeFrameOfRef(ref);
      if (!cancelled) setFrame(found);
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [ref]);

  if (!frame) return <></>;

  const isLocked = source?.className.kind === 'expression';
  const isSingle = selectedRefs.length === 1 && source !== undefined && ref !== undefined;

  return (
    <div
      data-testid="free-frame-section"
      className="flex flex-col gap-2 pt-2 border-t border-border/30"
    >
      {isSingle && (
        <>
          <FreeFramePositionSection source={source} refObj={ref} disabled={isLocked} />
          <FreeFrameLayerOrderSection refObj={ref} tag={source.tag} disabled={isLocked} />
        </>
      )}
      <FreeFrameAlignSection disabled={isLocked} selectedCount={selectedRefs.length} />
      <FreeFrameErrorAlert />
    </div>
  );
}
