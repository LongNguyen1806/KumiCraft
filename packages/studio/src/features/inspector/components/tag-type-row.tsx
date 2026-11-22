// "Loại thẻ" row at the top of the Attributes group: switch an HTML tag (K9.7-2), with the href hint for <a>.
import { HTML_SETTABLE_TAGS, type HtmlSettableTag } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { sendEdit } from '../../../core/edits.ts';
import { useEditMode } from '../../project/use-edit-mode.ts';
import type { InspectorTarget } from '../types.ts';

type ElementTarget = Extract<InspectorTarget, { readonly kind: 'element' }>;

function isHtmlSettableTag(tag: string): tag is HtmlSettableTag {
  return (HTML_SETTABLE_TAGS as readonly string[]).includes(tag);
}

/** True when the selected element is a link without an href (the hint asks the user to add one). */
export function isLinkMissingHref(target: ElementTarget): boolean {
  return target.source?.tag === 'a' && target.source.attributes['href'] === undefined;
}

function useTagChange(target: ElementTarget) {
  const [changingTag, setChangingTag] = useState(false);
  const handleTagChange = (after: HtmlSettableTag) => {
    const src = target.source;
    if (src === undefined) return;
    setChangingTag(true);
    const run = async () => {
      try {
        await sendEdit({ edit: { kind: 'setTag', loc: src.loc, tag: src.tag, after } });
        target.refresh();
      } finally {
        setChangingTag(false);
      }
    };
    void run();
  };
  return { changingTag, handleTagChange };
}

function LinkHrefHint() {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="link-href-hint"
      onClick={() => {
        const input = document.getElementById('attr-href');
        if (input instanceof HTMLInputElement) input.focus();
      }}
      className="rounded bg-sun-soft px-1.5 py-0.5 text-[10px] font-medium text-ink hover:underline"
    >
      {t('inspector.linkHrefHint')}
    </button>
  );
}

export function TagTypeRow({ target }: { readonly target: ElementTarget }) {
  const { t } = useTranslation();
  const editMode = useEditMode();
  const { changingTag, handleTagChange } = useTagChange(target);
  const source = target.source;
  if (source === undefined) return undefined;
  const tag = source.tag;
  const locked =
    source.readonly !== undefined ||
    target.lockReason === 'outsideSource' ||
    editMode === 'viewOnly' ||
    changingTag;

  return (
    <div className="flex items-center gap-1.5" data-testid="inspector-tag-row">
      <span className="shrink-0 text-[11px] whitespace-nowrap text-ink-faint">
        {t('inspector.tagSelectLabel')}
      </span>
      {isHtmlSettableTag(tag) ? (
        <select
          data-testid="inspector-tag-select"
          aria-label={t('inspector.tagSelectLabel')}
          value={tag}
          disabled={locked}
          onChange={(e) => {
            const next = e.target.value;
            if (isHtmlSettableTag(next) && next !== tag) handleTagChange(next);
          }}
          className="h-6 rounded border border-line bg-card-solid px-1.5 font-mono text-[12px] text-ink hover:bg-field disabled:opacity-50"
        >
          {HTML_SETTABLE_TAGS.map((candidate) => (
            <option key={candidate} value={candidate}>
              &lt;{candidate}&gt;
            </option>
          ))}
        </select>
      ) : (
        <span className="font-mono text-[12px] text-ink">&lt;{tag}&gt;</span>
      )}
      {!locked && isLinkMissingHref(target) && <LinkHrefHint />}
    </div>
  );
}
