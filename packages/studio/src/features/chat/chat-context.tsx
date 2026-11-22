// Context chips for selected element, route, and canvas frame (WP-3.05a, R-CH-02).
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { resolveTargetTag } from '../structure/structure-commands.ts';
import { useChatStore } from './chat-store.ts';

function formatLoc(loc: string): string {
  const parts = loc.split(':');
  if (parts.length >= 3) {
    const file = parts[0];
    const line = parts[1];
    if (file !== undefined && line !== undefined) {
      return `${file}:${line}`;
    }
  }
  return loc;
}

function formatTag(tag: string): string {
  if (tag.length === 0) return tag;
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

function ElementChip() {
  const { t } = useTranslation('chat');
  const hidden = useChatStore((s) => s.hidden.element);
  const setHidden = useChatStore((s) => s.setHidden);
  const selectedRefs = useSelectionStore((s) => s.selectedRefs);
  const lastRef = selectedRefs[selectedRefs.length - 1];

  if (hidden || lastRef === undefined) return undefined;
  const tag = resolveTargetTag(lastRef);
  if (tag === undefined) return undefined;

  const label = `${formatTag(tag)} · ${formatLoc(lastRef.loc)}`;
  return (
    <span
      data-testid="chat-chip-element"
      className="inline-flex items-center gap-1 rounded-full bg-field px-2.5 py-0.5 text-[11px] text-ink-soft"
    >
      <span className="truncate max-w-[200px]">{label}</span>
      <button
        type="button"
        aria-label={t('remove')}
        data-testid="chat-chip-element-remove"
        onClick={() => {
          setHidden('element', true);
        }}
        className="rounded-md p-0.5 hover:bg-field-hover text-ink-faint hover:text-ink"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function PageChip() {
  const { t } = useTranslation('chat');
  const hidden = useChatStore((s) => s.hidden.page);
  const setHidden = useChatStore((s) => s.setHidden);
  const currentRoute = useSelectionStore((s) => s.currentRoute);

  if (hidden || !currentRoute) return undefined;

  return (
    <span
      data-testid="chat-chip-page"
      className="inline-flex items-center gap-1 rounded-full bg-field px-2.5 py-0.5 text-[11px] text-ink-soft"
    >
      <span className="truncate max-w-[120px]">{currentRoute}</span>
      <button
        type="button"
        aria-label={t('remove')}
        data-testid="chat-chip-page-remove"
        onClick={() => {
          setHidden('page', true);
        }}
        className="rounded-md p-0.5 hover:bg-field-hover text-ink-faint hover:text-ink"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function FrameChip() {
  const { t } = useTranslation('chat');
  const hidden = useChatStore((s) => s.hidden.frame);
  const setHidden = useChatStore((s) => s.setHidden);
  const activeFrameId = useCanvasViewStore((s) => s.activeFrameId);
  const frames = useCanvasViewStore((s) => s.frames);
  const activeFrame = frames.find((f) => f.id === activeFrameId);

  if (hidden || activeFrame === undefined) return undefined;

  const label = `${activeFrame.label} · ${String(activeFrame.width)} px`;
  return (
    <span
      data-testid="chat-chip-frame"
      className="inline-flex items-center gap-1 rounded-full bg-field px-2.5 py-0.5 text-[11px] text-ink-soft"
    >
      <span className="truncate max-w-[150px]">{label}</span>
      <button
        type="button"
        aria-label={t('remove')}
        data-testid="chat-chip-frame-remove"
        onClick={() => {
          setHidden('frame', true);
        }}
        className="rounded-md p-0.5 hover:bg-field-hover text-ink-faint hover:text-ink"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

export function ChatContext() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <ElementChip />
      <PageChip />
      <FrameChip />
    </div>
  );
}
