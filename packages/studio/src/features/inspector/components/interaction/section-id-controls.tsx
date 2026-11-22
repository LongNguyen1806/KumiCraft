// Section ids for in-page links: name a section, and list the sections of the page (K9.8-1 TK-79).
import { type ElementSource, parseLocString, type TreeNode } from '@kumicraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchElementSourceByLoc } from '../../../../api/source-client.ts';
import { sendEdit } from '../../../../core/edits.ts';
import { useSelectionStore } from '../../../../core/selection-store.ts';
import {
  interactionDisableReason,
  InteractionErrorNotice,
  ToolActionButton,
  useInteractionTask,
} from './interaction-shared.tsx';

export const SECTION_ELIGIBLE_TAGS = new Set([
  'section',
  'div',
  'article',
  'main',
  'header',
  'footer',
  'aside',
]);

function slugifyId(raw: string): string {
  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'section';
}

function buildUniqueSectionId(
  customId: string,
  source: ElementSource,
  existingIds: ReadonlySet<string>,
  currentId: string | undefined,
): string {
  const base = slugifyId(
    customId.trim() || (source.text.kind === 'static' ? source.text.value : source.tag),
  );
  let unique = base;
  let suffix = 2;
  while (existingIds.has(unique) && unique !== currentId) {
    unique = `${base}-${String(suffix)}`;
    suffix += 1;
  }
  return unique;
}

export type SectionOption = {
  readonly id: string;
  readonly loc: string;
  readonly tag: string;
  readonly label: string;
};

export function usePageSectionIds(
  active: boolean,
  sourceLoc: string,
): {
  readonly sections: readonly SectionOption[];
  readonly existingIds: ReadonlySet<string>;
} {
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const file = parseLocString(sourceLoc)?.file;
  const [sections, setSections] = useState<readonly SectionOption[]>([]);

  useEffect(() => {
    if (!active || file === undefined) return;
    let cancelled = false;
    const candidates: TreeNode[] = treeNodes.filter(
      (n) => parseLocString(n.ref.loc)?.file === file && SECTION_ELIGIBLE_TAGS.has(n.tag),
    );
    const load = async () => {
      const results = await Promise.all(
        candidates.slice(0, 30).map(async (c) => {
          try {
            const src = await fetchElementSourceByLoc(c.ref.loc);
            const idAttr = src?.attributes['id'];
            if (idAttr?.kind === 'static' && idAttr.value.trim() !== '') {
              return {
                id: idAttr.value.trim(),
                loc: c.ref.loc,
                tag: c.tag,
                label: c.label ? `${c.label} (#${idAttr.value.trim()})` : `#${idAttr.value.trim()}`,
              };
            }
          } catch {
            // Skip unreadable nodes
          }
          return undefined;
        }),
      );
      if (!cancelled) {
        setSections(results.filter((r): r is SectionOption => r !== undefined));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [active, file, treeNodes]);

  return { sections, existingIds: new Set(sections.map((s) => s.id)) };
}

export type NameSectionProps = { readonly source: ElementSource; readonly onDone: () => void };

function saveSectionId(source: ElementSource, before: string | undefined, after: string) {
  return sendEdit({
    edit: { kind: 'setAttribute', loc: source.loc, tag: source.tag, name: 'id', before, after },
  });
}

export function NameSectionIdControl({ source, onDone }: NameSectionProps) {
  const { t } = useTranslation();
  const existingAttr = source.attributes['id'];
  const currentId = existingAttr?.kind === 'static' ? existingAttr.value : undefined;
  const isSection = SECTION_ELIGIBLE_TAGS.has(source.tag);
  const { existingIds } = usePageSectionIds(isSection, source.loc);
  const [customId, setCustomId] = useState(currentId ?? '');
  const { busy, error, run } = useInteractionTask(onDone);
  if (!isSection) return undefined;
  const reasonKey = interactionDisableReason(source);
  const disabledReason =
    reasonKey !== undefined ? t(`interaction.reasons.${reasonKey}`) : undefined;
  const onSaveId = () => {
    const unique = buildUniqueSectionId(customId, source, existingIds, currentId);
    void run(async () => {
      await saveSectionId(source, currentId, unique);
      setCustomId(unique);
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        data-testid="section-id-input"
        placeholder={t('interaction.sectionIdPlaceholder')}
        value={customId}
        onChange={(e) => {
          setCustomId(e.target.value);
        }}
        className="h-[26px] w-full rounded border border-line bg-card-solid px-2 text-[11px] text-ink"
      />
      <ToolActionButton
        testId="name-section-id-btn"
        label={t('interaction.nameSection')}
        tooltip={t('interaction.nameSectionTooltip')}
        disabledReason={disabledReason}
        busy={busy}
        onClick={onSaveId}
      />
      <InteractionErrorNotice error={error} />
    </div>
  );
}
