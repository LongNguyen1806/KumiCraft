import { useTranslation } from 'react-i18next';

import type { NodeRenderProps } from './layout-nodes.tsx';

export function ButtonNode({ node, className }: NodeRenderProps) {
  const { t } = useTranslation();
  const content = node.content?.kind === 'button' ? node.content : undefined;
  return (
    <button
      data-rc-node={node.id}
      type={content?.buttonType ?? 'button'}
      onClick={(e) => {
        e.preventDefault();
      }}
      className={className}
    >
      {content?.text ?? t('canvas.defaultButton')}
    </button>
  );
}

export function LinkNode({ node, className }: NodeRenderProps) {
  const { t } = useTranslation();
  const content = node.content?.kind === 'link' ? node.content : undefined;
  return (
    <a
      data-rc-node={node.id}
      href={content?.href ?? '#'}
      onClick={(e) => {
        e.preventDefault();
      }}
      className={className}
    >
      {content?.text ?? t('canvas.defaultLink')}
    </a>
  );
}

export function FormNode({ node, className, children }: NodeRenderProps) {
  return (
    <form
      data-rc-node={node.id}
      onSubmit={(e) => {
        e.preventDefault();
      }}
      className={className}
    >
      {children}
    </form>
  );
}

export function InputNode({ node, className }: NodeRenderProps) {
  const content = node.content?.kind === 'input' ? node.content : undefined;
  return (
    <div data-rc-node={node.id} className={className}>
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

export function TextareaNode({ node, className }: NodeRenderProps) {
  const content = node.content?.kind === 'textarea' ? node.content : undefined;
  return (
    <div data-rc-node={node.id} className={className}>
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

export function SelectNode({ node, className }: NodeRenderProps) {
  const content = node.content?.kind === 'select' ? node.content : undefined;
  return (
    <div data-rc-node={node.id} className={className}>
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

export function CheckboxNode({ node, className }: NodeRenderProps) {
  const content = node.content?.kind === 'choice' ? node.content : undefined;
  return (
    <label data-rc-node={node.id} className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <input type="checkbox" disabled className="rounded border-neutral-300" />
      <span>{content?.label ?? ''}</span>
    </label>
  );
}

export function RadioNode({ node, className }: NodeRenderProps) {
  const content = node.content?.kind === 'choice' ? node.content : undefined;
  return (
    <label data-rc-node={node.id} className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <input type="radio" disabled className="border-neutral-300" />
      <span>{content?.label ?? ''}</span>
    </label>
  );
}

export function SwitchNode({ node, className }: NodeRenderProps) {
  return (
    <button
      data-rc-node={node.id}
      type="button"
      role="switch"
      aria-checked={false}
      className={`inline-flex h-6 w-11 items-center rounded-full bg-neutral-300 p-1 ${className}`}
    >
      <span className="size-4 rounded-full bg-white transition" />
    </button>
  );
}
