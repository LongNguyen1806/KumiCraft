// Tag-specific HTML attributes section (SPEC-04 section 9 M-IN, R-IN-18, FR-25).
import type { EditableAttr, ElementAttributes } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const TAG_ATTR_MAP: Readonly<Record<string, readonly EditableAttr[]>> = {
  a: ['href'],
  img: ['src', 'alt'],
  input: ['placeholder', 'type'],
  textarea: ['placeholder'],
  button: ['type'],
};

type TagAttributesSectionProps = {
  readonly tag: string;
  readonly attributes: ElementAttributes;
  readonly disabled?: boolean | undefined;
  readonly onAttributeChange?: (name: EditableAttr, value: string | undefined) => void;
  readonly onOpenInEditor?: () => void;
};

// Draft is local; the source is written once on blur or Enter (R-IN-18).
function useAttrDraft(
  val: string,
  readOnly: boolean,
  onCommit: (next: string | undefined) => void,
) {
  const [draft, setDraft] = useState(val);
  const [prevVal, setPrevVal] = useState(val);
  if (val !== prevVal) {
    setPrevVal(val);
    setDraft(val);
  }

  const commit = () => {
    if (readOnly || draft === val) return;
    const trimmed = draft.trim();
    onCommit(trimmed === '' ? undefined : trimmed);
  };

  return { draft, setDraft, commit };
}

function AttrInput({
  id,
  testId,
  disabled,
  draft,
  val,
  setDraft,
  commit,
}: {
  readonly id: string;
  readonly testId: string;
  readonly disabled: boolean;
  readonly draft: string;
  readonly val: string;
  readonly setDraft: (v: string) => void;
  readonly commit: () => void;
}) {
  return (
    <input
      id={id}
      data-testid={testId}
      type="text"
      disabled={disabled}
      value={draft}
      placeholder="—"
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          // Blur triggers the single commit, so Enter and blur never send twice.
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setDraft(val);
        }
      }}
      className="h-7 w-full rounded border border-border/60 bg-field px-2 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
    />
  );
}

function TagAttrRow({
  attrName,
  attributes,
  disabled,
  onAttributeChange,
  onOpenInEditor,
}: {
  readonly attrName: EditableAttr;
  readonly attributes: ElementAttributes;
  readonly disabled: boolean;
  readonly onAttributeChange?:
    ((name: EditableAttr, value: string | undefined) => void) | undefined;
  readonly onOpenInEditor?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const entry = attributes[attrName];
  const isExpression = entry?.kind === 'expression';
  const val = entry?.kind === 'static' ? entry.value : isExpression ? entry.code : '';

  const { draft, setDraft, commit } = useAttrDraft(val, isExpression, (next) => {
    onAttributeChange?.(attrName, next);
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={`attr-${attrName}`} className="text-xs text-ink-soft font-mono">
          {attrName}
        </label>
        {isExpression && (
          <button
            type="button"
            onClick={onOpenInEditor}
            className="text-[10px] text-accent hover:underline"
          >
            {t('inspector.openInEditor')}
          </button>
        )}
      </div>
      <AttrInput
        id={`attr-${attrName}`}
        testId={`attr-input-${attrName}`}
        disabled={disabled || isExpression}
        draft={draft}
        val={val}
        setDraft={setDraft}
        commit={commit}
      />
    </div>
  );
}

export function TagAttributesSection({
  tag,
  attributes,
  disabled = false,
  onAttributeChange,
  onOpenInEditor,
}: TagAttributesSectionProps) {
  const { t } = useTranslation();
  const relevantAttrs = TAG_ATTR_MAP[tag.toLowerCase()];

  if (!relevantAttrs || relevantAttrs.length === 0) {
    return undefined;
  }

  return (
    <div
      className="flex flex-col gap-2 py-2 border-t border-border/40"
      data-testid="tag-attributes-section"
    >
      <h3 className="text-xs font-semibold text-ink-strong tracking-tight">
        {t('inspector.groups.tagAttributes', { tag })}
      </h3>
      <div className="flex flex-col gap-2">
        {relevantAttrs.map((attrName) => (
          <TagAttrRow
            key={attrName}
            attrName={attrName}
            attributes={attributes}
            disabled={disabled}
            onAttributeChange={onAttributeChange}
            onOpenInEditor={onOpenInEditor}
          />
        ))}
      </div>
    </div>
  );
}
