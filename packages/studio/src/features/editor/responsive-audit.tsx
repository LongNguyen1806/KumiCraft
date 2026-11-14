// Responsive audit button and results panel across open Canvas frames (TK-66).
import type { Frame, ResponsiveAuditIssue } from '@kumicraft/shared';
import { MonitorSmartphone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { bridgeChannels, studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { type OpenFrame, useCanvasViewStore } from './canvas-view-store.ts';

function resolveFrameLabel(
  issue: ResponsiveAuditIssue,
  openFrames: readonly OpenFrame[],
  frames: readonly Frame[],
  activeId: string,
): { readonly frameId: string; readonly label: string } {
  const targetOpen =
    openFrames.find((of) => of.id === issue.frameId) ??
    openFrames.find((of) => of.id === activeId) ??
    openFrames[0];
  const preset = frames.find((f) => f.id === targetOpen?.frameId) ?? frames[0];
  const base = issue.frameLabel ?? preset?.label ?? 'Frame';
  const widthText = issue.width !== undefined ? `${String(issue.width)}px` : '';
  return {
    frameId: targetOpen?.id ?? activeId,
    label: widthText ? `${base} (${widthText})` : base,
  };
}

export function useResponsiveAudit() {
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [issues, setIssues] = useState<readonly ResponsiveAuditIssue[]>([]);
  const activeReqRef = useRef<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    };
  }, []);

  const runAudit = () => {
    const requestId = `audit-${String(Date.now())}-${String(Math.random()).slice(2, 6)}`;
    activeReqRef.current = requestId;
    setIssues([]);
    setOpen(true);
    setRunning(true);
    if (timerRef.current !== undefined) clearTimeout(timerRef.current);

    let stopListener: (() => void) | undefined;
    stopListener = studioBridgeChannel.registerResponsiveAuditListener((payload) => {
      if (payload.requestId !== activeReqRef.current) return;
      setIssues((prev) => [...prev, ...payload.issues]);
      setRunning(false);
    });

    studioBridgeChannel.requestResponsiveAudit(requestId);
    timerRef.current = setTimeout(() => {
      stopListener?.();
      stopListener = undefined;
      if (activeReqRef.current === requestId) setRunning(false);
    }, 800);
  };

  return {
    running,
    open,
    issues,
    runAudit,
    close: () => {
      setOpen(false);
    },
  };
}

export function ResponsiveAuditButton({
  running,
  onClick,
}: {
  readonly running: boolean;
  readonly onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="responsive-audit"
      disabled={running}
      onClick={onClick}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-line bg-card-solid px-2 text-xs font-medium text-ink hover:bg-field disabled:opacity-50"
    >
      <MonitorSmartphone className="size-3.5" aria-hidden />
      <span>{running ? t('responsiveAudit.running') : t('responsiveAudit.button')}</span>
    </button>
  );
}

function jumpToAuditIssue(
  issue: ResponsiveAuditIssue,
  frameId: string,
  activeOpenFrameId: string,
  setActiveOpenFrameId: (id: string) => void,
) {
  if (frameId && frameId !== activeOpenFrameId) {
    setActiveOpenFrameId(frameId);
  }
  useSelectionStore.getState().setSelectedRefs([issue.ref]);
  const ch = bridgeChannels.getExisting(frameId) ?? studioBridgeChannel;
  ch.select([issue.ref], true);
}

function AuditIssueRow({
  issue,
  index,
  label,
  onJump,
}: {
  readonly issue: ResponsiveAuditIssue;
  readonly index: number;
  readonly label: string;
  readonly onJump: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid={`responsive-issue-${String(index)}`}
      onClick={onJump}
      className="flex items-center justify-between gap-2 rounded border border-line bg-field px-2 py-1 text-left text-[11px] hover:bg-card-solid"
    >
      <span className="truncate font-mono text-ink">{issue.ref.loc}</span>
      <span className="shrink-0 text-ink-soft">{label}</span>
      <span className="shrink-0 rounded bg-sun-soft px-1.5 py-0.5 font-medium text-warn">
        {issue.kind === 'overflow' ? t('responsiveAudit.overflow') : t('responsiveAudit.overlap')}
      </span>
    </button>
  );
}

function AuditHeader({ onClose }: { readonly onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-semibold text-ink">{t('responsiveAudit.title')}</span>
      <button
        type="button"
        aria-label={t('responsiveAudit.close')}
        onClick={onClose}
        className="rounded p-0.5 text-ink-soft hover:bg-field"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function AuditIssuesBody({
  running,
  issues,
}: {
  readonly running: boolean;
  readonly issues: readonly ResponsiveAuditIssue[];
}) {
  const { t } = useTranslation();
  const openFrames = useCanvasViewStore((s) => s.openFrames);
  const frames = useCanvasViewStore((s) => s.frames);
  const activeOpenFrameId = useCanvasViewStore((s) => s.activeOpenFrameId);
  const setActiveOpenFrameId = useCanvasViewStore((s) => s.setActiveOpenFrameId);

  if (running && issues.length === 0) {
    return <p className="text-[11px] text-ink-soft">{t('responsiveAudit.running')}</p>;
  }
  if (issues.length === 0) {
    return (
      <p data-testid="responsive-audit-empty" className="text-[11px] text-ink-soft">
        {t('responsiveAudit.noIssues')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {issues.map((issue, idx) => {
        const { frameId, label } = resolveFrameLabel(issue, openFrames, frames, activeOpenFrameId);
        return (
          <AuditIssueRow
            key={`${issue.ref.loc}-${issue.kind}-${String(idx)}`}
            issue={issue}
            index={idx}
            label={label}
            onJump={() => {
              jumpToAuditIssue(issue, frameId, activeOpenFrameId, setActiveOpenFrameId);
            }}
          />
        );
      })}
    </div>
  );
}

export function ResponsiveAuditResults({
  open,
  running,
  issues,
  onClose,
}: {
  readonly open: boolean;
  readonly running: boolean;
  readonly issues: readonly ResponsiveAuditIssue[];
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!open) return undefined;

  return (
    <section
      data-testid="responsive-audit-results"
      aria-label={t('responsiveAudit.title')}
      className="mx-3 mt-2 flex max-h-48 flex-col gap-1.5 rounded-md border border-line bg-card-solid p-2.5 text-xs shadow-md"
    >
      <AuditHeader onClose={onClose} />
      <AuditIssuesBody running={running} issues={issues} />
    </section>
  );
}
