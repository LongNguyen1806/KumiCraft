// Extended element attributes editor (id, title, target, rel, role, tabIndex, aria-*, data-*) (K9.7-2 TK-4).
import {
  type EditableAttr,
  type ElementAttributes,
  isValidSettableAttrName,
} from '@kumicraft/shared';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { InspectorGroup } from './inspector-group.tsx';

const PRIMARY_TAG_ATTRS = new Set(['href', 'src', 'alt', 'placeholder', 'type']);
const QUICK_ATTRS: readonly EditableAttr[] = ['id', 'aria-label', 'title', 'target', 'rel', 'role'];

function isEditableAttrName(name: string): name is EditableAttr {
  return isValidSettableAttrName(name);
}

function AttrRowHeader({
  name,
  isExpression,
  disabled,
  onRemove,
  onOpenInEditor,
}: {
  readonly name: EditableAttr;
  readonly isExpression: boolean;
  readonly disabled: boolean;
  readonly onRemove: () => void;
  readonly onOpenInEditor?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="font-mono text-[11px] text-ink-faint">{name}</span>
      <div className="flex items-center gap-1">
        {isExpression && onOpenInEditor !== undefined && (
          <button
            type="button"
            onClick={onOpenInEditor}
            className="text-[10px] text-accent hover:underline"
          >
            {t('inspector.openInEditor')}
          </button>
        )}
        {!isExpression && (
          <button
            type="button"
            data-testid={`attr-remove-${name}`}
            aria-label={`${t('inspector.attrs.remove')} ${name}`}
            disabled={disabled}
            onClick={onRemove}
            className="grid size-4 place-items-center rounded text-ink-faint hover:bg-field hover:text-ink disabled:opacity-40"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function AttrValueInput({
  name,
  shownValue,
  disabled,
  onDraftChange,
  onCommit,
  onCancel,
}: {
  readonly name: EditableAttr;
  readonly shownValue: string;
  readonly disabled: boolean;
  readonly onDraftChange: (value: string) => void;
  readonly onCommit: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <input
      type="text"
      data-testid={`attr-input-${name}`}
      disabled={disabled}
      value={shownValue}
      onChange={(e) => {
        onDraftChange(e.target.value);
      }}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') onCancel();
      }}
      className="h-7 w-full rounded-md border border-line bg-card-solid px-2 font-mono text-xs text-ink hover:bg-field disabled:opacity-50"
    />
  );
}

function AttrEditorRow({
  name,
  attributes,
  disabled,
  onAttributeChange,
  onOpenInEditor,
}: {
  readonly name: EditableAttr;
  readonly attributes: ElementAttributes;
  readonly disabled: boolean;
  readonly onAttributeChange: (name: EditableAttr, value: string | undefined) => void;
  readonly onOpenInEditor?: (() => void) | undefined;
}) {
  const entry = attributes[name];
  const isExpression = entry?.kind === 'expression';
  const current = entry?.kind === 'static' ? entry.value : isExpression ? entry.code : '';
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const shownValue = draft ?? current;
  const commit = () => {
    const trimmed = shownValue.trim();
    setDraft(undefined);
    if (trimmed !== current) onAttributeChange(name, trimmed === '' ? undefined : trimmed);
  };
  return (
    <div className="flex flex-col gap-1">
      <AttrRowHeader
        name={name}
        isExpression={isExpression}
        disabled={disabled}
        onRemove={() => {
          onAttributeChange(name, undefined);
        }}
        onOpenInEditor={onOpenInEditor}
      />
      <AttrValueInput
        name={name}
        shownValue={shownValue}
        disabled={disabled || isExpression}
        onDraftChange={setDraft}
        onCommit={commit}
        onCancel={() => {
          setDraft(undefined);
        }}
      />
    </div>
  );
}

function AddAttributeInputs({
  disabled,
  nameInput,
  valueInput,
  onName,
  onValue,
}: {
  readonly disabled: boolean;
  readonly nameInput: string;
  readonly valueInput: string;
  readonly onName: (v: string) => void;
  readonly onValue: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        data-testid="attr-add-name"
        disabled={disabled}
        value={nameInput}
        onChange={(e) => {
          onName(e.target.value);
        }}
        placeholder={t('inspector.attrs.namePlaceholder')}
        className="h-7 min-w-0 flex-1 rounded-md border border-line bg-card-solid px-2 font-mono text-[11px] text-ink placeholder:text-ink-faint"
      />
      <input
        type="text"
        data-testid="attr-add-value"
        disabled={disabled}
        value={valueInput}
        onChange={(e) => {
          onValue(e.target.value);
        }}
        placeholder={t('inspector.attrs.valuePlaceholder')}
        className="h-7 min-w-0 flex-1 rounded-md border border-line bg-card-solid px-2 font-mono text-[11px] text-ink placeholder:text-ink-faint"
      />
      <button
        type="submit"
        data-testid="attr-add-submit"
        disabled={disabled || nameInput.trim() === ''}
        aria-label={t('inspector.attrs.add')}
        className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-card-solid text-ink hover:bg-field disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function AddAttributeForm({
  disabled,
  onAdd,
}: {
  readonly disabled: boolean;
  readonly onAdd: (name: EditableAttr, value: string) => void;
}) {
  const { t } = useTranslation();
  const [nameInput, setNameInput] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const trimmedName = nameInput.trim();
    if (!isEditableAttrName(trimmedName)) {
      setError(t('inspector.attrs.blocked'));
      return;
    }
    setError(undefined);
    onAdd(trimmedName, valueInput.trim());
    setNameInput('');
    setValueInput('');
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-1.5 border-t border-line pt-2">
      <AddAttributeInputs
        disabled={disabled}
        nameInput={nameInput}
        valueInput={valueInput}
        onName={(v) => {
          setNameInput(v);
          if (error !== undefined) setError(undefined);
        }}
        onValue={setValueInput}
      />
      {error !== undefined && (
        <p role="alert" data-testid="attr-add-error" className="text-[11px] text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

export type AttributesEditorProps = {
  readonly tag: string;
  readonly attributes: ElementAttributes;
  readonly disabled: boolean;
  readonly onAttributeChange: (name: EditableAttr, value: string | undefined) => void;
  readonly onOpenInEditor?: (() => void) | undefined;
};

function isTagPrimaryAttr(tag: string, name: string): boolean {
  if (!PRIMARY_TAG_ATTRS.has(name)) return false;
  return (
    (tag === 'a' && name === 'href') ||
    (tag === 'img' && (name === 'src' || name === 'alt')) ||
    (tag === 'input' && (name === 'placeholder' || name === 'type')) ||
    (tag === 'textarea' && name === 'placeholder') ||
    (tag === 'button' && name === 'type')
  );
}

function QuickAttrButtons({
  availableQuick,
  disabled,
  onPick,
}: {
  readonly availableQuick: readonly EditableAttr[];
  readonly disabled: boolean;
  readonly onPick: (name: EditableAttr) => void;
}) {
  if (availableQuick.length === 0) return undefined;
  return (
    <div className="flex flex-wrap gap-1">
      {availableQuick.map((name) => (
        <button
          key={name}
          type="button"
          data-testid={`attr-quick-${name}`}
          disabled={disabled}
          onClick={() => {
            onPick(name);
          }}
          className="rounded border border-line bg-field px-1.5 py-0.5 font-mono text-[10px] text-ink-soft hover:border-accent hover:text-ink disabled:opacity-40"
        >
          + {name}
        </button>
      ))}
    </div>
  );
}

export function AttributesEditorSection({
  tag,
  attributes,
  disabled,
  onAttributeChange,
  onOpenInEditor,
}: AttributesEditorProps) {
  const { t } = useTranslation();
  const presentAttrs = Object.keys(attributes).filter(
    (name): name is EditableAttr => !isTagPrimaryAttr(tag, name) && isEditableAttrName(name),
  );
  const availableQuick = QUICK_ATTRS.filter((name) => attributes[name] === undefined);

  return (
    <InspectorGroup
      id="attributes"
      title={t('inspector.groups.attributes')}
      defaultOpen={presentAttrs.length > 0}
      testId="inspector-attributes"
    >
      <div className="flex flex-col gap-2">
        {presentAttrs.map((name) => (
          <AttrEditorRow
            key={name}
            name={name}
            attributes={attributes}
            disabled={disabled}
            onAttributeChange={onAttributeChange}
            onOpenInEditor={onOpenInEditor}
          />
        ))}
        <QuickAttrButtons
          availableQuick={availableQuick}
          disabled={disabled}
          onPick={(name) => {
            onAttributeChange(name, name === 'target' ? '_blank' : '');
          }}
        />
        <AddAttributeForm
          disabled={disabled}
          onAdd={(name, value) => {
            onAttributeChange(name, value);
          }}
        />
      </div>
    </InspectorGroup>
  );
}
