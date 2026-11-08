// "New project" (R-PJ-11): name, location and package manager; the project gets the folder
// location/name, like the new-project window of an IDE.
import type { PackageManager } from '@kumicraft/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { probeProject } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { NameAndManager } from './create-project-form.tsx';
import { DirectoryBrowser } from './directory-browser.tsx';
import { baseName, childPath, isValidFolderName, parentDir } from './project-paths.ts';

/** Where the new project starts: an empty folder becomes the project, any other gets a new one. */
function useStartingPlace(initialPath: string) {
  const [place, setPlace] = useState({ location: initialPath, name: 'my-app' });
  useEffect(() => {
    if (initialPath === '') return;
    let active = true;
    const load = async () => {
      try {
        const probe = await probeProject(initialPath);
        const parent = parentDir(initialPath);
        if (!active || parent === undefined) return;
        if (probe.kind === 'empty' || (probe.kind === 'missing' && probe.canCreate)) {
          setPlace({ location: parent, name: baseName(initialPath) });
        } else if (probe.kind === 'project') {
          setPlace({ location: parent, name: 'my-app' });
        }
      } catch {
        // The folder given stays the location.
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [initialPath]);
  return place;
}

type TargetStatus =
  | { readonly kind: 'checking' | 'free' | 'taken' | 'noLocation' }
  | { readonly kind: 'error'; readonly message: string };

/** Whether location/name can still be made, checked a moment after typing stops. */
function useTargetStatus(target: string, enabled: boolean): TargetStatus {
  const { t: tError } = useTranslation('errors');
  // The answer remembers which path it is for: a newer path reads as "checking" until checked.
  const [checked, setChecked] = useState<{
    readonly target: string;
    readonly status: TargetStatus;
  }>();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const answer = (status: TargetStatus) => {
      if (active) setChecked({ target, status });
    };
    const timer = setTimeout(() => {
      const check = async () => {
        try {
          const probe = await probeProject(target);
          if (probe.kind === 'missing') answer({ kind: probe.canCreate ? 'free' : 'noLocation' });
          else answer({ kind: probe.kind === 'empty' ? 'free' : 'taken' });
        } catch (cause) {
          const info = toErrorInfo(cause);
          answer({ kind: 'error', message: errorText(tError, info.code, info.params) });
        }
      };
      void check();
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [target, enabled, tError]);
  return checked?.target === target ? checked.status : { kind: 'checking' };
}

function TargetLine({
  nameOk,
  status,
  target,
}: {
  readonly nameOk: boolean;
  readonly status: TargetStatus;
  readonly target: string;
}) {
  const { t } = useTranslation();
  const alert = (text: string, testId: string) => (
    <p role="alert" className="text-xs text-danger" data-testid={testId}>
      {text}
    </p>
  );
  if (!nameOk) return alert(t('project.folderNameInvalid'), 'create-project-name-error');
  if (status.kind === 'taken')
    return alert(t('project.targetTaken', { path: target }), 'create-project-taken');
  if (status.kind === 'noLocation')
    return alert(t('project.locationMissing'), 'create-project-no-location');
  if (status.kind === 'error') return alert(status.message, 'create-project-target-error');
  return (
    <p className="text-[11px] text-ink-soft" data-testid="create-project-target">
      {t('project.willCreateAt')} <span className="font-mono break-all text-ink">{target}</span>
    </p>
  );
}

function LocationField({
  location,
  onLocation,
}: {
  readonly location: string;
  readonly onLocation: (path: string) => void;
}) {
  const { t } = useTranslation();
  const [browsing, setBrowsing] = useState(false);
  return (
    <div className="grid gap-1">
      <span className="text-[11px] text-ink-faint">{t('project.location')}</span>
      <div className="flex gap-2">
        <input
          type="text"
          value={location}
          aria-label={t('project.location')}
          onChange={(e) => {
            onLocation(e.target.value);
          }}
          className="min-w-0 flex-1 rounded border border-border bg-field px-2.5 py-1.5 font-mono text-xs text-ink focus:outline-none"
          data-testid="create-project-location"
        />
        <button
          type="button"
          onClick={() => {
            setBrowsing(!browsing);
          }}
          className="shrink-0 cursor-pointer rounded-full bg-field px-4 py-1.5 text-xs font-medium text-ink hover:bg-field-hover"
          data-testid="create-project-browse"
        >
          {browsing ? t('project.browseDone') : t('project.browse')}
        </button>
      </div>
      {browsing && <DirectoryBrowser currentPath={location} onSelectPath={onLocation} />}
    </div>
  );
}

export type NewProjectFormProps = {
  /** The folder KumiCraft was started in, or the open project. */
  readonly initialPath: string;
  readonly busy: boolean;
  readonly onCreate: (targetPath: string, name: string, pm: PackageManager) => void;
};

export function NewProjectForm({ initialPath, busy, onCreate }: NewProjectFormProps) {
  const { t } = useTranslation();
  const start = useStartingPlace(initialPath);
  const [edited, setEdited] = useState<{ location?: string; name?: string }>({});
  const [pm, setPm] = useState<PackageManager>('pnpm');
  const location = edited.location ?? start.location;
  const name = edited.name ?? start.name;
  const nameOk = isValidFolderName(name);
  const target = childPath(location, name);
  const status = useTargetStatus(target, nameOk && location.trim() !== '');
  const ready = nameOk && status.kind === 'free' && !busy;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onCreate(target, name.trim(), pm);
      }}
      className="flex flex-col gap-4"
      data-testid="new-project-form"
    >
      <NameAndManager
        name={name}
        nameOk={nameOk}
        pm={pm}
        onName={(value) => {
          setEdited({ ...edited, name: value });
        }}
        onPm={setPm}
      />
      <LocationField
        location={location}
        onLocation={(value) => {
          setEdited({ ...edited, location: value });
        }}
      />
      <TargetLine nameOk={nameOk} status={status} target={target} />
      <button
        type="submit"
        disabled={!ready}
        className="self-end rounded-full bg-primary px-6 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        data-testid="create-project-btn"
      >
        {busy ? t('project.creating') : t('project.create')}
      </button>
    </form>
  );
}
