// Persistent variant selection per library block (TK-47).
import { resources } from '../../i18n/i18n.ts';

const STORAGE_PREFIX = 'kumicraft.libraryVariant.';

export type VariantKey = keyof (typeof resources.en.library)['variants'];

export const DEFAULT_VARIANT_KEYS: Readonly<Record<string, VariantKey>> = {
  'form.button': 'solid',
  'composite.card': 'bordered',
  'content.heading': 'headingMd',
  'composite.hero': 'centered',
  'content.placeholder-image': 'ratio169',
  'display.alert': 'info',
};

export function isVariantKey(key: string): key is VariantKey {
  return Object.hasOwn(resources.en.library.variants, key);
}

export function variantKeyFromLabelKey(labelKey: string): VariantKey | undefined {
  const raw = labelKey.replace(/^library:variants\./, '');
  return isVariantKey(raw) ? raw : undefined;
}

export function getSelectedVariant(blockId: string): string | undefined {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${blockId}`) ?? undefined;
    if (raw === undefined || raw === '' || raw === 'default') return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

export function setSelectedVariant(blockId: string, variantId: string | undefined): void {
  try {
    const key = `${STORAGE_PREFIX}${blockId}`;
    if (variantId === undefined || variantId === '' || variantId === 'default') {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, variantId);
    }
  } catch {
    // Ignore storage errors (private mode or disabled storage).
  }
}
