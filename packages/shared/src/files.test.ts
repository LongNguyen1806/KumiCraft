import { describe, expect, it } from 'vitest';

import {
  FileCreateSchema,
  FileDeleteSchema,
  FileImportersSchema,
  FileRenameSchema,
  FileTreeEntrySchema,
  FileTreeListingSchema,
} from './files.ts';

describe('files schemas [WP-4.00]', () => {
  it('validates FileTreeEntrySchema and FileTreeListingSchema', () => {
    const entry = {
      name: '.env',
      path: '.env',
      kind: 'file' as const,
      hidden: true,
    };
    expect(FileTreeEntrySchema.safeParse(entry).success).toBe(true);

    const listing = {
      dir: '',
      entries: [entry],
      truncated: false,
    };
    expect(FileTreeListingSchema.safeParse(listing).success).toBe(true);
  });

  it('validates FileCreateSchema, FileRenameSchema, FileDeleteSchema', () => {
    expect(FileCreateSchema.safeParse({ path: 'src/New.tsx', kind: 'file' }).success).toBe(true);
    expect(FileRenameSchema.safeParse({ from: 'src/A.tsx', to: 'src/B.tsx' }).success).toBe(true);
    expect(FileDeleteSchema.safeParse({ path: 'src/A.tsx' }).success).toBe(true);

    expect(FileCreateSchema.safeParse({ path: '/root.tsx', kind: 'file' }).success).toBe(false);
  });

  it('validates FileImportersSchema', () => {
    expect(
      FileImportersSchema.safeParse({
        importers: ['src/App.tsx', 'src/Main.tsx'],
        truncated: false,
      }).success,
    ).toBe(true);
  });
});
