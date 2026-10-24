// Tag attribute edit hook for Inspector (SPEC-04 R-IN-18, FR-25; SPEC-03 R-SE-04..06).
import type { EditableAttr } from '@kumicraft/shared';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../../api/http.ts';
import { editSource } from '../../api/source-client.ts';
import type { InspectorTarget } from './types.ts';

export type AttributeEditState = {
  readonly isSaving: boolean;
  readonly error?: string | undefined;
  readonly setAttribute: (name: EditableAttr, value: string | undefined) => void;
};

export function useAttributeEdit(
  target: Extract<InspectorTarget, { readonly kind: 'element' }>,
): AttributeEditState {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const { source, refresh } = target;

  const save = useCallback(
    async (name: EditableAttr, value: string | undefined) => {
      if (source === undefined) return;
      const current = source.attributes[name];
      if (current?.kind === 'expression') return;
      const before = current?.kind === 'static' ? current.value : undefined;
      if (before === value) return;

      setIsSaving(true);
      try {
        await editSource({
          edit: {
            kind: 'setAttribute',
            loc: source.loc,
            tag: source.tag,
            name,
            before,
            after: value,
          },
        });
        setError(undefined);
        refresh();
      } catch (err) {
        if (err instanceof ApiError && err.code === 'E017') {
          setError(t('inspector.errors.sourceConflict'));
          refresh();
        } else {
          setError(t('inspector.errors.editFailed'));
        }
      } finally {
        setIsSaving(false);
      }
    },
    [source, refresh, t],
  );

  const setAttribute = useCallback(
    (name: EditableAttr, value: string | undefined) => {
      void save(name, value);
    },
    [save],
  );

  return { isSaving, error, setAttribute };
}
