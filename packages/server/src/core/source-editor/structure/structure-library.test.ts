// Structural edits with Library Blocks: Scenario 11 and 12 (WP-2.03, R-LB-10..12, R-SE-22).
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LIBRARY_BLOCKS } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { directWriteFs, makeTempDir } from '../../workspace/test-support.ts';
import { parseJsxAst } from '../ast-helpers.ts';
import { createSourceEditorService } from '../source-editor-service.ts';
import { validateInsertedJsx } from './structure-ops.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../../..');

describe('M-SE: Library Blocks in Source Editor [WP-2.03]', () => {
  let tmpDir: string;
  let cleanupTemp: () => Promise<void>;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    const res = await makeTempDir();
    tmpDir = res.dir;
    cleanupTemp = res.cleanup;
    service = createSourceEditorService({ fs: directWriteFs }, { sourceDir: 'src' });
  });

  afterEach(async () => {
    await cleanupTemp();
  });

  it('#11 validates all 16 library blocks in vi and en [R-LB-10, R-LB-11, R-LB-12]', () => {
    expect(LIBRARY_BLOCKS).toHaveLength(16);

    for (const block of LIBRARY_BLOCKS) {
      for (const locale of ['vi', 'en'] as const) {
        const snippet = block.jsx[locale];
        const res = validateInsertedJsx(snippet);
        expect(res.ok).toBe(true);

        // No uppercase tags (no custom components)
        expect(/<[A-Z]/.test(snippet)).toBe(false);

        // No dynamic expressions
        expect(snippet.includes('{')).toBe(false);

        // No external links
        expect(snippet.includes('http:')).toBe(false);
        expect(snippet.includes('https:')).toBe(false);

        // img tags must have alt and svg data uri src
        if (snippet.includes('<img')) {
          expect(snippet).toMatch(/<img[^>]*\balt=/);
          expect(snippet).toMatch(/<img[^>]*\bsrc="data:image\/svg\+xml/);
        }
      }
    }
  });

  it('#12 inserts each block into About.tsx root element and restores byte-for-byte [R-LB-10, R-SE-22]', async () => {
    const aboutPath = path.join(REPO_ROOT, 'templates/vite-react-ts-tailwind4/src/pages/About.tsx');
    const originalAbout = await fs.readFile(aboutPath, 'utf8');

    for (const block of LIBRARY_BLOCKS) {
      for (const locale of ['vi', 'en'] as const) {
        const pageTarget = path.join(tmpDir, 'src/pages/About.tsx');
        await fs.mkdir(path.dirname(pageTarget), { recursive: true });
        await fs.writeFile(pageTarget, originalAbout, 'utf8');

        const snippet = block.jsx[locale];
        const validateRes = validateInsertedJsx(snippet);
        expect(validateRes.ok).toBe(true);
        if (!validateRes.ok) continue;

        const parent = { loc: 'src/pages/About.tsx:7:5', tag: 'div' };
        const insertRes = await service.applyStructureEdit(tmpDir, {
          kind: 'insert',
          target: { kind: 'child', parent, where: 'end' },
          jsx: snippet,
        });

        expect(insertRes.ok).toBe(true);
        if (!insertRes.ok) continue;
        expect(insertRes.value.locs.length).toBeGreaterThan(0);

        const modifiedContent = await fs.readFile(pageTarget, 'utf8');
        expect(() => parseJsxAst(modifiedContent)).not.toThrow();

        const insertedLoc = insertRes.value.locs[0];
        expect(insertedLoc).toBeDefined();
        if (insertedLoc === undefined) continue;

        const removeRes = await service.applyStructureEdit(tmpDir, {
          kind: 'remove',
          elements: [{ loc: insertedLoc, tag: validateRes.value.firstTag }],
        });

        expect(removeRes.ok).toBe(true);
        const restoredContent = await fs.readFile(pageTarget, 'utf8');
        expect(restoredContent).toBe(originalAbout);
      }
    }
  });
});
