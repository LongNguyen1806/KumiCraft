// Tag attribute edit hook for Inspector (SPEC-04 R-IN-18, FR-25; SPEC-03 R-SE-04..06).
import { type EditableAttr, type SetAttributeEdit } from '@kumicraft/shared';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/http.ts';
import { sendEdit, sendEdits } from '../../core/edits.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import type { InspectorTarget } from './types.ts';

export type AttributeEditState = {
  readonly isSaving: boolean;
  readonly error?: string | undefined;
  readonly setAttribute: (name: EditableAttr, value: string | undefined) => void;
};

function buildAttributeSaveEdits(
  source: NonNullable<Extract<InspectorTarget, { readonly kind: 'element' }>['source']>,
  name: EditableAttr,
  value: string | undefined,
): SetAttributeEdit[] | undefined {
  const current = source.attributes[name];
  if (current?.kind === 'expression') return undefined;
  const before = current?.kind === 'static' ? current.value : undefined;
  if (before === value) return undefined;
  const mainEdit: SetAttributeEdit = {
    kind: 'setAttribute',
    loc: source.loc,
    tag: source.tag,
    name,
    before,
    after: value,
  };
  if (name !== 'target' || value !== '_blank') return [mainEdit];
  const relEntry = source.attributes['rel'];
  const relBefore = relEntry?.kind === 'static' ? relEntry.value : undefined;
  const needsRel =
    relEntry?.kind !== 'expression' &&
    (relBefore === undefined ||
      !relBefore.includes('noopener') ||
      !relBefore.includes('noreferrer'));
  if (!needsRel) return [mainEdit];
  return [
    mainEdit,
    {
      kind: 'setAttribute',
      loc: source.loc,
      tag: source.tag,
      name: 'rel',
      before: relBefore,
      after: 'noopener noreferrer',
    },
  ];
}

export function useAttributeEdit(
  target: Extract<InspectorTarget, { readonly kind: 'element' }>,
): AttributeEditState {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const { source, refresh } = target;

  const save = useCallback(
    async (name: EditableAttr, value: string | undefined) => {
      if (source === undefined) return;
      const edits = buildAttributeSaveEdits(source, name, value);
      if (edits === undefined) return;
      setIsSaving(true);
      try {
        if (edits.length === 1 && edits[0] !== undefined) await sendEdit({ edit: edits[0] });
        else await sendEdits({ edits });
        setError(undefined);
        refresh();
      } catch (err) {
        const isConflict = err instanceof ApiError && err.code === 'E017';
        // The server's reason, in words, so a refused edit says why (not only "failed").
        const info = toErrorInfo(err);
        setError(
          isConflict
            ? t('inspector.errors.sourceConflict')
            : `${t('inspector.errors.editFailed')}: ${errorText(tError, info.code, info.params)}`,
        );
        if (isConflict) refresh();
      } finally {
        setIsSaving(false);
      }
    },
    [source, refresh, t, tError],
  );

  const setAttribute = useCallback(
    (name: EditableAttr, value: string | undefined) => {
      void save(name, value);
    },
    [save],
  );

  return { isSaving, error, setAttribute };
}
