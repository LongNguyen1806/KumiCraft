// Probe result view and create project form for ProjectDialog (SPEC-04 M-PJ).
import type { AppCandidate, PackageManager, ProjectProbe } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { systemsCombinedName } from './styling-label.ts';

const PACKAGE_MANAGERS: readonly PackageManager[] = ['pnpm', 'npm', 'yarn'];

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
        <span className="font-medium text-emerald-600">{t('project.supported')}</span>
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
        className="self-end rounded-full bg-primary px-5 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
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
      <span className="font-medium text-rose-600">{t('project.unsupported')}:</span>
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
          <span className="text-[10px] text-rose-500 mt-0.5">
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
          className="shrink-0 rounded bg-primary px-3 py-1 font-medium text-white hover:bg-primary-hover disabled:opacity-50 text-xs"
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

function CreateProjectFields({
  createName,
  setCreateName,
  createPm,
  setCreatePm,
}: {
  readonly createName: string;
  readonly setCreateName: (name: string) => void;
  readonly createPm: PackageManager;
  readonly setCreatePm: (pm: PackageManager) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="text-[10px] text-ink-faint block mb-1">{t('project.projectName')}</label>
        <input
          type="text"
          value={createName}
          onChange={(e) => {
            setCreateName(e.target.value);
          }}
          className="w-full rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink focus:outline-none"
          data-testid="create-project-name"
        />
      </div>
      <div>
        <label className="text-[10px] text-ink-faint block mb-1">
          {t('project.packageManager')}
        </label>
        <select
          value={createPm}
          onChange={(e) => {
            setCreatePm(e.target.value as PackageManager);
          }}
          className="w-full rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink focus:outline-none"
          data-testid="create-project-pm"
        >
          {PACKAGE_MANAGERS.map((pm) => (
            <option key={pm} value={pm}>
              {pm}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CreateProjectForm({
  busy,
  onCreate,
}: {
  readonly busy: boolean;
  readonly onCreate: (name: string, pm: PackageManager) => void;
}) {
  const { t } = useTranslation();
  const [createName, setCreateName] = useState('my-app');
  const [createPm, setCreatePm] = useState<PackageManager>('pnpm');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(createName, createPm);
      }}
      className="flex flex-col gap-3"
    >
      <span className="font-medium text-ink">{t('project.create')}</span>
      <CreateProjectFields
        createName={createName}
        setCreateName={setCreateName}
        createPm={createPm}
        setCreatePm={setCreatePm}
      />
      <button
        type="submit"
        disabled={busy || !createName.trim()}
        className="self-end rounded-full bg-primary px-5 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        data-testid="create-project-btn"
      >
        {busy ? t('project.creating') : t('project.create')}
      </button>
    </form>
  );
}

export type ProjectProbeResultViewProps = {
  readonly probe?: ProjectProbe | undefined;
  readonly probing: boolean;
  readonly busy: boolean;
  readonly errorMsg?: string | undefined;
  readonly onOpen: () => void;
  readonly onOpenCandidate?: ((path: string) => void) | undefined;
  readonly onCreate: (name: string, pm: PackageManager) => void;
};

export function ProjectProbeResultView({
  probe,
  probing,
  busy,
  errorMsg,
  onOpen,
  onOpenCandidate,
  onCreate,
}: ProjectProbeResultViewProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border bg-card p-4 min-h-[120px] flex flex-col justify-center">
      {probing ? (
        <div className="text-center text-xs text-ink-faint">{t('project.probing')}</div>
      ) : probe?.kind === 'project' ? (
        probe.support.supported ? (
          <SupportedProjectView probe={probe} busy={busy} onOpen={onOpen} />
        ) : (
          <UnsupportedProjectView probe={probe} />
        )
      ) : probe?.kind === 'apps' ? (
        <AppsProbeView probe={probe} busy={busy} onOpenCandidate={onOpenCandidate} />
      ) : probe?.kind === 'empty' || (probe?.kind === 'missing' && probe.canCreate) ? (
        <CreateProjectForm busy={busy} onCreate={onCreate} />
      ) : probe?.kind === 'other' ? (
        <p className="text-center text-ink-soft" data-testid="not-project-msg">
          {t('project.notProject')}
        </p>
      ) : undefined}

      {errorMsg && <p className="mt-2 text-xs text-rose-600 font-medium">{errorMsg}</p>}
    </div>
  );
}
