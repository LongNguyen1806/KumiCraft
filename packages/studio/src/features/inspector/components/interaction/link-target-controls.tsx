// Link target picker, section id naming, and smooth-scroll controls (K9.8-1 TK-79).
import type { ElementSource, PageInfo } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyInteraction, applySmoothScroll } from '../../../../api/interaction-client.ts';
import { usePagesData } from '../../../editor/page-select.tsx';
import {
  interactionDisableReason,
  InteractionErrorNotice,
  ToolActionButton,
  useInteractionTask,
} from './interaction-shared.tsx';
import {
  type NameSectionProps,
  type SectionOption,
  usePageSectionIds,
} from './section-id-controls.tsx';

export const LINK_ELIGIBLE_TAGS = new Set(['a', 'Link', 'button']);
type LinkKind = 'section' | 'route' | 'external';

type LinkValueFieldProps = {
  readonly targetKind: LinkKind;
  readonly resolvedValue: string;
  readonly rawExternal: string;
  readonly sections: readonly SectionOption[];
  readonly pages: readonly PageInfo[];
  readonly onValChange: (v: string) => void;
};

function LinkValueField({
  targetKind,
  resolvedValue,
  rawExternal,
  sections,
  pages,
  onValChange,
}: LinkValueFieldProps) {
  const { t } = useTranslation();
  if (targetKind === 'external') {
    return (
      <input
        type="url"
        data-testid="link-external-url"
        placeholder={t('interaction.externalUrlPlaceholder')}
        value={rawExternal}
        onChange={(e) => {
          onValChange(e.target.value);
        }}
        className="h-[26px] min-w-0 flex-1 rounded border border-line bg-card-solid px-2 text-[11px] text-ink"
      />
    );
  }
  return (
    <select
      data-testid="link-target-value"
      value={resolvedValue}
      onChange={(e) => {
        onValChange(e.target.value);
      }}
      className="h-[26px] min-w-0 flex-1 rounded border border-line bg-card-solid px-1.5 text-[11px] text-ink"
    >
      {targetKind === 'section'
        ? sections.map((s) => (
            <option key={s.id} value={`#${s.id}`}>
              {s.label}
            </option>
          ))
        : pages.map((p) => (
            <option key={p.path} value={p.path}>
              {p.component ? `${p.component} (${p.path})` : p.path}
            </option>
          ))}
      {targetKind === 'section' && sections.length === 0 && (
        <option value="#top">{t('interaction.defaultTopAnchor')}</option>
      )}
    </select>
  );
}

function LinkTargetCheckboxes({
  targetKind,
  newTab,
  smooth,
  onNewTabChange,
  onSmoothChange,
}: {
  readonly targetKind: LinkKind;
  readonly newTab: boolean;
  readonly smooth: boolean;
  readonly onNewTabChange: (b: boolean) => void;
  readonly onSmoothChange: (b: boolean) => void;
}) {
  const { t } = useTranslation();
  if (targetKind === 'external') {
    return (
      <label className="flex items-center gap-1.5 text-[11px] text-ink-soft">
        <input
          type="checkbox"
          data-testid="link-target-newtab"
          checked={newTab}
          onChange={(e) => {
            onNewTabChange(e.target.checked);
          }}
        />
        {t('interaction.openNewTab')}
      </label>
    );
  }
  if (targetKind === 'section') {
    return (
      <label className="flex items-center gap-1.5 text-[11px] text-ink-soft">
        <input
          type="checkbox"
          data-testid="smooth-scroll-toggle"
          checked={smooth}
          onChange={(e) => {
            onSmoothChange(e.target.checked);
          }}
        />
        {t('interaction.smoothScroll')}
      </label>
    );
  }
  return undefined;
}

function LinkTargetInputs(props: {
  readonly targetKind: LinkKind;
  readonly resolvedValue: string;
  readonly rawExternal: string;
  readonly sections: readonly SectionOption[];
  readonly pages: readonly PageInfo[];
  readonly newTab: boolean;
  readonly smooth: boolean;
  readonly onKindChange: (k: LinkKind) => void;
  readonly onValChange: (v: string) => void;
  readonly onNewTabChange: (b: boolean) => void;
  readonly onSmoothChange: (b: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-1">
        <select
          data-testid="link-target-kind"
          value={props.targetKind}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'section' || v === 'route' || v === 'external') props.onKindChange(v);
          }}
          className="h-[26px] rounded border border-line bg-card-solid px-1.5 text-[11px] text-ink"
        >
          <option value="section">{t('interaction.linkKindSection')}</option>
          <option value="route">{t('interaction.linkKindRoute')}</option>
          <option value="external">{t('interaction.linkKindExternal')}</option>
        </select>
        <LinkValueField
          targetKind={props.targetKind}
          resolvedValue={props.resolvedValue}
          rawExternal={props.rawExternal}
          sections={props.sections}
          pages={props.pages}
          onValChange={props.onValChange}
        />
      </div>
      <LinkTargetCheckboxes
        targetKind={props.targetKind}
        newTab={props.newTab}
        smooth={props.smooth}
        onNewTabChange={props.onNewTabChange}
        onSmoothChange={props.onSmoothChange}
      />
    </>
  );
}

function resolveLinkValue(
  targetKind: LinkKind,
  targetVal: string,
  sections: readonly SectionOption[],
  pages: readonly PageInfo[],
): string {
  if (targetKind === 'section') return targetVal || (sections[0] ? `#${sections[0].id}` : '#top');
  if (targetKind === 'route') return targetVal || pages[0]?.path || '/';
  return targetVal.trim();
}

async function commitLinkTarget(opts: {
  readonly source: ElementSource;
  readonly targetKind: LinkKind;
  readonly resolvedValue: string;
  readonly newTab: boolean;
  readonly smooth: boolean;
  readonly sections: readonly SectionOption[];
}) {
  await applyInteraction({
    action: 'setLinkTarget',
    element: { loc: opts.source.loc, tag: opts.source.tag },
    targetKind: opts.targetKind,
    target: opts.resolvedValue,
    ...(opts.targetKind === 'external' ? { newTab: opts.newTab } : {}),
  });
  if (opts.targetKind === 'section' && opts.smooth) {
    const matched = opts.sections.find((s) => `#${s.id}` === opts.resolvedValue);
    await applySmoothScroll({
      enabled: true,
      ...(matched !== undefined ? { targetLoc: matched.loc, targetTag: matched.tag } : {}),
    });
  }
}

function useLinkTargetForm() {
  const [targetKind, setTargetKind] = useState<LinkKind>('section');
  const [targetVal, setTargetVal] = useState('');
  const [newTab, setNewTab] = useState(false);
  const [smooth, setSmooth] = useState(true);
  const changeKind = (kind: LinkKind) => {
    setTargetKind(kind);
    setTargetVal('');
  };
  return { targetKind, targetVal, newTab, smooth, changeKind, setTargetVal, setNewTab, setSmooth };
}

export function LinkTargetControl({ source, onDone }: NameSectionProps) {
  const { t } = useTranslation();
  const isLinkable = LINK_ELIGIBLE_TAGS.has(source.tag);
  const { sections } = usePageSectionIds(isLinkable, source.loc);
  const { pages } = usePagesData();
  const form = useLinkTargetForm();
  const { targetKind, targetVal, newTab, smooth } = form;
  const { busy, error, run } = useInteractionTask(onDone);

  if (!isLinkable) return undefined;
  const reasonKey = interactionDisableReason(source);
  const disabledReason =
    reasonKey !== undefined ? t(`interaction.reasons.${reasonKey}`) : undefined;
  const resolvedValue = resolveLinkValue(targetKind, targetVal, sections, pages);
  const handleApply = () => {
    if (resolvedValue === '') return;
    void run(() =>
      commitLinkTarget({ source, targetKind, resolvedValue, newTab, smooth, sections }),
    );
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-line/60 pt-1.5">
      <div className="text-[11px] font-medium text-ink">{t('interaction.linkToTitle')}</div>
      <LinkTargetInputs
        targetKind={targetKind}
        resolvedValue={resolvedValue}
        rawExternal={targetVal}
        sections={sections}
        pages={pages}
        newTab={newTab}
        smooth={smooth}
        onKindChange={form.changeKind}
        onValChange={form.setTargetVal}
        onNewTabChange={form.setNewTab}
        onSmoothChange={form.setSmooth}
      />
      <ToolActionButton
        testId="apply-link-target"
        label={t('interaction.applyLink')}
        tooltip={t('interaction.applyLinkTooltip')}
        disabled={resolvedValue === ''}
        disabledReason={disabledReason}
        busy={busy}
        onClick={handleApply}
      />
      <InteractionErrorNotice error={error} />
    </div>
  );
}
