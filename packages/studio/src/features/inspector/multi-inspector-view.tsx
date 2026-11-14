// Multi-element Inspector view (SPEC-04 M-IN, R-CB-15).
import type {
  BatchEditRequest,
  ClassContext,
  ClassToken,
  ClassValue,
  ElementSource,
  PropertyId,
  Scope,
} from '@kumicraft/shared';
import { parseClasses, readValue } from '@kumicraft/shared';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { editSourceBatch } from '../../api/source-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { ColorField } from './components/color-field.tsx';
import { MultiInteractionSection } from './components/interaction/interaction-section.tsx';
import { PropertyField } from './components/property-field.tsx';
import { isColorProperty, resolveFieldOptions } from './inspector-panel.tsx';
import { MultiEditQueue } from './multi-edit-queue.ts';
import { PROPERTY_GROUPS, type PropertyFieldDef } from './property-groups-config.ts';
import type { MultiTarget, MultiTargetItem } from './types.ts';

type MultiInspectorViewProps = {
  readonly target: MultiTarget;
  readonly ctx: ClassContext;
  readonly frameWidth: number;
};

function computeFieldState(
  property: PropertyId,
  items: readonly MultiTargetItem[],
  scope: Scope,
  frameWidth: number,
  ctx: ClassContext,
): { mixed: boolean; tokens: readonly ClassToken[] } {
  const sources = items.map((i) => i.source).filter((s): s is ElementSource => s !== undefined);
  if (sources.length === 0) {
    return { mixed: false, tokens: [] };
  }

  const values: string[] = [];
  let firstTokens: readonly ClassToken[] = [];

  for (let idx = 0; idx < sources.length; idx++) {
    const src = sources[idx];
    if (!src) continue;
    const classStr = src.className.kind === 'static' ? src.className.value : '';
    const tokens = parseClasses(classStr, ctx);
    if (idx === 0) firstTokens = tokens;
    const read = readValue(tokens, property, { width: frameWidth, state: scope.state }, ctx);
    values.push(JSON.stringify(read.value));
  }

  const firstVal = values[0];
  const allEqual = values.every((v) => v === firstVal);
  return {
    mixed: !allEqual,
    tokens: firstTokens,
  };
}

function useMultiBatchQueue(
  target: MultiTarget,
  ctx: ClassContext,
  send: (req: BatchEditRequest) => Promise<void>,
): MultiEditQueue {
  const [queue] = useState(() => new MultiEditQueue());
  const { items } = target;
  useEffect(() => {
    queue.setDeps({ getItems: () => items, ctx: () => ctx, send });
  }, [queue, items, ctx, send]);
  useEffect(() => {
    queue.resetConfirmed();
  }, [queue, items]);
  useEffect(
    () => () => {
      queue.clear();
    },
    [queue],
  );
  return queue;
}

function MultiInspectorHeader({
  count,
  lock,
  error,
}: {
  readonly count: number;
  readonly lock?: { tag: string; loc: string } | undefined;
  readonly error?: string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="px-1 pt-2 text-xs text-ink-soft font-medium">
        {t('inspector.selectedMultiple', { count })}
      </div>
      {lock && (
        <div
          data-testid="inspector-multi-locked"
          className="px-1 py-1.5 text-xs font-medium text-warn"
        >
          {t('inspector.multiLocked', { tag: lock.tag, loc: lock.loc })}
        </div>
      )}
      {error && (
        <div data-testid="inspector-error" className="py-2 text-xs font-medium text-danger">
          {error}
        </div>
      )}
    </>
  );
}

export function MultiInspectorView({ target, ctx, frameWidth }: MultiInspectorViewProps) {
  const { t: tError } = useTranslation('errors');
  const [error, setError] = useState<string | undefined>(undefined);

  const handleBatch = useCallback(
    async (req: BatchEditRequest) => {
      try {
        await editSourceBatch(req);
        setError(undefined);
        target.refresh();
      } catch (err) {
        const info = toErrorInfo(err);
        setError(errorText(tError, info.code, info.params));
        if (info.code === 'E017') {
          target.refresh();
        }
        // Lets the queue drop its saved classes and start again from the reloaded sources.
        throw err;
      }
    },
    [tError, target],
  );

  const queue = useMultiBatchQueue(target, ctx, handleBatch);

  const onPropChange = useCallback(
    (property: PropertyId, value: ClassValue | undefined) => {
      queue.schedule({
        property,
        value,
        scope: target.currentScope,
        writePrefix: target.writePrefix,
      });
    },
    [target.currentScope, target.writePrefix, queue],
  );

  const isLocked = target.lock !== undefined;

  return (
    <div className="flex flex-col gap-2" data-testid="inspector-multi">
      <MultiInspectorHeader count={target.items.length} lock={target.lock} error={error} />
      <MultiPropertyGroups
        target={target}
        ctx={ctx}
        frameWidth={frameWidth}
        isLocked={isLocked}
        onPropChange={onPropChange}
      />
    </div>
  );
}

function MultiPropertyGroups({
  target,
  ctx,
  frameWidth,
  isLocked,
  onPropChange,
}: {
  readonly target: MultiTarget;
  readonly ctx: ClassContext;
  readonly frameWidth: number;
  readonly isLocked: boolean;
  readonly onPropChange: (property: PropertyId, value: ClassValue | undefined) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {PROPERTY_GROUPS.map((group) => (
        <div key={group.id} className="contents">
          <div className="-mx-3 flex flex-col gap-1 border-t border-line px-3 py-2">
            <h3 className="text-xs font-semibold text-ink">{t(group.labelKey)}</h3>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {group.fields.map((field) => (
                <MultiFieldItem
                  key={field.property}
                  field={field}
                  target={target}
                  ctx={ctx}
                  frameWidth={frameWidth}
                  isLocked={isLocked}
                  onPropChange={onPropChange}
                />
              ))}
            </div>
          </div>
          {group.id === 'layout' && (
            <MultiInteractionSection items={target.items} onDone={target.refresh} />
          )}
        </div>
      ))}
    </>
  );
}

type MultiFieldItemProps = {
  readonly field: PropertyFieldDef;
  readonly target: MultiTarget;
  readonly ctx: ClassContext;
  readonly frameWidth: number;
  readonly isLocked: boolean;
  readonly onPropChange: (property: PropertyId, value: ClassValue | undefined) => void;
};

function renderFieldInput(
  props: MultiFieldItemProps,
  label: string,
  mixed: boolean,
  tokens: readonly ClassToken[],
) {
  const { field, target, ctx, frameWidth, isLocked, onPropChange } = props;
  const disabled = isLocked || target.items.length === 0;
  if (isColorProperty(field.property)) {
    return (
      <ColorField
        property={field.property}
        label={label}
        tokens={tokens}
        currentScope={target.currentScope}
        frameWidth={frameWidth}
        ctx={ctx}
        mixed={mixed}
        disabled={disabled}
        onValueChange={onPropChange}
      />
    );
  }
  return (
    <PropertyField
      property={field.property}
      label={label}
      tokens={tokens}
      currentScope={target.currentScope}
      frameWidth={frameWidth}
      ctx={ctx}
      mixed={mixed}
      disabled={disabled}
      options={resolveFieldOptions(field.property, field.options, ctx.theme)}
      onValueChange={onPropChange}
    />
  );
}

function MultiFieldItem(props: MultiFieldItemProps) {
  const { field, target, ctx, frameWidth } = props;
  const { t } = useTranslation();
  const { mixed, tokens } = computeFieldState(
    field.property,
    target.items,
    target.currentScope,
    frameWidth,
    ctx,
  );
  return renderFieldInput(props, t(field.labelKey), mixed, tokens);
}
