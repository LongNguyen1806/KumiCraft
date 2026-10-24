// Image discovery, classification, sanitization and paths (WP-2.09a, R-DT-13, R-DT-14).
import type { Result } from '@kumicraft/shared';
import { ok } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';

export type ImageKind = 'png' | 'jpg' | 'webp' | 'gif' | 'svg';

const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);

const MAX_PUBLIC_IMAGES = 500;

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff];

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return PNG_HEADER.every((b, i) => bytes[i] === b);
}

function isJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 3) return false;
  return JPEG_HEADER.every((b, i) => bytes[i] === b);
}

function isGif(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const isGif87 =
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    bytes[4] === 0x37 &&
    bytes[5] === 0x61;
  const isGif89 =
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    bytes[4] === 0x39 &&
    bytes[5] === 0x61;
  return isGif87 || isGif89;
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const isWebpTag =
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return isRiff && isWebpTag;
}

function isSvg(bytes: Uint8Array): boolean {
  try {
    const text = new TextDecoder('utf8').decode(bytes).trim();
    const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1).trim() : text;
    return (clean.startsWith('<?xml') || clean.startsWith('<svg')) && clean.includes('<svg');
  } catch {
    return false;
  }
}

/** Loại ảnh theo byte đầu (không tin đuôi file); không nhận ra → undefined. */
export function detectImageKind(bytes: Uint8Array): ImageKind | undefined {
  if (isPng(bytes)) return 'png';
  if (isJpeg(bytes)) return 'jpg';
  if (isGif(bytes)) return 'gif';
  if (isWebp(bytes)) return 'webp';
  if (isSvg(bytes)) return 'svg';
  return undefined;
}

/** SVG có <script, thuộc tính on…=, hoặc href/xlink:href javascript: → true. */
export function isUnsafeSvg(text: string): boolean {
  if (/<script/i.test(text)) return true;
  if (/\bon[a-z]+\s*=/i.test(text)) return true;
  if (/javascript\s*:/i.test(text)) return true;
  return false;
}

/** 'Ảnh Đẹp_01.PNG' → 'anh-dep-01'; rỗng → 'image'; tối đa 60 ký tự. */
export function imageBaseName(original: string): string {
  const lastDot = original.lastIndexOf('.');
  const withoutExt = lastDot > 0 ? original.slice(0, lastDot) : original;
  const normalized = withoutExt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const trimmed = normalized.slice(0, 60).replace(/-+$/, '');
  return trimmed.length > 0 ? trimmed : 'image';
}

/** public/images/<base>.<ext>, trùng thì <base>-2, -3… (kiểm bằng fs.exists). */
export async function uniqueImagePath(
  fs: FileSystemPort,
  root: string,
  base: string,
  kind: ImageKind,
): Promise<string> {
  const ext = kind;
  const candidate = `public/images/${base}.${ext}`;
  if (!(await fs.exists(root, candidate))) {
    return candidate;
  }
  for (let i = 2; ; i++) {
    const nextCandidate = `public/images/${base}-${String(i)}.${ext}`;
    if (!(await fs.exists(root, nextCandidate))) {
      return nextCandidate;
    }
  }
}

async function collectImages(
  fs: FileSystemPort,
  root: string,
  dir: string,
  acc: string[],
): Promise<void> {
  if (acc.length >= MAX_PUBLIC_IMAGES) return;
  const res = await fs.readDir(root, dir);
  if (!res.ok) return;

  for (const entry of res.value) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.kind === 'directory') {
      await collectImages(fs, root, rel, acc);
    } else {
      const ext = entry.name.split('.').pop()?.toLowerCase();
      if (ext !== undefined && IMAGE_EXTENSIONS.has(ext)) {
        acc.push(rel);
        if (acc.length >= MAX_PUBLIC_IMAGES) return;
      }
    }
  }
}

/** Ảnh trong public/ (đệ quy, bỏ node_modules và thư mục ẩn), đuôi png/jpg/jpeg/webp/gif/svg, tối đa 500, sắp theo tên. */
export async function listPublicImages(
  fs: FileSystemPort,
  root: string,
): Promise<Result<readonly string[]>> {
  const images: string[] = [];
  await collectImages(fs, root, 'public', images);
  images.sort((a, b) => a.localeCompare(b));
  return ok(images);
}
