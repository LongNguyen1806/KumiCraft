// Unified "Interaction" collapsible group placed directly after Layout (K9.8-1 section 3).
import {
  type ElementRef,
  type ElementSource,
  primarySystem,
  type StyleSystemId,
  type TreeNode,
} from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { useProjectInfo } from '../../../project/project-store.ts';
import { useSelectionStore } from '../../../selection/selection-store.ts';
import type { MultiTargetItem } from '../../types.ts';
import { InspectorGroup } from '../inspector-group.tsx';
import { collectDescendants } from './interaction-shared.tsx';
import {
  LINK_ELIGIBLE_TAGS,
  LinkTargetControl,
  NameSectionIdControl,
  SECTION_ELIGIBLE_TAGS,
} from './link-target-controls.tsx';
import { LOADING_ELIGIBLE_TAGS, LoadingButtonControl } from './loading-button-control.tsx';
import { ScrollSpyControl } from './scroll-spy-control.tsx';
import {
  SELECT_CONTAINER_TAGS,
  SelectGroupMultiControls,
  SelectGroupSingleControls,
} from './select-group-controls.tsx';

function useProjectStyleSystem(): StyleSystemId | undefined {
  const project = useProjectInfo();
  return primarySystem(project?.support.styling);
}

export function hasApplicableInteraction(
  source: ElementSource,
  refTarget: ElementRef,
  treeNodes: readonly TreeNode[],
): boolean {
  if (
    source.tag === 'SelectGroup' ||
    source.component?.name === 'SelectGroup' ||
    source.tag === 'SelectItem' ||
    source.component?.name === 'SelectItem' ||
    source.tag === 'nav' ||
    source.tag === 'ScrollSpy'
  ) {
    return true;
  }
  if (
    SELECT_CONTAINER_TAGS.has(source.tag) ||
    SECTION_ELIGIBLE_TAGS.has(source.tag) ||
    LINK_ELIGIBLE_TAGS.has(source.tag) ||
    LOADING_ELIGIBLE_TAGS.has(source.tag)
  ) {
    return true;
  }
  return collectDescendants(treeNodes, refTarget).some((n) => n.tag === 'a' || n.tag === 'Link');
}

export function InteractionSection({
  source,
  refTarget,
  onDone,
}: {
  readonly source: ElementSource;
  readonly refTarget: ElementRef;
  readonly onDone: () => void;
}) {
  const { t } = useTranslation();
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const styleSystem = useProjectStyleSystem();
  if (!hasApplicableInteraction(source, refTarget, treeNodes)) return undefined;

  return (
    <InspectorGroup
      id="interaction"
      title={t('inspector.groups.interaction')}
      testId="inspector-interaction"
      defaultOpen={true}
    >
      <div className="flex flex-col gap-2">
        <SelectGroupSingleControls
          source={source}
          refTarget={refTarget}
          styleSystem={styleSystem}
          onDone={onDone}
        />
        <NameSectionIdControl source={source} onDone={onDone} />
        <LinkTargetControl source={source} onDone={onDone} />
        <LoadingButtonControl source={source} onDone={onDone} />
        <ScrollSpyControl source={source} refTarget={refTarget} onDone={onDone} />
      </div>
    </InspectorGroup>
  );
}

export function MultiInteractionSection({
  items,
  onDone,
}: {
  readonly items: readonly MultiTargetItem[];
  readonly onDone: () => void;
}) {
  const { t } = useTranslation();
  const styleSystem = useProjectStyleSystem();

  return (
    <InspectorGroup
      id="interaction"
      title={t('inspector.groups.interaction')}
      testId="inspector-interaction"
      defaultOpen={true}
    >
      <SelectGroupMultiControls items={items} styleSystem={styleSystem} onDone={onDone} />
    </InspectorGroup>
  );
}
