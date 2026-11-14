// Tests for K9.8-1 Group 7: mixed text runs (<h3><svg/> Text</h3>, inline spans, expression readonly, wrong before guard).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../workspace/test-support.ts';
import { createSourceEditorService } from './source-editor-service.ts';

function locOf(file: string, code: string, snippet: string): string {
  const lines = code.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const idx = lines[i]?.indexOf(snippet) ?? -1;
    if (idx >= 0) return `${file}:${String(i + 1)}:${String(idx + 1)}`;
  }
  throw new Error(`Snippet not found: ${snippet}`);
}

describe('Mixed text runs & setTextRun mutation (K9.8-1 Group 7)', () => {
  let root = '';
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-text-run-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
  });

  afterEach(async () => {
    if (root.length > 0) await fs.rm(root, { recursive: true, force: true });
  });

  it('reads text, inline element, and expression runs and updates a single text run without disturbing sibling SVG', async () => {
    const file = 'src/Mixed.tsx';
    const code = [
      'export function Mixed({ price }: { price: string }) {',
      '  return (',
      '    <div>',
      '      <h3><svg data-icon="battery" /> Pin &amp; Kết nối</h3>',
      '      <p>Mua <span className="font-bold">ngay</span> với giá {price} hôm nay</p>',
      '    </div>',
      '  );',
      '}',
    ].join('\n');
    await fs.writeFile(path.join(root, file), code, 'utf8');

    const h3Loc = locOf(file, code, '<h3>');
    const h3El = await service.getElement(root, h3Loc);
    expect(h3El.ok).toBe(true);
    if (!h3El.ok) return;
    expect(h3El.value.text.kind).toBe('mixed');
    if (h3El.value.text.kind === 'mixed') {
      expect(h3El.value.text.runs).toEqual([
        { kind: 'element', tag: 'svg', iconName: 'battery' },
        { kind: 'text', runIndex: 0, value: 'Pin & Kết nối' },
      ]);
    }

    const pLoc = locOf(file, code, '<p>');
    const pEl = await service.getElement(root, pLoc);
    expect(pEl.ok).toBe(true);
    if (!pEl.ok) return;
    expect(pEl.value.text.kind).toBe('mixed');
    if (pEl.value.text.kind === 'mixed') {
      expect(pEl.value.text.runs).toEqual([
        { kind: 'text', runIndex: 0, value: 'Mua' },
        { kind: 'element', tag: 'span' },
        { kind: 'text', runIndex: 1, value: 'với giá' },
        { kind: 'expression', code: 'price' },
        { kind: 'text', runIndex: 2, value: 'hôm nay' },
      ]);
    }

    // Wrong before MUST be rejected with E017
    const wrongBefore = await service.applyEdit(root, {
      kind: 'setTextRun',
      loc: h3Loc,
      tag: 'h3',
      index: 0,
      before: 'Wrong old text',
      after: 'Pin 100 giờ',
    });
    expect(wrongBefore.ok).toBe(false);
    if (!wrongBefore.ok) expect(wrongBefore.error.code).toBe('E017');

    // Valid before updates run 0 and leaves <svg data-icon="battery" /> untouched
    const edited = await service.applyEdit(root, {
      kind: 'setTextRun',
      loc: h3Loc,
      tag: 'h3',
      index: 0,
      before: 'Pin & Kết nối',
      after: 'Pin 40 giờ & USB-C',
    });
    expect(edited.ok).toBe(true);
    const updated = await fs.readFile(path.join(root, file), 'utf8');
    expect(updated).toContain('<svg data-icon="battery" />');
    expect(updated).toContain('Pin 40 giờ & USB-C');
    expect(updated).not.toContain('Pin &amp; Kết nối');
  });
});
