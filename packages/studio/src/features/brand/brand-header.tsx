import { type StyleSystemId, tokenFileExtensions } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { patchProject } from '../../api/project-client.ts';
import { useProjectInfo, useProjectStore } from '../../core/project-store.ts';
import { FolderPicker } from '../files/folder-picker.tsx';
import { useThemeStore } from '../inspector/use-project-theme.ts';

async function updateTokenFile(
  project: ReturnType<typeof useProjectInfo>,
  tokenFile: string | undefined,
) {
  try {
    const info = await patchProject({
      styleFiles: { ...project?.styleFiles, tokenFile },
    });
    useProjectStore.getState().setProject(info);
    void useThemeStore.getState().load();
  } catch {
    // Ignore errors
  }
}

function BrandAutoButton({ project }: { readonly project: ReturnType<typeof useProjectInfo> }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="brand-auto-file"
      onClick={() => {
        void updateTokenFile(project, undefined);
      }}
      className="h-6 rounded-md border border-line bg-card-solid px-1.5 text-[11px] text-ink-soft hover:bg-field hover:text-ink"
    >
      {t('brand.autoTokenFile')}
    </button>
  );
}

function BrandFileSelector({
  system,
  file,
  project,
}: {
  readonly system: StyleSystemId;
  readonly file: string;
  readonly project: ReturnType<typeof useProjectInfo>;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasCustom = Boolean(project?.styleFiles?.tokenFile);
  const extensions = tokenFileExtensions(system);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid="brand-change-file"
          onClick={() => {
            setPickerOpen(true);
          }}
          className="h-6 rounded-md border border-line bg-card-solid px-1.5 text-[11px] text-ink hover:bg-field"
        >
          {t('brand.changeTokenFile')}
        </button>
        {hasCustom && <BrandAutoButton project={project} />}
      </div>
      {pickerOpen && (
        <FolderPicker
          open={pickerOpen}
          mode="file"
          extensions={extensions}
          initial={file}
          onPick={(p) => {
            void updateTokenFile(project, p);
          }}
          onClose={() => {
            setPickerOpen(false);
          }}
        />
      )}
    </>
  );
}

type BrandHeaderProps = {
  readonly system: StyleSystemId;
  readonly file: string;
};

export function BrandHeader({ system, file }: BrandHeaderProps) {
  const { t } = useTranslation();
  const project = useProjectInfo();

  return (
    <div
      data-testid="brand-header"
      className="flex flex-col gap-1 border-b border-border pb-2 text-xs"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink" data-testid="brand-system-name">
          {t(`brand.system.${system}`, { defaultValue: system })}
        </span>
        {system !== 'tailwind3' && (
          <BrandFileSelector system={system} file={file} project={project} />
        )}
      </div>
      <span className="font-mono text-ink-faint" data-testid="brand-file-path">
        {file}
      </span>
    </div>
  );
}
