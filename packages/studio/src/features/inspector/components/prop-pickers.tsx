// The image and link knobs of a component (thiet-ke-component.md §3, Đợt 2): an image is picked
// from the project's images with a thumbnail; a link is typed or picked from the project's pages.
import type { ComponentPropSpec, SetPropValue } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ImagePickerDialog, ProjectThumb } from '../../draw/image-picker-dialog.tsx';
import { usePagesData } from '../../editor/page-select.tsx';

/** What every prop control takes (prop-controls.tsx and the pickers here). */
export type PropControlProps = {
  readonly spec: ComponentPropSpec;
  readonly disabled: boolean;
  readonly onChange: (val: SetPropValue | undefined) => void;
  readonly onOpenEditor: () => void;
};

const SMALL_BUTTON =
  'shrink-0 rounded-md border border-line bg-field px-2 py-1 text-[11px] font-medium text-ink hover:bg-wash-cool disabled:opacity-50';

/** `/images/a.png` → `public/images/a.png`, the file the thumbnail reads; none for other URLs. */
function publicFileOf(spec: ComponentPropSpec): string | undefined {
  const src = typeof spec.value === 'string' ? spec.value : undefined;
  return src?.startsWith('/') === true && !src.startsWith('//') ? `public${src}` : undefined;
}

export function ImageField({ spec, disabled, onChange }: PropControlProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const file = publicFileOf(spec);
  const shown = spec.readonlyExpression ? spec.expression : spec.value;
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex min-w-0 items-center gap-2">
        {file !== undefined && <ProjectThumb file={file} name={file.split('/').pop() ?? file} />}
        <button
          type="button"
          data-testid={`prop-pick-image-${spec.name}`}
          disabled={disabled}
          className={SMALL_BUTTON}
          onClick={() => {
            setOpen(true);
          }}
        >
          {t('componentProps.pickImage')}
        </button>
      </span>
      {shown !== undefined && (
        <span className="truncate font-mono text-[10px] text-ink-faint" title={String(shown)}>
          {String(shown)}
          {spec.readonlyExpression && ` · ${t('componentProps.fromCode')}`}
        </span>
      )}
      <ImagePickerDialog
        open={open}
        pickOnly
        onClose={() => {
          setOpen(false);
        }}
        onPick={({ image }) => {
          if (image.kind === 'existing') onChange(image.src);
        }}
      />
    </span>
  );
}

/** The project's page paths, offered under a link field (typing any address still works). */
export function PageSuggestions({ id }: { readonly id: string }) {
  const { pages } = usePagesData();
  return (
    <datalist id={id}>
      {pages
        .filter((p) => !p.dynamic)
        .map((p) => (
          <option key={p.path} value={p.path}>
            {p.component ?? p.path}
          </option>
        ))}
    </datalist>
  );
}
