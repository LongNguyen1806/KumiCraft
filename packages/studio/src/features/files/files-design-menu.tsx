// Tree menu items that change project settings: design folders, new CSS folder, Brand token file
// (K3c, spec-log #73). A refused change shows its reason at the top of the Files panel.
import {
  type FileTreeEntry,
  isTokenFileFor,
  primarySystem,
  type ProjectInfo,
} from '@kumicraft/shared';
import { FileCode, FilePlus, FolderMinus, FolderPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { patchProject } from '../../api/project-client.ts';
import { useProjectStore } from '../../core/project-store.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useAddPageIntent } from '../pages/add-page-intent.ts';
import { activate } from '../shell/activity-store.ts';
import { useFilesStore } from './files-store.ts';
import { MenuItem } from './menu-item.tsx';

async function patchProjectStyleOrDesign(patch: Parameters<typeof patchProject>[0]) {
  useFilesStore.getState().setActionError(undefined);
  try {
    const info = await patchProject(patch);
    useProjectStore.getState().setProject(info);
  } catch (error: unknown) {
    useFilesStore.getState().setActionError(toErrorInfo(error));
  }
}

async function addDesignDir(
  project: ProjectInfo,
  kind: 'pages' | 'layouts' | 'components',
  dir: string,
) {
  await patchProjectStyleOrDesign({
    designDirs: { ...project.designDirs, [kind]: [...project.designDirs[kind], dir] },
  });
}

async function removeDesignDir(
  project: ProjectInfo,
  kind: 'pages' | 'layouts' | 'components',
  dir: string,
) {
  const kept = project.designDirs[kind].filter((d) => d !== dir);
  await patchProjectStyleOrDesign({ designDirs: { ...project.designDirs, [kind]: kept } });
}

async function setNewCssDir(project: ProjectInfo, dir: string) {
  await patchProjectStyleOrDesign({
    styleFiles: { ...project.styleFiles, newCssDir: dir },
  });
}

async function setTokenFile(project: ProjectInfo, file: string) {
  await patchProjectStyleOrDesign({
    styleFiles: { ...project.styleFiles, tokenFile: file },
  });
}

async function setRouterFile(file: string) {
  await patchProjectStyleOrDesign({
    routing: { file },
  });
}

const DIR_KINDS = [
  {
    kind: 'components',
    labelKey: 'files.useAsComponentDir',
    removeKey: 'files.removeFromComponentDir',
    testId: 'files-menu-use-components-dir',
  },
  {
    kind: 'pages',
    labelKey: 'files.useAsPageDir',
    removeKey: 'files.removeFromPageDir',
    testId: 'files-menu-use-pages-dir',
  },
  {
    kind: 'layouts',
    labelKey: 'files.useAsLayoutDir',
    removeKey: 'files.removeFromLayoutDir',
    testId: 'files-menu-use-layouts-dir',
  },
] as const;

/** "Use as … folder", or "Remove from … folders" when it already is one (never the last one). */
function DesignDirItem({
  dirKind,
  entry,
  project,
  onClose,
}: {
  readonly dirKind: (typeof DIR_KINDS)[number];
  readonly entry: FileTreeEntry;
  readonly project: ProjectInfo;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();
  const { kind, labelKey, removeKey, testId } = dirKind;
  const list = project.designDirs[kind];
  if (list.includes(entry.path)) {
    return (
      <MenuItem
        icon={<FolderMinus className="size-3.5" />}
        label={t(removeKey)}
        testId={testId.replace('-use-', '-remove-')}
        disabled={list.length === 1}
        onClick={() => {
          onClose();
          void removeDesignDir(project, kind, entry.path);
        }}
      />
    );
  }
  return (
    <MenuItem
      icon={<FolderPlus className="size-3.5" />}
      label={t(labelKey)}
      testId={testId}
      onClick={() => {
        onClose();
        void addDesignDir(project, kind, entry.path);
      }}
    />
  );
}

function FolderDesignDirsActions({
  entry,
  project,
  onClose,
}: {
  readonly entry: FileTreeEntry;
  readonly project: ProjectInfo;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      {DIR_KINDS.map((dirKind) => (
        <DesignDirItem
          key={dirKind.kind}
          dirKind={dirKind}
          entry={entry}
          project={project}
          onClose={onClose}
        />
      ))}
      <MenuItem
        icon={<FolderPlus className="size-3.5" />}
        label={t('files.setNewCssDir')}
        testId="files-menu-set-new-css-dir"
        onClick={() => {
          onClose();
          void setNewCssDir(project, entry.path);
        }}
      />
    </>
  );
}

export function FolderDesignActions({
  entry,
  project,
  onClose,
}: {
  readonly entry: FileTreeEntry;
  readonly project: ProjectInfo | undefined;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!project || entry.kind !== 'directory') return <></>;
  return (
    <>
      <MenuItem
        icon={<FilePlus className="size-3.5" />}
        label={t('files.addPageHere')}
        testId="files-menu-add-page"
        onClick={() => {
          onClose();
          activate('pages');
          useAddPageIntent.getState().setTargetDir(entry.path);
        }}
      />
      <FolderDesignDirsActions entry={entry} project={project} onClose={onClose} />
    </>
  );
}

export function FileTokenAction({
  entry,
  project,
  onClose,
}: {
  readonly entry: FileTreeEntry;
  readonly project: ProjectInfo | undefined;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!project || entry.kind !== 'file') return <></>;

  const isToken = isTokenFileFor(entry.path, primarySystem(project.support.styling));
  const isCodeFile = /\.(jsx|tsx|js|ts)$/.test(entry.path);
  if (!isToken && !isCodeFile) return <></>;

  return (
    <>
      {isToken ? (
        <MenuItem
          icon={<FileCode className="size-3.5" />}
          label={t('files.useAsTokenFile')}
          testId="files-menu-use-token-file"
          onClick={() => {
            onClose();
            void setTokenFile(project, entry.path);
          }}
        />
      ) : undefined}
      {isCodeFile ? (
        <MenuItem
          icon={<FileCode className="size-3.5" />}
          label={t('files.useAsRouterFile')}
          testId="files-menu-use-router-file"
          onClick={() => {
            onClose();
            void setRouterFile(entry.path);
          }}
        />
      ) : undefined}
    </>
  );
}

/** Why the last settings change from the tree was refused, until dismissed. */
export function FilesActionError() {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const error = useFilesStore((s) => s.actionError);
  if (error === undefined) return undefined;
  return (
    <div
      role="alert"
      data-testid="files-action-error"
      className="mx-2 mb-1 flex items-start gap-2 rounded bg-sun-soft px-2 py-1 text-ink"
    >
      <span className="min-w-0 flex-1">{errorText(tError, error.code, error.params)}</span>
      <button
        type="button"
        aria-label={t('files.dismissError')}
        onClick={() => {
          useFilesStore.getState().setActionError(undefined);
        }}
        className="shrink-0 text-ink-soft hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
