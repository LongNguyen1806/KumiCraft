import {
  DEFAULT_DESIGN_DIRS,
  type DesignDirs,
  normalizeDesignDirs,
  type ResolvedDesignDirs,
  type StyleFiles,
} from '@kumicraft/shared';
import { ArrowUp, X } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DirInputWithPicker } from '../files/dir-input-with-picker.tsx';
import {
  type DirsKind,
  executeSaveDesignDirs,
  toInitialList,
  useDirListMutations,
} from './design-dirs-helpers.ts';

export type DesignDirsFormProps = {
  readonly designDirs?: DesignDirs | ResolvedDesignDirs | undefined;
  readonly styleFiles?: StyleFiles | undefined;
  readonly onSaved?: ((updated: DesignDirs, styleFiles?: StyleFiles) => void) | undefined;
};

function useInitialDirLists(designDirs?: DesignDirs | ResolvedDesignDirs) {
  const normalized = normalizeDesignDirs(designDirs);
  const [pages, setPages] = useState<string[]>(() =>
    toInitialList(normalized.pages, DEFAULT_DESIGN_DIRS.pages),
  );
  const [layouts, setLayouts] = useState<string[]>(() =>
    toInitialList(normalized.layouts, DEFAULT_DESIGN_DIRS.layouts),
  );
  const [components, setComponents] = useState<string[]>(() =>
    toInitialList(normalized.components, DEFAULT_DESIGN_DIRS.components),
  );
  return { pages, setPages, layouts, setLayouts, components, setComponents };
}

function useDesignDirsState(
  designDirs?: DesignDirs | ResolvedDesignDirs,
  styleFiles?: StyleFiles,
  onSaved?: (updated: DesignDirs, styleFiles?: StyleFiles) => void,
) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const { pages, setPages, layouts, setLayouts, components, setComponents } =
    useInitialDirLists(designDirs);
  const [newCssDir, setNewCssDir] = useState<string>(styleFiles?.newCssDir ?? '');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [successMsg, setSuccessMsg] = useState<string | undefined>();
  const mutations = useDirListMutations(setPages, setLayouts, setComponents);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(undefined);
    setSuccessMsg(undefined);
    try {
      const res = await executeSaveDesignDirs(
        pages,
        layouts,
        components,
        newCssDir,
        styleFiles,
        tError,
        onSaved,
      );
      if (res.error) setErrorMsg(res.error);
      if (res.success) setSuccessMsg(t('project.designDirs.saved'));
    } finally {
      setBusy(false);
    }
  };

  return {
    pages,
    layouts,
    components,
    newCssDir,
    setNewCssDir,
    busy,
    errorMsg,
    successMsg,
    handleSubmit,
    ...mutations,
  };
}

function DirItemActions({
  kind,
  sIdx,
  idx,
  busy,
  canRemove,
  onRemove,
  onMoveTop,
}: {
  readonly kind: DirsKind;
  readonly sIdx: string;
  readonly idx: number;
  readonly busy: boolean;
  readonly canRemove: boolean;
  readonly onRemove: (k: DirsKind, idx: number) => void;
  readonly onMoveTop: (k: DirsKind, idx: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        data-testid={`design-dirs-${kind}-${sIdx}-top`}
        disabled={busy || idx === 0}
        onClick={() => {
          onMoveTop(kind, idx);
        }}
        className="rounded border border-border px-1.5 py-1 text-[10px] text-ink-soft hover:text-ink disabled:opacity-40"
        title={t('project.designDirs.moveUp')}
      >
        <ArrowUp className="size-3" />
      </button>
      <button
        type="button"
        data-testid={`design-dirs-${kind}-${sIdx}-remove`}
        disabled={busy || !canRemove}
        onClick={() => {
          onRemove(kind, idx);
        }}
        className="rounded border border-border px-1.5 py-1 text-[10px] text-ink-soft hover:text-danger disabled:opacity-40"
        title={t('project.designDirs.remove')}
      >
        <X className="size-3" />
      </button>
    </>
  );
}

function DirListItemRow({
  kind,
  item,
  idx,
  busy,
  canRemove,
  onRemove,
  onMoveTop,
  onUpdate,
}: {
  readonly kind: DirsKind;
  readonly item: string;
  readonly idx: number;
  readonly busy: boolean;
  readonly canRemove: boolean;
  readonly onRemove: (k: DirsKind, idx: number) => void;
  readonly onMoveTop: (k: DirsKind, idx: number) => void;
  readonly onUpdate: (k: DirsKind, idx: number, val: string) => void;
}) {
  const sIdx = String(idx);
  return (
    <div className="flex items-center gap-1.5">
      <DirInputWithPicker
        dataTestId={`design-dirs-${kind}-${sIdx}`}
        disabled={busy}
        value={item}
        onChange={(val) => {
          onUpdate(kind, idx, val);
        }}
        className="min-w-0 flex-1"
      />
      <DirItemActions
        kind={kind}
        sIdx={sIdx}
        idx={idx}
        busy={busy}
        canRemove={canRemove}
        onRemove={onRemove}
        onMoveTop={onMoveTop}
      />
    </div>
  );
}

function DirListHeader({
  kind,
  label,
  busy,
  itemsCount,
  onAdd,
}: {
  readonly kind: DirsKind;
  readonly label: string;
  readonly busy: boolean;
  readonly itemsCount: number;
  readonly onAdd: (k: DirsKind) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <span className="font-medium text-ink-soft">{label}</span>
      <button
        type="button"
        data-testid={`design-dirs-${kind}-add`}
        disabled={busy || itemsCount >= 10}
        onClick={() => {
          onAdd(kind);
        }}
        className="text-[11px] text-primary hover:underline disabled:opacity-50"
      >
        {t('project.designDirs.addDir')}
      </button>
    </div>
  );
}

function DirListSection({
  kind,
  label,
  items,
  busy,
  onAdd,
  onRemove,
  onMoveTop,
  onUpdate,
}: {
  readonly kind: DirsKind;
  readonly label: string;
  readonly items: readonly string[];
  readonly busy: boolean;
  readonly onAdd: (k: DirsKind) => void;
  readonly onRemove: (k: DirsKind, idx: number) => void;
  readonly onMoveTop: (k: DirsKind, idx: number) => void;
  readonly onUpdate: (k: DirsKind, idx: number, val: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <DirListHeader
        kind={kind}
        label={label}
        busy={busy}
        itemsCount={items.length}
        onAdd={onAdd}
      />
      <div className="flex flex-col gap-1">
        {items.map((item, idx) => (
          <DirListItemRow
            key={String(idx)}
            kind={kind}
            item={item}
            idx={idx}
            busy={busy}
            canRemove={items.length > 1}
            onRemove={onRemove}
            onMoveTop={onMoveTop}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}

function NewCssDirSection({
  busy,
  value,
  onChange,
}: {
  readonly busy: boolean;
  readonly value: string;
  readonly onChange: (val: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-2">
      <span className="font-medium text-ink-soft">{t('project.designDirs.newCssDir')}</span>
      <DirInputWithPicker
        dataTestId="style-files-new-css-dir"
        disabled={busy}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function FormStatusMessages({
  errorMsg,
  successMsg,
}: {
  readonly errorMsg?: string | undefined;
  readonly successMsg?: string | undefined;
}) {
  return (
    <>
      {errorMsg !== undefined && (
        <div role="alert" className="text-xs text-rose-600">
          {errorMsg}
        </div>
      )}
      {successMsg !== undefined && (
        <div className="text-xs text-emerald-600 dark:text-emerald-400">{successMsg}</div>
      )}
    </>
  );
}

function DesignDirsSectionsGrid({
  state,
}: {
  readonly state: ReturnType<typeof useDesignDirsState>;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4">
      <DirListSection
        kind="pages"
        label={t('project.designDirs.pages')}
        items={state.pages}
        busy={state.busy}
        onAdd={state.addDir}
        onRemove={state.removeDir}
        onMoveTop={state.moveToTop}
        onUpdate={state.updateDir}
      />
      <DirListSection
        kind="layouts"
        label={t('project.designDirs.layouts')}
        items={state.layouts}
        busy={state.busy}
        onAdd={state.addDir}
        onRemove={state.removeDir}
        onMoveTop={state.moveToTop}
        onUpdate={state.updateDir}
      />
      <DirListSection
        kind="components"
        label={t('project.designDirs.components')}
        items={state.components}
        busy={state.busy}
        onAdd={state.addDir}
        onRemove={state.removeDir}
        onMoveTop={state.moveToTop}
        onUpdate={state.updateDir}
      />
    </div>
  );
}

export function DesignDirsForm({ designDirs, styleFiles, onSaved }: DesignDirsFormProps) {
  const { t } = useTranslation();
  const state = useDesignDirsState(designDirs, styleFiles, onSaved);

  return (
    <form
      onSubmit={(e) => {
        void state.handleSubmit(e);
      }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-field/40 p-3 text-xs"
    >
      <div className="font-medium text-ink">{t('project.designDirs.title')}</div>
      <p className="text-xs text-ink-soft">{t('project.designDirs.hint')}</p>

      <DesignDirsSectionsGrid state={state} />

      <NewCssDirSection busy={state.busy} value={state.newCssDir} onChange={state.setNewCssDir} />
      <FormStatusMessages errorMsg={state.errorMsg} successMsg={state.successMsg} />

      <button
        data-testid="design-dirs-save"
        type="submit"
        disabled={state.busy}
        className="self-end rounded-lg bg-charcoal px-3 py-1.5 text-xs text-on-charcoal disabled:opacity-50"
      >
        {t('project.designDirs.save')}
      </button>
    </form>
  );
}
