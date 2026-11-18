import type {
  ClassContext,
  ClassToken,
  ClassValue,
  ElementRef,
  ElementSource,
  PropertyId,
  Scope,
} from '@kumicraft/shared';
import type { ReactNode } from 'react';

import { InspectorImageSection } from './components/inspector-image-section.tsx';
import { InspectorMotionSection } from './components/inspector-motion-section.tsx';
import { InspectorPropertyGroups } from './components/inspector-property-groups.tsx';
import { InteractionSection } from './components/interaction/interaction-section.tsx';
import type { BatchPropEntry, LiveEditState } from './use-live-edit.ts';

export type EditablePropertySectionsProps = {
  readonly refTarget?: ElementRef | undefined;
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

export function EditablePropertySections(props: EditablePropertySectionsProps) {
  const { source, isLocked, onPropChange, onRefresh } = props;
  const effectiveRef = props.refTarget ?? { loc: source.loc, index: 0 };
  return (
    <>
      <InspectorImageSection
        tag={source.tag}
        editable={true}
        disabled={isLocked}
        tokens={props.tokens}
        currentScope={props.currentScope}
        ctx={props.ctx}
        onPropChange={onPropChange}
      />
      <InspectorPropertyGroups
        tokens={props.tokens}
        currentScope={props.currentScope}
        frameWidth={props.frameWidth}
        ctx={props.ctx}
        isLocked={isLocked}
        onPropertyValueChange={onPropChange}
        onBatchProperties={props.onBatchProps}
        layoutFooter={props.layoutFooter}
        afterLayout={
          <InteractionSection source={source} refTarget={effectiveRef} onDone={onRefresh} />
        }
      />
      <InspectorMotionSection
        refTarget={{ loc: source.loc, index: 0 }}
        source={source}
        editable={true}
        disabled={isLocked}
        tokens={props.tokens}
        currentScope={props.currentScope}
        major={props.ctx.major ?? 4}
        onPropChange={onPropChange}
        onBatchProps={props.onBatchProps}
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
