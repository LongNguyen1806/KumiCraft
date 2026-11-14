import type {
  ClassContext,
  ClassToken,
  ClassValue,
  ElementSource,
  PropertyId,
  Scope,
} from '@kumicraft/shared';
import type { ReactNode } from 'react';

import { InspectorImageSection } from './components/inspector-image-section.tsx';
import { InspectorMotionSection } from './components/inspector-motion-section.tsx';
import { InspectorPropertyGroups } from './components/inspector-property-groups.tsx';
import type { BatchPropEntry, LiveEditState } from './use-live-edit.ts';

export type EditablePropertySectionsProps = {
  readonly source: ElementSource;
  readonly tokens: readonly ClassToken[];
  readonly currentScope: Scope;
  readonly frameWidth: number;
  readonly ctx: ClassContext;
  readonly isLocked: boolean;
  readonly onPropChange: (property: PropertyId, value: ClassValue | undefined) => void;
  readonly onBatchProps: (entries: readonly BatchPropEntry[]) => void;
  readonly onRefresh: () => void;
  readonly layoutFooter?: ReactNode | undefined;
};

export function EditablePropertySections({
  source,
  tokens,
  currentScope,
  frameWidth,
  ctx,
  isLocked,
  onPropChange,
  onBatchProps,
  onRefresh,
  layoutFooter,
}: EditablePropertySectionsProps) {
  return (
    <>
      <InspectorImageSection
        tag={source.tag}
        editable={true}
        disabled={isLocked}
        tokens={tokens}
        currentScope={currentScope}
        ctx={ctx}
        onPropChange={onPropChange}
      />
      <InspectorPropertyGroups
        tokens={tokens}
        currentScope={currentScope}
        frameWidth={frameWidth}
        ctx={ctx}
        isLocked={isLocked}
        onPropertyValueChange={onPropChange}
        onBatchProperties={onBatchProps}
        layoutFooter={layoutFooter}
      />
      <InspectorMotionSection
        refTarget={{ loc: source.loc, index: 0 }}
        source={source}
        editable={true}
        disabled={isLocked}
        tokens={tokens}
        currentScope={currentScope}
        onPropChange={onPropChange}
        onBatchProps={onBatchProps}
        onRefresh={onRefresh}
      />
    </>
  );
}

export function useSingleTargetLiveCallbacks(
  liveEdit: LiveEditState,
  onClassStringChange?: (newString: string) => void,
) {
  const onPropChange = (
    prop: Parameters<typeof liveEdit.mutateProperty>[0],
    val: Parameters<typeof liveEdit.mutateProperty>[1],
  ) => {
    liveEdit.mutateProperty(prop, val);
    onClassStringChange?.(liveEdit.classString);
  };
  const onBatchProps = (entries: Parameters<typeof liveEdit.mutateProperties>[0]) => {
    liveEdit.mutateProperties(entries);
    onClassStringChange?.(liveEdit.classString);
  };
  const onRawChange = (raw: string) => {
    liveEdit.mutateRawClass(raw);
    onClassStringChange?.(raw);
  };
  return { onPropChange, onBatchProps, onRawChange };
}
