import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createDraft } from '../../api/project-client.ts';
import { Dialog } from '../../components/ui/dialog.tsx';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';

export type NewDraftDialogProps = {
  readonly open: boolean;
  readonly projectId?: string | undefined;
  readonly onClose: () => void;
  readonly onCreated?: ((file: string) => void) | undefined;
};

type KindOptionProps = {
  readonly kind: 'blank' | 'free';
  readonly selected: 'blank' | 'free';
  readonly testId: string;
  readonly label: string;
  readonly onSelect: (kind: 'blank' | 'free') => void;
};

function KindOption({ kind, selected, testId, label, onSelect }: KindOptionProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
      <input
        type="radio"
        data-testid={testId}
        name="draft-kind"
        checked={selected === kind}
        onChange={() => {
          onSelect(kind);
        }}
      />
      <span>{label}</span>
    </label>
  );
}

type DraftFormFieldsProps = {
  readonly name: string;
  readonly kind: 'blank' | 'free';
  readonly busy: boolean;
  readonly onNameChange: (v: string) => void;
  readonly onKindChange: (k: 'blank' | 'free') => void;
};

function DraftFormFields({ name, kind, busy, onNameChange, onKindChange }: DraftFormFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        {t('pages.name')}
        <input
          data-testid="draft-name"
          type="text"
          disabled={busy}
          value={name}
          onChange={(e) => {
            onNameChange(e.target.value);
          }}
          placeholder={t('pages.namePlaceholder')}
          className="rounded border border-border bg-field px-2.5 py-1.5 text-xs text-ink disabled:opacity-50"
        />
      </label>
      <div className="flex gap-4">
        <KindOption
          kind="blank"
          selected={kind}
          testId="draft-kind-blank"
          label={t('drafts.blank')}
          onSelect={onKindChange}
        />
        <KindOption
          kind="free"
          selected={kind}
          testId="draft-kind-free"
          label={t('drafts.free')}
          onSelect={onKindChange}
        />
      </div>
    </div>
  );
}

function useNewDraftSubmit(
  projectId: string | undefined,
  onClose: () => void,
  onCreated?: (file: string) => void,
) {
  const { t: tError } = useTranslation('errors');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const openDraft = useCanvasViewStore((s) => s.openDraft);

  const submit = async (name: string, kind: 'blank' | 'free') => {
    setBusy(true);
    setErrorMsg(undefined);
    try {
      const res = await createDraft({
        name: name.trim() || undefined,
        free: kind === 'free',
      });
      if (res.draftFile !== undefined) {
        openDraft(res.draftFile, projectId);
        onCreated?.(res.draftFile);
      }
      onClose();
    } catch (err) {
      const info = toErrorInfo(err);
      setErrorMsg(errorText(tError, info.code, info.params));
    } finally {
      setBusy(false);
    }
  };

  return { busy, errorMsg, submit };
}

export function NewDraftDialog({ open, projectId, onClose, onCreated }: NewDraftDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'blank' | 'free'>('blank');
  const { busy, errorMsg, submit } = useNewDraftSubmit(projectId, onClose, onCreated);

  return (
    <Dialog open={open} title={t('drafts.new')} closeLabel={t('settings.close')} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(name, kind);
        }}
        data-testid="draft-new-dialog"
        className="flex flex-col gap-4"
      >
        <DraftFormFields
          name={name}
          kind={kind}
          busy={busy}
          onNameChange={setName}
          onKindChange={setKind}
        />
        {errorMsg !== undefined && (
          <div role="alert" className="text-xs text-danger">
            {errorMsg}
          </div>
        )}
        <button
          data-testid="draft-create"
          type="submit"
          disabled={busy}
          className="self-end h-7 rounded-md bg-charcoal px-3 text-xs font-medium text-on-charcoal hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? t('drafts.creating') : t('drafts.create')}
        </button>
      </form>
    </Dialog>
  );
}
