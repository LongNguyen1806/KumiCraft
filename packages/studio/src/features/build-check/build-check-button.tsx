// "Check build" in the status bar (SPEC-04 M-BC, K9 stage C): one icon button that runs the check
// as a job, a small result chip, and a panel above the bar listing `file:line:col` errors; a click
// opens the line in the editor.
import type { BuildProblem } from '@kumicraft/shared';
import { CircleAlert, CircleCheck, Hammer, LoaderCircle, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { errorText } from '../../routes/error-text.ts';
import { useOpenInEditor } from '../editor/use-open-in-editor.ts';
import { failureOf, useJobFollower } from '../jobs/use-job-follower.ts';
import { useProjectInfo } from '../project/project-store.ts';
import { useBuildCheckStore } from './build-check-store.ts';

/** `src/x.tsx:3:7`, the position "open in editor" takes. */
export function problemLoc(problem: BuildProblem): string | undefined {
  if (problem.file === undefined) return undefined;
  return `${problem.file}:${String(problem.line ?? 1)}:${String(problem.column ?? 1)}`;
}

/** Follows the running job; a new project clears the last result. */
function useBuildCheckJob(): void {
  const jobId = useBuildCheckStore((s) => s.jobId);
  const root = useProjectInfo()?.root;
  useEffect(() => {
    useBuildCheckStore.getState().reset();
  }, [root]);
  useJobFollower(jobId, {
    onLines: () => undefined,
    onCompleted: () => {
      if (jobId !== undefined) void useBuildCheckStore.getState().finish(jobId);
    },
    onFailed: (error) => {
      if (jobId !== undefined) void useBuildCheckStore.getState().finish(jobId, failureOf(error));
    },
    onCancelled: () => {
      useBuildCheckStore.setState({ jobId: undefined });
    },
  });
}

function ProblemRow({ problem, onOpen }: { problem: BuildProblem; onOpen: (loc: string) => void }) {
  const { t } = useTranslation();
  const loc = problemLoc(problem);
  const body = (
    <>
      <span className="font-mono text-[11px] text-danger">
        {loc}
        <span className={loc === undefined ? 'text-ink-faint' : 'ml-1.5 text-ink-faint'}>
          {problem.source}
        </span>
      </span>
      <span className="text-ink [overflow-wrap:anywhere]">{problem.message}</span>
    </>
  );
  if (loc === undefined) {
    return <li className="flex flex-col gap-0.5 rounded-md px-2 py-1.5">{body}</li>;
  }
  return (
    <li>
      <button
        type="button"
        data-testid="build-check-problem"
        title={t('buildCheck.openHint')}
        onClick={() => {
          onOpen(loc);
        }}
        className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-field-hover focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
      >
        {body}
      </button>
    </li>
  );
}

function PanelBody() {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const result = useBuildCheckStore((s) => s.result);
  const error = useBuildCheckStore((s) => s.error);
  const editor = useOpenInEditor();
  if (error !== undefined) {
    return (
      <p role="alert" className="px-2 py-1.5 text-danger">
        {t('buildCheck.failed')}: {errorText(tError, error.code, error.params)}
      </p>
    );
  }
  if (result === undefined) return undefined;
  if (result.ok) return <p className="px-2 py-1.5 text-ink">{t('buildCheck.ok')}</p>;
  const hidden = result.total - result.problems.length;
  return (
    <>
      <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto" data-testid="build-check-list">
        {result.problems.map((problem, i) => (
          <ProblemRow
            key={`${String(i)}-${problemLoc(problem) ?? ''}`}
            problem={problem}
            onOpen={editor.open}
          />
        ))}
      </ul>
      {hidden > 0 && (
        <p className="px-2 pt-1 text-ink-faint">{t('buildCheck.more', { count: hidden })}</p>
      )}
      {editor.errorInfo !== undefined && (
        <p role="alert" className="px-2 pt-1 text-danger">
          {errorText(tError, editor.errorInfo.code, editor.errorInfo.params)}
        </p>
      )}
    </>
  );
}

function BuildCheckPanel({ anchor }: { readonly anchor: { left: number; bottom: number } }) {
  const { t } = useTranslation();
  const result = useBuildCheckStore((s) => s.result);
  const running = useBuildCheckStore((s) => s.jobId !== undefined);
  const setPanelOpen = useBuildCheckStore((s) => s.setPanelOpen);
  return createPortal(
    <section
      role="dialog"
      aria-label={t('buildCheck.title')}
      data-testid="build-check-panel"
      style={{ left: anchor.left, bottom: anchor.bottom }}
      className="fixed z-50 flex w-[min(28rem,calc(100vw-2rem))] flex-col gap-1 rounded-panel border border-line bg-card-solid p-2 text-xs shadow-soft"
    >
      <header className="flex items-center justify-between gap-2 px-2">
        <h2 className="font-medium text-ink">{t('buildCheck.title')}</h2>
        <div className="flex items-center gap-2 text-ink-faint">
          {result !== undefined && (
            <span>{t('buildCheck.took', { seconds: (result.durationMs / 1000).toFixed(1) })}</span>
          )}
          <button
            type="button"
            disabled={running}
            onClick={() => void useBuildCheckStore.getState().start()}
            className="rounded px-1.5 py-0.5 text-ink hover:bg-field-hover disabled:opacity-40"
          >
            {t('buildCheck.again')}
          </button>
          <button
            type="button"
            aria-label={t('buildCheck.close')}
            onClick={() => {
              setPanelOpen(false);
            }}
            className="rounded px-1.5 py-0.5 text-ink hover:bg-field-hover"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </div>
      </header>
      <PanelBody />
    </section>,
    document.body,
  );
}

function ResultChip() {
  const { t } = useTranslation();
  const result = useBuildCheckStore((s) => s.result);
  const setPanelOpen = useBuildCheckStore((s) => s.setPanelOpen);
  const panelOpen = useBuildCheckStore((s) => s.panelOpen);
  if (result === undefined) return undefined;
  const label = result.ok ? t('buildCheck.ok') : t('buildCheck.problems', { count: result.total });
  return (
    <button
      type="button"
      data-testid="build-check-result"
      aria-expanded={panelOpen}
      onClick={() => {
        setPanelOpen(!panelOpen);
      }}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-field-hover ${result.ok ? 'text-success' : 'text-danger'}`}
    >
      {result.ok ? (
        <CircleCheck aria-hidden className="size-3.5" />
      ) : (
        <CircleAlert aria-hidden className="size-3.5" />
      )}
      <span>{label}</span>
    </button>
  );
}

/** Where the panel opens: above the button, measured when it opens. */
function usePanelAnchor(open: boolean) {
  const ref = useRef<HTMLDivElement>(undefined);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number }>();
  useEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (open && rect !== undefined) {
      setAnchor({ left: rect.left, bottom: window.innerHeight - rect.top + 6 });
    }
  }, [open]);
  return { ref, anchor };
}

export function BuildCheckButton() {
  const { t } = useTranslation();
  useBuildCheckJob();
  const running = useBuildCheckStore((s) => s.jobId !== undefined);
  const panelOpen = useBuildCheckStore((s) => s.panelOpen);
  const { ref, anchor } = usePanelAnchor(panelOpen);
  const label = running ? t('buildCheck.cancel') : t('buildCheck.run');
  return (
    <div
      ref={(el) => {
        ref.current = el ?? undefined;
      }}
      className="flex items-center gap-1"
      data-testid="build-check"
    >
      <button
        type="button"
        data-testid="build-check-btn"
        aria-label={label}
        title={running ? t('buildCheck.running') : label}
        onClick={() => {
          const store = useBuildCheckStore.getState();
          if (running) store.cancel();
          else void store.start();
        }}
        className="grid size-6 place-items-center rounded text-ink hover:bg-field-hover focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
      >
        {running ? (
          <span className="relative grid place-items-center">
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            <Square aria-hidden className="absolute size-1.5 fill-current" />
          </span>
        ) : (
          <Hammer aria-hidden className="size-3.5" />
        )}
      </button>
      {!running && <ResultChip />}
      {running && (
        <span className="sr-only" role="status">
          {t('buildCheck.running')}
        </span>
      )}
      {panelOpen && anchor !== undefined && <BuildCheckPanel anchor={anchor} />}
    </div>
  );
}
