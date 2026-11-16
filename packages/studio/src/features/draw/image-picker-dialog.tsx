// Image picker dialog (WP-2.09a, R-DT-13, R-DT-14).
import type { ImageSource } from '@kumicraft/shared';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchAssets, fetchProjectImage } from '../../api/assets-client.ts';
import { Dialog } from '../../components/ui/dialog.tsx';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function suggestAlt(fileName: string): string {
  const base = fileName.split('/').pop() ?? fileName;
  const lastDot = base.lastIndexOf('.');
  const nameWithoutExt = lastDot > 0 ? base.slice(0, lastDot) : base;
  const withSpaces = nameWithoutExt.replace(/[-_]+/g, ' ').trim();
  if (withSpaces.length === 0) return '';
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

export function relToSrc(filePath: string): string {
  return filePath.startsWith('public') ? filePath.slice('public'.length) : filePath;
}

export type ImagePickerDialogProps = {
  readonly open: boolean;
  /**
   * Only picks an image already in `public/` (a component's image knob): no upload, no alt, which
   * the component's own description knob holds.
   */
  readonly pickOnly?: boolean | undefined;
  readonly onClose: () => void;
  readonly onPick: (choice: { readonly image: ImageSource; readonly alt: string }) => void;
};

type ImageGridProps = {
  readonly files: readonly string[];
  readonly selectedSrc: string | undefined;
  readonly onSelectExisting: (file: string) => void;
  readonly emptyLabel: string;
};

/** A `blob:` URL of the image, or `undefined` when it cannot be read (no thumbnail then). */
async function thumbUrl(file: string): Promise<string | undefined> {
  try {
    return URL.createObjectURL(await fetchProjectImage(file));
  } catch {
    return undefined;
  }
}

/** A thumbnail of a public/ image, read through the Studio server (S-11): name only until it loads. */
export function ProjectThumb({ file, name }: { readonly file: string; readonly name: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let made: string | undefined;
    const isCancelled = () => cancelled;
    async function load(): Promise<void> {
      const next = await thumbUrl(file);
      if (next === undefined) return;
      if (isCancelled()) {
        URL.revokeObjectURL(next);
        return;
      }
      made = next;
      setUrl(next);
    }
    void load();
    return () => {
      cancelled = true;
      if (made !== undefined) URL.revokeObjectURL(made);
    };
  }, [file]);
  if (url === undefined) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded border border-border bg-field text-xs text-ink-soft">
        {name}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={suggestAlt(name)}
      className="h-16 w-16 rounded border border-border object-cover"
    />
  );
}

function ImageGrid({ files, selectedSrc, onSelectExisting, emptyLabel }: ImageGridProps) {
  if (files.length === 0) {
    return (
      <div className="max-h-56 overflow-y-auto rounded-md border border-border p-2">
        <div className="py-8 text-center text-sm text-ink-soft">{emptyLabel}</div>
      </div>
    );
  }
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border border-border p-2">
      <div className="grid grid-cols-4 gap-2">
        {files.map((file) => {
          const src = relToSrc(file);
          const isSelected = selectedSrc === src;
          const fileName = file.split('/').pop() ?? file;
          return (
            <button
              key={file}
              type="button"
              data-testid="image-picker-item"
              data-src={src}
              onClick={() => {
                onSelectExisting(file);
              }}
              className={`flex flex-col items-center gap-1 rounded-md p-1.5 text-center transition hover:bg-field ${
                isSelected ? 'bg-field ring-2 ring-primary' : ''
              }`}
            >
              <ProjectThumb file={file} name={fileName} />
              <span className="max-w-[70px] truncate text-xs text-ink">{fileName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type HeaderProps = {
  readonly allowUpload: boolean;
  readonly onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  readonly onTriggerUpload: () => void;
  readonly onRefChange: (el: HTMLInputElement | undefined) => void;
};

function ImageUploadHeader({
  allowUpload,
  onFileChange,
  onTriggerUpload,
  onRefChange,
}: HeaderProps) {
  const { t } = useTranslation();
  const title = (
    <span className="text-sm font-medium text-ink-soft">
      {t('imagePicker.projectImages', 'Ảnh trong dự án')}
    </span>
  );
  if (!allowUpload) return title;
  return (
    <div className="flex items-center justify-between">
      {title}
      <button
        type="button"
        data-testid="image-picker-upload"
        onClick={onTriggerUpload}
        className="rounded-md bg-field px-3 py-1.5 text-sm font-medium text-ink hover:bg-field-hover"
      >
        {t('imagePicker.upload', 'Tải ảnh từ máy')}
      </button>
      <input
        ref={(el) => {
          onRefChange(el ?? undefined);
        }}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  );
}

type AltInputProps = {
  readonly alt: string;
  readonly onChange: (alt: string) => void;
  readonly label: string;
  readonly placeholder: string;
};

function ImageAltInput({ alt, onChange, label, placeholder }: AltInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="image-picker-alt-input" className="text-xs font-medium text-ink-soft">
        {label} <span className="text-danger">*</span>
      </label>
      <input
        id="image-picker-alt-input"
        data-testid="image-picker-alt"
        type="text"
        value={alt}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        className="rounded-md border border-border bg-field px-3 py-1.5 text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}

type ActionsProps = {
  readonly cancelLabel: string;
  readonly insertLabel: string;
  readonly canInsert: boolean;
  readonly onClose: () => void;
  readonly onInsert: () => void;
};

function ImageDialogActions({
  cancelLabel,
  insertLabel,
  canInsert,
  onClose,
  onInsert,
}: ActionsProps) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        data-testid="image-picker-cancel"
        onClick={onClose}
        className="rounded-md border border-border px-4 py-1.5 text-sm text-ink-soft hover:text-ink"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        data-testid="image-picker-insert"
        disabled={!canInsert}
        onClick={onInsert}
        className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-on-charcoal hover:bg-primary-hover disabled:opacity-40"
      >
        {insertLabel}
      </button>
    </div>
  );
}

function readUploadedImage(file: File, onDone: (dataBase64: string) => void): void {
  const reader = new FileReader();
  reader.onload = () => {
    const res = typeof reader.result === 'string' ? reader.result : '';
    const commaIdx = res.indexOf(',');
    const dataBase64 = commaIdx >= 0 ? res.slice(commaIdx + 1) : res;
    onDone(dataBase64);
  };
  reader.readAsDataURL(file);
}

function useImagePickerState(open: boolean, tooLargeMessage: string) {
  const [files, setFiles] = useState<readonly string[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageSource | undefined>(undefined);
  const [alt, setAlt] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const assets = await fetchAssets();
        setFiles(assets.files);
      } catch {
        setFiles([]);
      }
    };
    void load();
  }, [open]);

  const reset = () => {
    setSelectedImage(undefined);
    setAlt('');
    setError(undefined);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError(tooLargeMessage);
      return;
    }
    readUploadedImage(file, (dataBase64) => {
      setSelectedImage({ kind: 'upload', name: file.name, dataBase64 });
      setAlt(suggestAlt(file.name));
      setError(undefined);
    });
  };

  const selectExisting = (file: string) => {
    setSelectedImage({ kind: 'existing', src: relToSrc(file) });
    setAlt(suggestAlt(file));
    setError(undefined);
  };

  return { files, selectedImage, alt, error, setAlt, reset, handleFileChange, selectExisting };
}

function ImageErrorAlert({ error }: { readonly error?: string | undefined }) {
  if (error === undefined) return undefined;
  return (
    <div
      data-testid="image-picker-error"
      className="rounded-md bg-danger/10 p-2 text-sm text-danger dark:bg-danger/10"
    >
      {error}
    </div>
  );
}

function ImageSelectedBadge({ name }: { readonly name?: string | undefined }) {
  const { t } = useTranslation();
  if (name === undefined) return undefined;
  return (
    <div className="text-sm text-primary">
      {t('imagePicker.selectedUpload', 'Đã chọn tải lên:')} {name}
    </div>
  );
}

type FormProps = {
  readonly pickOnly: boolean;
  readonly files: readonly string[];
  readonly selectedSrc?: string | undefined;
  readonly uploadName?: string | undefined;
  readonly canInsert: boolean;
  readonly alt: string;
  readonly error?: string | undefined;
  readonly onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  readonly onTriggerUpload: () => void;
  readonly onRefChange: (el: HTMLInputElement | undefined) => void;
  readonly onSelectExisting: (file: string) => void;
  readonly onAltChange: (alt: string) => void;
  readonly onClose: () => void;
  readonly onInsert: () => void;
};

function ImagePickerForm(props: FormProps) {
  const { t } = useTranslation();

  return (
    <div data-testid="image-picker" className="flex flex-col gap-4">
      <ImageUploadHeader
        allowUpload={!props.pickOnly}
        onFileChange={props.onFileChange}
        onTriggerUpload={props.onTriggerUpload}
        onRefChange={props.onRefChange}
      />
      <ImageErrorAlert error={props.error} />
      <ImageGrid
        files={props.files}
        selectedSrc={props.selectedSrc}
        onSelectExisting={props.onSelectExisting}
        emptyLabel={t('imagePicker.empty', 'Chưa có ảnh trong public/')}
      />
      <ImageSelectedBadge name={props.uploadName} />
      {!props.pickOnly && (
        <ImageAltInput
          alt={props.alt}
          onChange={props.onAltChange}
          label={t('imagePicker.alt', 'Mô tả ảnh (alt)')}
          placeholder={t('imagePicker.altPlaceholder', 'Nhập mô tả ảnh…')}
        />
      )}
      <ImageDialogActions
        cancelLabel={t('imagePicker.cancel', 'Hủy')}
        insertLabel={
          props.pickOnly ? t('imagePicker.pick', 'Chọn') : t('imagePicker.insert', 'Chèn')
        }
        canInsert={props.canInsert}
        onClose={props.onClose}
        onInsert={props.onInsert}
      />
    </div>
  );
}

export function ImagePickerDialog({
  open,
  pickOnly = false,
  onClose,
  onPick,
}: ImagePickerDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | undefined>(undefined);

  const { files, selectedImage, alt, error, setAlt, reset, handleFileChange, selectExisting } =
    useImagePickerState(open, t('imagePicker.tooLarge', 'Ảnh vượt quá 5 MB'));

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleInsert = () => {
    if (selectedImage === undefined || (!pickOnly && alt.trim().length === 0)) return;
    onPick({ image: selectedImage, alt: alt.trim() });
    handleClose();
  };

  return (
    <Dialog
      open={open}
      title={t('imagePicker.title', 'Chọn ảnh')}
      closeLabel={t('imagePicker.cancel', 'Hủy')}
      onClose={handleClose}
    >
      <ImagePickerForm
        pickOnly={pickOnly}
        files={files}
        selectedSrc={selectedImage?.kind === 'existing' ? selectedImage.src : undefined}
        uploadName={selectedImage?.kind === 'upload' ? selectedImage.name : undefined}
        canInsert={selectedImage !== undefined && (pickOnly || alt.trim().length > 0)}
        alt={alt}
        error={error}
        onFileChange={handleFileChange}
        onTriggerUpload={() => {
          fileInputRef.current?.click();
        }}
        onRefChange={(el) => {
          fileInputRef.current = el;
        }}
        onSelectExisting={selectExisting}
        onAltChange={setAlt}
        onClose={handleClose}
        onInsert={handleInsert}
      />
    </Dialog>
  );
}
