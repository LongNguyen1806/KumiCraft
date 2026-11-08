// Project name and package manager fields, and the "create here" form of an empty folder.
import type { PackageManager } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const PACKAGE_MANAGERS: readonly PackageManager[] = ['pnpm', 'npm', 'yarn'];

type NameAndManagerProps = {
  readonly name: string;
  readonly nameOk: boolean;
  readonly pm: PackageManager;
  readonly onName: (name: string) => void;
  readonly onPm: (pm: PackageManager) => void;
};

export function NameAndManager({ name, nameOk, pm, onName, onPm }: NameAndManagerProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[2fr_1fr] gap-2">
      <label className="grid gap-1">
        <span className="text-[11px] text-ink-faint">{t('project.projectName')}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            onName(e.target.value);
          }}
          aria-invalid={!nameOk}
          className="w-full rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink focus:outline-none"
          data-testid="create-project-name"
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[11px] text-ink-faint">{t('project.packageManager')}</span>
        <select
          value={pm}
          onChange={(e) => {
            const picked = PACKAGE_MANAGERS.find((option) => option === e.target.value);
            if (picked !== undefined) onPm(picked);
          }}
          className="w-full rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink focus:outline-none"
          data-testid="create-project-pm"
        >
          {PACKAGE_MANAGERS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export type CreateHereFormProps = {
  readonly busy: boolean;
  /** The empty (or not yet made) folder the project goes in. */
  readonly location: string;
  readonly onCreate: (targetPath: string, name: string, pm: PackageManager) => void;
};

/** Opening an empty folder offers a project right in it (the folder `kumicraft` was run in). */
export function CreateHereForm({ busy, location, onCreate }: CreateHereFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('my-app');
  const [pm, setPm] = useState<PackageManager>('pnpm');
  const nameOk = name.trim() !== '';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (nameOk) onCreate(location, name.trim(), pm);
      }}
      className="flex flex-col gap-3"
      data-testid="create-project-form"
    >
      <span className="font-medium text-ink">{t('project.emptyFolder')}</span>
      <NameAndManager name={name} nameOk={nameOk} pm={pm} onName={setName} onPm={setPm} />
      <p
        className="font-mono text-[11px] break-all text-ink-soft"
        data-testid="create-project-target"
      >
        {t('project.createsIn', { path: location })}
      </p>
      <button
        type="submit"
        disabled={busy || !nameOk}
        className="self-end rounded-full bg-primary px-5 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        data-testid="create-project-btn"
      >
        {busy ? t('project.creating') : t('project.create')}
      </button>
    </form>
  );
}
