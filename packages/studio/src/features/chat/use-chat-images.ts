// Image attachments management for chat panel (R-CH-02, CW-52).
import type { ChatImageKind } from '@reactcraft/shared';
import type { TFunction } from 'i18next';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { uploadChatImage } from '../../api/agent-client.ts';
import { type ErrorInfo, errorText, toErrorInfo } from '../../routes/error-text.ts';
import { type ChatImageAttachment, useChatStore } from './chat-store.ts';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 5;

const MIME_TO_KIND: Readonly<Record<string, ChatImageKind>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

let localIdCounter = 0;
function nextLocalId(): string {
  localIdCounter += 1;
  return `img_${String(localIdCounter)}_${String(Date.now())}`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

function validateFile(
  file: File,
  currentCount: number,
  t: TFunction<'chat'>,
): { kind?: ChatImageKind; error?: string } {
  if (currentCount >= MAX_IMAGES) return { error: t('image.maxImages') };
  const kind = MIME_TO_KIND[file.type];
  if (kind === undefined) return { error: t('image.notAnImage') };
  if (file.size > MAX_IMAGE_BYTES) return { error: t('image.tooLarge') };
  return { kind };
}

async function uploadSingleFile(
  file: File,
  kind: ChatImageKind,
  localId: string,
  previewUrl: string,
  addImage: (img: ChatImageAttachment) => void,
  updateImage: (localId: string, patch: Partial<ChatImageAttachment>) => void,
  removeImage: (localId: string) => void,
): Promise<ErrorInfo | undefined> {
  addImage({ localId, previewUrl, state: 'uploading' });
  try {
    const base64 = await readFileAsBase64(file);
    const res = await uploadChatImage(kind, base64);
    updateImage(localId, { id: res.id, state: 'ready' });
    return undefined;
  } catch (err) {
    URL.revokeObjectURL(previewUrl);
    removeImage(localId);
    return toErrorInfo(err);
  }
}

function revokeAndRemove(localId: string, removeImage: (id: string) => void): void {
  const item = useChatStore.getState().images.find((img) => img.localId === localId);
  if (item !== undefined) {
    URL.revokeObjectURL(item.previewUrl);
    removeImage(localId);
  }
}

async function processFileList(
  files: FileList | readonly File[],
  processFile: (file: File) => Promise<void>,
  onStart: () => void,
): Promise<void> {
  onStart();
  for (const file of Array.from(files)) {
    await processFile(file);
  }
}

async function uploadAndRecordFile(
  file: File,
  tChat: TFunction<'chat'>,
  tError: TFunction<'errors'>,
  onError: (msg: string) => void,
  addImage: (img: ChatImageAttachment) => void,
  updateImage: (localId: string, patch: Partial<ChatImageAttachment>) => void,
  removeImage: (localId: string) => void,
): Promise<void> {
  const val = validateFile(file, useChatStore.getState().images.length, tChat);
  if (val.error !== undefined) {
    onError(val.error);
    return;
  }
  if (val.kind === undefined) return;

  const previewUrl = URL.createObjectURL(file);
  const errInfo = await uploadSingleFile(
    file,
    val.kind,
    nextLocalId(),
    previewUrl,
    addImage,
    updateImage,
    removeImage,
  );
  if (errInfo !== undefined) {
    onError(errorText(tError, errInfo.code, errInfo.params));
  }
}

export function useChatImages() {
  const { t } = useTranslation('chat');
  const { t: tError } = useTranslation('errors');
  const imageError = useChatStore((s) => s.imageError);
  const setImageError = useChatStore((s) => s.setImageError);
  const images = useChatStore((s) => s.images);
  const addImage = useChatStore((s) => s.addImage);
  const updateImage = useChatStore((s) => s.updateImage);
  const removeImage = useChatStore((s) => s.removeImage);

  const processFile = useCallback(
    (file: File) =>
      uploadAndRecordFile(file, t, tError, setImageError, addImage, updateImage, removeImage),
    [addImage, removeImage, setImageError, t, tError, updateImage],
  );

  return {
    images,
    isUploading: images.some((img) => img.state === 'uploading'),
    imageError,
    clearError: () => {
      setImageError(undefined);
    },
    addFiles: useCallback(
      (files: FileList | readonly File[]) =>
        processFileList(files, processFile, () => {
          setImageError(undefined);
        }),
      [processFile, setImageError],
    ),
    removeAttachment: useCallback(
      (localId: string) => {
        revokeAndRemove(localId, removeImage);
      },
      [removeImage],
    ),
  };
}
