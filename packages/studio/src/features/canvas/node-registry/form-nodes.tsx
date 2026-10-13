import { useTranslation } from 'react-i18next';

import { useTextEditStore } from '../../overlay/text-edit/use-text-edit-store.ts';
import { nodeAttrs, type NodeRenderProps } from './layout-nodes.tsx';

export function ButtonNode({ node, className, isInner }: NodeRenderProps) {
  const { t } = useTranslation();
  const content = node.content?.kind === 'button' ? node.content : undefined;
  const isEditing = useTextEditStore((s) => s.editingNodeId === node.id);
  const session = useTextEditStore((s) => s.endedSessions[node.id] ?? 0);
  const originalText = useTextEditStore((s) => s.originalText);
  const defaultText = t('canvas.defaultButton');
  const textToRender = isEditing ? originalText : (content?.text ?? defaultText);

  return (
    <button
      key={`${node.id}:${String(session)}`}
      {...nodeAttrs(node.id, isInner)}
      type={content?.buttonType ?? 'button'}
      onClick={(e) => {
        e.preventDefault();
      }}
      className={className}
    >
      {/* Edited in place on this span: inside a focused <button>, Space would press the button. */}
      <span data-rc-edit="">{textToRender}</span>
    </button>
  );
}

export function LinkNode({ node, className, isInner }: NodeRenderProps) {
  const { t } = useTranslation();
  const content = node.content?.kind === 'link' ? node.content : undefined;
  const isEditing = useTextEditStore((s) => s.editingNodeId === node.id);
  const session = useTextEditStore((s) => s.endedSessions[node.id] ?? 0);
  const originalText = useTextEditStore((s) => s.originalText);
  const defaultText = t('canvas.defaultLink');
  const textToRender = isEditing ? originalText : (content?.text ?? defaultText);

  return (
    <a
      key={`${node.id}:${String(session)}`}
      {...nodeAttrs(node.id, isInner)}
      href={content?.href ?? '#'}
      onClick={(e) => {
        e.preventDefault();
      }}
      className={className}
    >
      {textToRender}
    </a>
  );
}

export function FormNode({ node, className, children, isInner }: NodeRenderProps) {
  return (
    <form
      {...nodeAttrs(node.id, isInner)}
      onSubmit={(e) => {
        e.preventDefault();
      }}
      className={className}
    >
      {children}
    </form>
  );
}

export function InputNode({ node, className, isInner }: NodeRenderProps) {
  const content = node.content?.kind === 'input' ? node.content : undefined;
  return (
    <div {...nodeAttrs(node.id, isInner)} className={className}>
      {content?.label !== undefined && (
        <label className="block text-xs font-medium mb-1">{content.label}</label>
      )}
      <input
        type={content?.inputType ?? 'text'}
        placeholder={content?.placeholder}
        readOnly
        className="w-full border rounded px-2.5 py-1 text-sm bg-white"
      />
    </div>
  );
}

export function TextareaNode({ node, className, isInner }: NodeRenderProps) {
  const content = node.content?.kind === 'textarea' ? node.content : undefined;
  return (
    <div {...nodeAttrs(node.id, isInner)} className={className}>
      {content?.label !== undefined && (
        <label className="block text-xs font-medium mb-1">{content.label}</label>
      )}
      <textarea
        placeholder={content?.placeholder}
        rows={content?.rows ?? 3}
        readOnly
        className="w-full border rounded px-2.5 py-1 text-sm bg-white"
      />
    </div>
  );
}

export function SelectNode({ node, className, isInner }: NodeRenderProps) {
  const content = node.content?.kind === 'select' ? node.content : undefined;
  return (
    <div {...nodeAttrs(node.id, isInner)} className={className}>
      {content?.label !== undefined && (
        <label className="block text-xs font-medium mb-1">{content.label}</label>
      )}
      <select disabled className="w-full border rounded px-2.5 py-1 text-sm bg-white">
        {content?.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckboxNode({ node, className, isInner }: NodeRenderProps) {
  const content = node.content?.kind === 'choice' ? node.content : undefined;
  return (
    <label
      {...nodeAttrs(node.id, isInner)}
      className={`inline-flex items-center gap-2 text-sm ${className}`}
    >
      <input type="checkbox" disabled className="rounded border-neutral-300" />
      <span>{content?.label ?? ''}</span>
    </label>
  );
}

export function RadioNode({ node, className, isInner }: NodeRenderProps) {
  const content = node.content?.kind === 'choice' ? node.content : undefined;
  return (
    <label
      {...nodeAttrs(node.id, isInner)}
      className={`inline-flex items-center gap-2 text-sm ${className}`}
    >
      <input type="radio" disabled className="border-neutral-300" />
      <span>{content?.label ?? ''}</span>
    </label>
  );
}

export function SwitchNode({ node, className, isInner }: NodeRenderProps) {
  return (
    <button
      {...nodeAttrs(node.id, isInner)}
      type="button"
      role="switch"
      aria-checked={false}
      className={`inline-flex h-6 w-11 items-center rounded-full bg-neutral-300 p-1 ${className}`}
    >
      <span className="size-4 rounded-full bg-white transition" />
    </button>
  );
}
