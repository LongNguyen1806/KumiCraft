import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../workspace/test-support.ts';
import { asAstNode, type AstNode, getJsxTagName, parseJsxAst } from '../ast-helpers.ts';
import { createSourceEditorService } from '../source-editor-service.ts';
import { jsxChildren } from './jsx-children.ts';
import { checkElementStructureGuard, findAncestors } from './structure-guard.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../../..');

async function listTsxFiles(dir: string, relBase = 'src'): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = `${relBase}/${entry.name}`;
    if (entry.isDirectory()) results.push(...(await listTsxFiles(abs, rel)));
    else if (entry.isFile() && entry.name.endsWith('.tsx')) results.push(rel);
  }
  return results.sort((a, b) => a.localeCompare(b));
}

type ValidElement = {
  readonly loc: string;
  readonly tag: string;
  readonly node: AstNode;
};

function collectAllValidJsxElements(ast: AstNode, rel: string): ValidElement[] {
  const valid: ValidElement[] = [];
  function walk(node: AstNode): void {
    if (node.type === 'JSXElement') {
      const opening = asAstNode(node['openingElement']);
      const tag = opening ? getJsxTagName(opening) : undefined;
      const startPos = opening?.loc?.start;
      if (tag && startPos) {
        const loc = `${rel}:${String(startPos.line)}:${String(startPos.column + 1)}`;
        if (checkElementStructureGuard(ast, node, loc).ok) {
          valid.push({ loc, tag, node });
        }
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
      const list = Array.isArray(value) ? value : [value];
      for (const item of list) {
        const child = asAstNode(item);
        if (child) walk(child);
      }
    }
  }
  walk(ast);
  return valid;
}

describe('M-SE: Move Real Files Walk [WP-2.02b]', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-move-walk-test-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    service = createSourceEditorService({ fs: nodeFs });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('#15 [R-SE-24] round-trips move down then move up on every valid JSXElement with succeeding sibling in real files', async () => {
    const roots = [
      path.join(REPO_ROOT, 'fixtures/projects/vite8-react19-ts/src'),
      path.join(REPO_ROOT, 'templates/vite-react-ts-tailwind4/src'),
    ];
    let totalFiles = 0;
    let totalElements = 0;
    for (const srcRoot of roots) {
      const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-move-rt-'));
      try {
        await fs.cp(srcRoot, path.join(workDir, 'src'), { recursive: true });
        for (const rel of await listTsxFiles(path.join(workDir, 'src'))) {
          const abs = path.join(workDir, rel);
          const original = await fs.readFile(abs, 'utf8');
          totalFiles++;
          const ast = parseJsxAst(original);
          const validElements = collectAllValidJsxElements(ast, rel);
          for (const el of validElements) {
            const ancestors = findAncestors(ast, el.node);
            const parent = ancestors[ancestors.length - 1];
            if (!parent) continue;
            const siblings = jsxChildren(parent);
            const idx = siblings.findIndex((s) => s.start === el.node.start);
            if (idx === -1 || idx >= siblings.length - 1) continue;
            const nextSibling = siblings[idx + 1];
            if (!nextSibling || nextSibling.type !== 'JSXElement') continue;
            const nextOpening = asAstNode(nextSibling['openingElement']);
            const nextTag = nextOpening ? getJsxTagName(nextOpening) : undefined;
            const nextStart = nextOpening?.loc?.start;
            if (!nextTag || !nextStart) continue;
            const nextLoc = `${rel}:${String(nextStart.line)}:${String(nextStart.column + 1)}`;

            totalElements++;
            const downRes = await service.applyStructureEdit(workDir, {
              kind: 'move',
              elements: [el],
              target: { kind: 'sibling', ref: { loc: nextLoc, tag: nextTag }, where: 'after' },
            });
            expect(downRes.ok, `move down failed at ${el.loc}`).toBe(true);
            if (!downRes.ok || !downRes.value.locs[0]) continue;

            const movedLoc = downRes.value.locs[0];
            const midAst = parseJsxAst(await fs.readFile(abs, 'utf8'));
            const foundEl = collectAllValidJsxElements(midAst, rel).find((m) => m.loc === movedLoc);
            if (!foundEl) continue;
            const midAncestors = findAncestors(midAst, foundEl.node);
            const midParent = midAncestors[midAncestors.length - 1];
            if (!midParent) continue;
            const midSiblings = jsxChildren(midParent);
            const midIdx = midSiblings.findIndex(
              (s) =>
                asAstNode(s['openingElement'])?.loc?.start?.line === Number(movedLoc.split(':')[1]),
            );
            if (midIdx <= 0) continue;
            const targetSibling = midSiblings[midIdx - 1];
            if (!targetSibling || targetSibling.type !== 'JSXElement') continue;
            const targetOpening = asAstNode(targetSibling['openingElement']);
            const targetTag = targetOpening ? getJsxTagName(targetOpening) : undefined;
            const targetStart = targetOpening?.loc?.start;
            if (!targetTag || !targetStart) continue;
            const targetLoc = `${rel}:${String(targetStart.line)}:${String(targetStart.column + 1)}`;

            const upRes = await service.applyStructureEdit(workDir, {
              kind: 'move',
              elements: [{ loc: movedLoc, tag: el.tag }],
              target: { kind: 'sibling', ref: { loc: targetLoc, tag: targetTag }, where: 'before' },
            });
            expect(upRes.ok, `move up failed at ${el.loc}`).toBe(true);
            expect(await fs.readFile(abs, 'utf8')).toBe(original);
          }
        }
      } finally {
        await fs.rm(workDir, { recursive: true, force: true });
      }
    }
    expect(totalFiles).toBeGreaterThanOrEqual(18);
    expect(totalElements).toBeGreaterThanOrEqual(20);
  }, 30_000);
});
