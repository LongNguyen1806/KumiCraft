import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PageEditDeps } from '../../../kernel/features.ts';
import { createHistoryService } from '../../../kernel/history/history-service.ts';
import { nodeFs, platform } from '../../../services/workspace/test-support.ts';
import {
  createPugDraft,
  deletePugDraft,
  duplicatePugDraft,
  listPugDrafts,
  promotePugDraft,
  renamePugDraft,
} from './drafts.ts';

describe('Pug drafts [Phase 3]', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'rc-pug-drafts-'));
    await mkdir(join(root, 'views/_drafts'), { recursive: true });
    await writeFile(join(root, '.gitignore'), 'views/_drafts\n');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const deps = (): PageEditDeps => ({
    fs: nodeFs,
    history: createHistoryService({ fs: nodeFs }),
    projectRoot: root,
    sourceDir: 'src',
    platform,
    language: 'js',
    designDirs: {
      pages: ['src/pages'],
      layouts: ['src/layouts'],
      components: ['src/components'],
      drafts: 'src/drafts',
    },
    styling: {
      systems: [{ id: 'tailwind', version: '4.0.0' }],
      editable: true,
      globalCss: ['public/style.css'],
    },
  });

  it('creates, lists, renames, duplicates, and deletes Pug drafts', async () => {
    const d = deps();
    const created = await createPugDraft(d, { name: 'Hero Banner', free: true });
    expect(created).toEqual({
      ok: true,
      value: {
        changed: true,
        files: ['views/_drafts/hero-banner.pug'],
        locs: [],
        draftFile: 'views/_drafts/hero-banner.pug',
      },
    });
    expect(await readFile(join(root, 'views/_drafts/hero-banner.pug'), 'utf8')).toContain(
      'div.relative.min-h-screen.w-full.bg-white(data-rc-free)',
    );

    const listed = await listPugDrafts(d);
    expect(listed).toEqual({
      ok: true,
      value: {
        dir: 'views/_drafts',
        ignored: true,
        drafts: [
          {
            name: 'HeroBanner',
            file: 'views/_drafts/hero-banner.pug',
            free: true,
            inUse: false,
          },
        ],
      },
    });

    const dup = await duplicatePugDraft(d, { file: 'views/_drafts/hero-banner.pug' });
    expect(dup.ok && dup.value.draftFile).toBe('views/_drafts/hero-banner-copy.pug');

    const renamed = await renamePugDraft(d, {
      file: 'views/_drafts/hero-banner-copy.pug',
      newName: 'Promo Card',
    });
    expect(renamed.ok && renamed.value.draftFile).toBe('views/_drafts/promo-card.pug');

    const deleted = await deletePugDraft(d, { file: 'views/_drafts/promo-card.pug' });
    expect(deleted.ok).toBe(true);
  });

  it('promotes a Pug draft to a component and optionally removes the draft (with Undo)', async () => {
    const d = deps();
    await createPugDraft(d, { name: 'PricingCard', free: false });

    const promoted = await promotePugDraft(d, {
      file: 'views/_drafts/pricing-card.pug',
      as: 'component',
      name: 'PricingCard',
      dir: 'views/components',
      fileName: 'pricing-card.pug',
      keepDraft: false,
    });
    expect(promoted).toEqual({
      ok: true,
      value: {
        changed: true,
        files: ['views/components/pricing-card.pug', 'views/_drafts/pricing-card.pug'],
        locs: [],
      },
    });
    expect(await nodeFs.exists(root, 'views/components/pricing-card.pug')).toBe(true);
    expect(await nodeFs.exists(root, 'views/_drafts/pricing-card.pug')).toBe(false);

    const undone = await d.history.undo(root);
    expect(undone.ok).toBe(true);
    expect(await nodeFs.exists(root, 'views/_drafts/pricing-card.pug')).toBe(true);
  });
});
