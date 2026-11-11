// Probe result view and create project form for ProjectDialog (SPEC-04 M-PJ).
import type { AppCandidate, PackageManager, ProjectProbe } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { CreateHereForm } from './create-project-form.tsx';
import { systemsCombinedName } from './styling-label.ts';

function SupportedStylingInfo({
  support,
}: {
  readonly support: Extract<ProjectProbe, { readonly kind: 'project' }>['support'];
}) {
  const { t } = useTranslation();
  const styling =
    support.styling ??
    (support.tailwindCss !== undefined
      ? {
          systems: [{ id: 'tailwind' as const }],
          primary: 'tailwind' as const,
          editable: true,
          globalCss: [support.tailwindCss],
        }
      : undefined);
  if (styling === undefined) return undefined;
  return (
    <>
      <span data-testid="probe-styling" className="text-xs text-ink-soft">
        {t('project.stylingLabel', {
          styling: systemsCombinedName(styling.systems, t),
        })}
      </span>
      <span data-testid="probe-style-edit" className="text-xs text-ink-faint">
        {styling.editable ? t('project.styleEditable') : t('project.styleNotEditable')}
      </span>
    </>
  );
}

function SupportedProjectView({
  probe,
  busy,
  onOpen,
}: {
  readonly probe: Extract<ProjectProbe, { readonly kind: 'project' }>;
  readonly busy: boolean;
  readonly onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-leaf">{t('project.supported')}</span>
        <span className="font-mono text-[11px] text-ink-faint">
          {probe.support.framework} • {probe.support.language.toUpperCase()}
        </span>
      </div>
      {probe.support.tailwindCss && (
        <span className="text-[11px] text-ink-faint font-mono truncate">
          {t('project.cssPath', { path: probe.support.tailwindCss })}
        </span>
      )}
      <SupportedStylingInfo support={probe.support} />
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        className="self-end rounded-md bg-charcoal px-4 h-8 font-medium text-on-charcoal hover:bg-primary-hover disabled:opacity-50"
        data-testid="open-project-btn"
      >
        {busy ? t('project.opening') : t('project.open')}
      </button>
    </div>
  );
}

function UnsupportedProjectView({
  probe,
}: {
  readonly probe: Extract<ProjectProbe, { readonly kind: 'project' }>;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium text-danger">{t('project.unsupported')}:</span>
      <ul className="list-disc pl-4 text-ink-soft space-y-1">
        {probe.support.reasons.map((reason) => (
          <li key={reason}>{t(`project.reasons.${reason}`, { defaultValue: reason })}</li>
        ))}
      </ul>
    </div>
  );
}

function AppCandidateRow({
  app,
  busy,
  onOpenCandidate,
}: {
  readonly app: AppCandidate;
  readonly busy: boolean;
  readonly onOpenCandidate?: ((path: string) => void) | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid={`app-candidate-${app.path}`}
      className="flex items-center justify-between gap-2 rounded border border-border bg-field p-2"
    >
      <div className="flex flex-col min-w-0">
        <span className="font-mono font-medium truncate">{app.path}</span>
        <span className="text-[11px] text-ink-faint">
          {app.kind} • {app.supported ? t('project.appSupported') : t('project.unsupported')}
        </span>
        {!app.supported && app.reasons.length > 0 && (
          <span className="text-[10px] text-danger mt-0.5">
            {app.reasons.map((r) => t(`project.reasons.${r}`, { defaultValue: r })).join('; ')}
          </span>
        )}
      </div>
      {app.supported && onOpenCandidate !== undefined && (
        <button
          type="button"
          data-testid={`app-candidate-open-${app.path}`}
          disabled={busy}
          onClick={() => {
            onOpenCandidate(app.path);
          }}
          className="shrink-0 rounded bg-primary px-3 py-1 font-medium text-on-charcoal hover:bg-primary-hover disabled:opacity-50 text-xs"
        >
          {t('project.open')}
        </button>
      )}
    </div>
  );
}

function AppsProbeView({
  probe,
  busy,
  onOpenCandidate,
}: {
  readonly probe: Extract<ProjectProbe, { readonly kind: 'apps' }>;
  readonly busy: boolean;
  readonly onOpenCandidate?: ((path: string) => void) | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3" data-testid="apps-probe-view">
      <span className="font-medium text-ink">
        {t('project.appsCount', { count: probe.apps.length })}
      </span>
      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
        {probe.apps.map((app) => (
          <AppCandidateRow key={app.path} app={app} busy={busy} onOpenCandidate={onOpenCandidate} />
        ))}
      </div>
    </div>
  );
}

export type ProjectProbeResultViewProps = {
  readonly probe?: ProjectProbe | undefined;
  readonly probing: boolean;
  readonly busy: boolean;
  readonly errorMsg?: string | undefined;
  readonly onOpen: () => void;
  readonly onOpenCandidate?: ((path: string) => void) | undefined;
  /** The folder shown; a new project goes in it or in a new folder inside it. */
  readonly location: string;
  readonly onCreate: (targetPath: string, name: string, pm: PackageManager) => void;
};

type ProbeBodyProps = Omit<ProjectProbeResultViewProps, 'probing' | 'errorMsg'>;

/** What the folder is decides what is offered: open it, pick an app in it, or create in it. */
function ProbeBody({ probe, location, busy, onOpen, onOpenCandidate, onCreate }: ProbeBodyProps) {
  const { t } = useTranslation();
  const create = { busy, location, onCreate };
  if (probe === undefined) return undefined;
  switch (probe.kind) {
    case 'project':
      return probe.support.supported ? (
        <SupportedProjectView probe={probe} busy={busy} onOpen={onOpen} />
      ) : (
        <UnsupportedProjectView probe={probe} />
      );
    case 'apps':
      return <AppsProbeView probe={probe} busy={busy} onOpenCandidate={onOpenCandidate} />;
    case 'empty':
      return <CreateHereForm {...create} />;
    case 'missing':
      return probe.canCreate ? <CreateHereForm {...create} /> : undefined;
    case 'other':
      return (
        <p className="text-center text-ink-soft" data-testid="not-project-msg">
          {t('project.notProject')}
        </p>
      );
  }
}

export function ProjectProbeResultView({
  probing,
  errorMsg,
  ...body
}: ProjectProbeResultViewProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border bg-card p-4 min-h-[120px] flex flex-col justify-center">
      {probing ? (
        <div className="text-center text-xs text-ink-faint">{t('project.probing')}</div>
      ) : (
        <ProbeBody {...body} />
      )}
      {errorMsg && <p className="mt-2 text-xs text-danger font-medium">{errorMsg}</p>}
    </div>
  );
}
