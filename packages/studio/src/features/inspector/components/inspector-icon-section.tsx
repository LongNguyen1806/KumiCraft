// Inspector Icon controls for inline <svg data-icon="..."> elements (K9.7-2 TK-6, TK-7).
import type { ElementSource, SetAttributeEdit } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyStructureEdit, editSource, editSourceBatch } from '../../../api/source-client.ts';
import { IconPickerDialog } from '../../icons/icon-picker.tsx';
import { InspectorGroup } from './inspector-group.tsx';

const SIZE_PRESETS = ['16', '20', '24', '32', '40', '48'] as const;
const STROKE_PRESETS = ['1', '1.5', '2', '2.5', '3'] as const;
const COLOR_PRESETS = [
  'currentColor',
  '#111827',
  '#2563eb',
  '#059669',
  '#d97706',
  '#e11d48',
] as const;

function readAttr(source: ElementSource, name: string): string | undefined {
  const entry = source.attributes[name];
  return entry?.kind === 'static' ? entry.value : undefined;
}

export type InspectorIconSectionProps = {
  readonly source: ElementSource;
  readonly disabled: boolean;
  readonly editable: boolean;
  readonly currentTextColor?: string | undefined;
  readonly onTextColorChange?: ((color: string) => void) | undefined;
  readonly onRefresh: () => void;
};

function formatPx(value: string): string {
  return `${value}px`;
}

function IconSizeSelect({
  size,
  disabled,
  onChange,
}: {
  readonly size: string;
  readonly disabled: boolean;
  readonly onChange: (nextSize: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-faint">{t('inspector.icon.size')}</span>
      <select
        data-testid="icon-size-select"
        disabled={disabled}
        value={size}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="h-7 rounded-md border border-line bg-card-solid px-2 text-xs text-ink"
      >
        {!SIZE_PRESETS.some((p) => p === size) && <option value={size}>{formatPx(size)}</option>}
        {SIZE_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {formatPx(preset)}
          </option>
        ))}
      </select>
    </label>
  );
}

function IconStrokeSelect({
  strokeWidth,
  disabled,
  onChange,
}: {
  readonly strokeWidth: string;
  readonly disabled: boolean;
  readonly onChange: (nextStroke: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-faint">{t('inspector.icon.strokeWidth')}</span>
      <select
        data-testid="icon-stroke-select"
        disabled={disabled}
        value={strokeWidth}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="h-7 rounded-md border border-line bg-card-solid px-2 text-xs text-ink"
      >
        {STROKE_PRESETS.map((val) => (
          <option key={val} value={val}>
            {val}
          </option>
        ))}
      </select>
    </label>
  );
}

function IconSizeStrokeGrid(props: {
  readonly size: string;
  readonly strokeWidth: string;
  readonly disabled: boolean;
  readonly onSizeChange: (nextSize: string) => void;
  readonly onStrokeChange: (nextStroke: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <IconSizeSelect size={props.size} disabled={props.disabled} onChange={props.onSizeChange} />
      <IconStrokeSelect
        strokeWidth={props.strokeWidth}
        disabled={props.disabled}
        onChange={props.onStrokeChange}
      />
    </div>
  );
}

function IconColorSwatches({
  activeColor,
  disabled,
  onPickColor,
}: {
  readonly activeColor: string;
  readonly disabled: boolean;
  readonly onPickColor: (color: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <span className="text-[11px] text-ink-faint">{t('inspector.icon.color')}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color}
            type="button"
            data-testid={`icon-color-${color.replace('#', '')}`}
            disabled={disabled}
            aria-label={color}
            onClick={() => {
              onPickColor(color);
            }}
            style={{ backgroundColor: color === 'currentColor' ? 'transparent' : color }}
            className={`size-5 rounded-full border ${
              activeColor === color ? 'border-accent ring-1 ring-accent' : 'border-line'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

async function batchUpdateIconSize(source: ElementSource, nextSize: string): Promise<void> {
  const edits: SetAttributeEdit[] = [
    {
      kind: 'setAttribute',
      loc: source.loc,
      tag: source.tag,
      name: 'width',
      before: readAttr(source, 'width'),
      after: nextSize,
    },
    {
      kind: 'setAttribute',
      loc: source.loc,
      tag: source.tag,
      name: 'height',
      before: readAttr(source, 'height'),
      after: nextSize,
    },
  ];
  await editSourceBatch({ edits });
}

async function updateSvgAttr(
  source: ElementSource,
  name: 'strokeWidth' | 'stroke',
  after: string,
): Promise<void> {
  await editSource({
    edit: {
      kind: 'setAttribute',
      loc: source.loc,
      tag: source.tag,
      name,
      before: readAttr(source, name),
      after,
    },
  });
}

function IconHeaderRow({
  iconName,
  disabled,
  onOpenPicker,
}: {
  readonly iconName: string;
  readonly disabled: boolean;
  readonly onOpenPicker: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate font-mono text-xs text-ink" data-testid="icon-current-name">
        {iconName}
      </span>
      <button
        type="button"
        data-testid="icon-change-btn"
        disabled={disabled}
        onClick={onOpenPicker}
        className="h-7 rounded-md border border-line bg-card-solid px-2.5 text-xs font-medium text-ink hover:bg-field disabled:opacity-40"
      >
        {t('inspector.icon.change')}
      </button>
    </div>
  );
}

function IconControlsBody({
  iconName,
  source,
  activeColor,
  editable,
  isBusy,
  onOpenPicker,
  onRunBusy,
  onTextColorChange,
}: {
  readonly iconName: string;
  readonly source: ElementSource;
  readonly activeColor: string;
  readonly editable: boolean;
  readonly isBusy: boolean;
  readonly onOpenPicker: () => void;
  readonly onRunBusy: (work: () => Promise<unknown>) => void;
  readonly onTextColorChange?: ((hex: string) => void) | undefined;
}) {
  return (
    <div className="space-y-2.5">
      <IconHeaderRow iconName={iconName} disabled={isBusy} onOpenPicker={onOpenPicker} />
      <IconSizeStrokeGrid
        size={readAttr(source, 'width') ?? '24'}
        strokeWidth={readAttr(source, 'strokeWidth') ?? '2'}
        disabled={isBusy}
        onSizeChange={(next) => {
          onRunBusy(() => batchUpdateIconSize(source, next));
        }}
        onStrokeChange={(next) => {
          onRunBusy(() => updateSvgAttr(source, 'strokeWidth', next));
        }}
      />
      <IconColorSwatches
        activeColor={activeColor}
        disabled={isBusy}
        onPickColor={(color) => {
          if (editable && color !== 'currentColor' && onTextColorChange !== undefined) {
            onTextColorChange(color);
          } else {
            onRunBusy(() => updateSvgAttr(source, 'stroke', color));
          }
        }}
      />
    </div>
  );
}

function useIconActionRunner(disabled: boolean, onRefresh: () => void) {
  const [busy, setBusy] = useState(false);
  const runBusy = (work: () => Promise<unknown>) => {
    if (disabled || busy) return;
    setBusy(true);
    void (async () => {
      try {
        await work();
        onRefresh();
      } finally {
        setBusy(false);
      }
    })();
  };
  return { busy, runBusy };
}

export function InspectorIconSection(props: InspectorIconSectionProps) {
  const { source, disabled, editable, currentTextColor, onTextColorChange, onRefresh } = props;
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { busy, runBusy } = useIconActionRunner(disabled, onRefresh);

  const iconName = readAttr(source, 'data-icon');
  if (source.tag.toLowerCase() !== 'svg' || iconName === undefined) return undefined;

  const activeColor = editable
    ? (currentTextColor ?? readAttr(source, 'stroke') ?? 'currentColor')
    : (readAttr(source, 'stroke') ?? 'currentColor');

  return (
    <InspectorGroup
      id="icon"
      title={t('inspector.groups.icon')}
      defaultOpen
      testId="inspector-icon"
    >
      <IconControlsBody
        iconName={iconName}
        source={source}
        activeColor={activeColor}
        editable={editable}
        isBusy={disabled || busy}
        onOpenPicker={() => {
          setPickerOpen(true);
        }}
        onRunBusy={runBusy}
        onTextColorChange={onTextColorChange}
      />
      <IconPickerDialog
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
        }}
        onPick={(icon) => {
          const entry = { name: icon.name, node: [...icon.node] };
          runBusy(() =>
            applyStructureEdit({ kind: 'replaceSvg', loc: source.loc, tag: 'svg', icon: entry }),
          );
        }}
      />
    </InspectorGroup>
  );
}
