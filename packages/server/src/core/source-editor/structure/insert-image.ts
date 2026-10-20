// Insertion of existing or uploaded images into JSX structures (WP-2.09a, R-DT-13, R-DT-14).
import type { InsertEdit, InsertImageEdit, Result, StructureResult } from '@reactcraft/shared';
import { err } from '@reactcraft/shared';

import { computeBytesSha256 } from '../../history/history-file-io.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import {
  detectImageKind,
  imageBaseName,
  isUnsafeSvg,
  uniqueImagePath,
} from '../../project/images.ts';
import type { WrittenFile } from '../source-editor-service.ts';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const VALID_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);

function escapeJsxAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Every value lands inside a JSX string attribute, so each one is escaped: none can close it. */
export function buildImgJsx(src: string, alt: string, className: string): string {
  const classAttr = className.length > 0 ? ` className="${escapeJsxAttr(className)}"` : '';
  return `<img src="${escapeJsxAttr(src)}" alt="${escapeJsxAttr(alt)}"${classAttr} />`;
}

async function validateExistingImage(
  fs: FileSystemPort,
  root: string,
  src: string,
): Promise<Result<void>> {
  if (src.includes('..')) {
    return err({ code: 'E012', params: { path: src, reason: 'outsideRoot' } });
  }
  const ext = src.split('.').pop()?.toLowerCase();
  if (ext === undefined || !VALID_EXTENSIONS.has(ext)) {
    return err({ code: 'E016', params: { reason: 'imageNotFound' } });
  }
  const relPath = `public${src}`;
  const exists = await fs.exists(root, relPath);
  if (!exists) {
    return err({ code: 'E016', params: { reason: 'imageNotFound' } });
  }
  return { ok: true, value: undefined };
}

type PreparedUpload = {
  readonly bytes: Uint8Array;
  readonly relPath: string;
  readonly src: string;
};

async function prepareUploadImage(
  fs: FileSystemPort,
  root: string,
  name: string,
  dataBase64: string,
): Promise<Result<PreparedUpload>> {
  const buf = Buffer.from(dataBase64, 'base64');
  if (buf.length === 0 && dataBase64.length > 0) {
    return err({ code: 'E016', params: { reason: 'invalidImage' } });
  }
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    return err({ code: 'E016', params: { reason: 'tooLarge' } });
  }
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const kind = detectImageKind(bytes);
  if (!kind) {
    return err({ code: 'E016', params: { reason: 'unsupportedImage' } });
  }
  if (kind === 'svg' && isUnsafeSvg(new TextDecoder('utf8').decode(bytes))) {
    return err({ code: 'E016', params: { reason: 'unsafeSvg' } });
  }
  const base = imageBaseName(name);
  const relPath = await uniqueImagePath(fs, root, base, kind);
  const src = relPath.slice('public'.length);
  return { ok: true, value: { bytes, relPath, src } };
}

type InsertRunner = (
  insertEdit: InsertEdit,
  onWritten?: (files: readonly WrittenFile[]) => void,
) => Promise<Result<StructureResult>>;

async function executeInsertUpload(
  fs: FileSystemPort,
  projectRoot: string,
  edit: InsertImageEdit & { image: { kind: 'upload' } },
  runInsert: InsertRunner,
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<StructureResult>> {
  const prep = await prepareUploadImage(fs, projectRoot, edit.image.name, edit.image.dataBase64);
  if (!prep.ok) return prep;
  const { bytes, relPath, src } = prep.value;

  const writeImgRes = await fs.writeBytesAtomic(projectRoot, relPath, bytes);
  if (!writeImgRes.ok) return writeImgRes;

  const jsx = buildImgJsx(src, edit.alt, edit.className);
  let writtenCodeFiles: readonly WrittenFile[] = [];

  const runRes = await runInsert(
    {
      kind: 'insert',
      target: edit.target,
      jsx,
      placement: edit.placement,
      tailwindMajor: edit.tailwindMajor,
    },
    (files) => {
      writtenCodeFiles = files;
    },
  );

  if (!runRes.ok) {
    await fs.remove(projectRoot, relPath);
    return runRes;
  }

  const imgChange: WrittenFile = {
    path: relPath,
    after: edit.image.dataBase64,
    afterHash: computeBytesSha256(bytes),
    encoding: 'base64',
  };
  onWritten?.([...writtenCodeFiles, imgChange]);

  return runRes;
}

export async function executeInsertImage(
  fs: FileSystemPort,
  projectRoot: string,
  edit: InsertImageEdit,
  runInsert: InsertRunner,
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<StructureResult>> {
  if (edit.image.kind === 'existing') {
    const valid = await validateExistingImage(fs, projectRoot, edit.image.src);
    if (!valid.ok) return valid;
    const jsx = buildImgJsx(edit.image.src, edit.alt, edit.className);
    return runInsert(
      {
        kind: 'insert',
        target: edit.target,
        jsx,
        placement: edit.placement,
        tailwindMajor: edit.tailwindMajor,
      },
      onWritten,
    );
  }

  return executeInsertUpload(fs, projectRoot, { ...edit, image: edit.image }, runInsert, onWritten);
}
