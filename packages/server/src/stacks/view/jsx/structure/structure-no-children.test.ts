// Children are never put inside <img>, <input> or <textarea>: React would stop drawing the page
// (spec-log #116). The Canvas already refuses such drops; this guards every other path (Layers,
// MCP, a future caller).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../../../services/workspace/test-support.ts';
import { createSourceEditorService } from '../source-editor-service.ts';

const PAGE = `export function Hero() {
  return (
    <section>
      <img src="/hero.png" alt="" />
      <input name="q" />
      <textarea name="note"></textarea>
    </section>
  );
}
`;

describe('M-SE: no children inside tags that cannot hold them [R-SE-21]', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-no-children-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'src/Hero.tsx'), PAGE, 'utf8');
    service = createSourceEditorService({ fs: nodeFs });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const insertInto = (loc: string, tag: string) =>
    service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc, tag }, where: 'end' },
      jsx: '<p>Hi</p>',
    });

  it.each([
    ['src/Hero.tsx:4:7', 'img'],
    ['src/Hero.tsx:5:7', 'input'],
    ['src/Hero.tsx:6:7', 'textarea'],
  ])('refuses a child inside <%s> and leaves the file as it was', async (loc, tag) => {
    const res = await insertInto(loc, tag);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatchObject({ code: 'E016', params: { reason: 'noChildrenTag' } });
    }
    expect(await fs.readFile(path.join(tmpDir, 'src/Hero.tsx'), 'utf8')).toBe(PAGE);
  });

  it('still puts a child inside an ordinary container', async () => {
    const res = await insertInto('src/Hero.tsx:3:5', 'section');
    expect(res.ok).toBe(true);
    expect(await fs.readFile(path.join(tmpDir, 'src/Hero.tsx'), 'utf8')).toContain('<p>Hi</p>');
  });
});
