// K9.5: className as a template literal with expressions (`` `p-4 ${dark ? 'a' : 'b'}` ``) — the
// static part before the first `${` is editable; found on the owner's real projects, where dark
// mode classes locked 9 of 14 elements.
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../workspace/test-support.ts';
import { createSourceEditorService } from './source-editor-service.ts';

describe('templateStatic className [WP-4.00, K9.5]', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'template-static-'));
    await fs.mkdir(path.join(tmpDir, 'src'));
    service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function write(code: string): Promise<string> {
    const file = path.join(tmpDir, 'src/T.tsx');
    await fs.writeFile(file, code, 'utf8');
    return file;
  }

  const wrap = (cls: string) =>
    `export function T({ dark, v }: { dark: boolean; v: string }) {\n  return <div className={${cls}}>x</div>;\n}\n`;

  it('reads the part before the first ${ and keeps the rest; a class glued to ${ stays locked [WP-4.00]', async () => {
    await write(wrap("`sticky top-0 ${dark ? 'bg-black' : 'bg-white'}`"));
    const read = await service.getElement(tmpDir, 'src/T.tsx:2:10');
    expect(read.ok && read.value.className).toEqual({
      kind: 'templateStatic',
      value: 'sticky top-0',
      rest: "${dark ? 'bg-black' : 'bg-white'}",
    });

    await write(wrap('`btn-${v} p-2`'));
    const glued = await service.getElement(tmpDir, 'src/T.tsx:2:10');
    expect(glued.ok && glued.value.className.kind).toBe('expression');

    await write(wrap('`${v} p-2`'));
    const empty = await service.getElement(tmpDir, 'src/T.tsx:2:10');
    expect(empty.ok && empty.value.className).toEqual({
      kind: 'templateStatic',
      value: '',
      rest: '${v} p-2',
    });
  });

  it('an edit changes only the static part of a multi-line template; Undo is byte for byte [WP-4.00]', async () => {
    const original = `export function T({ dark }: { dark: boolean }) {
  return (
    <header
      className={\`sticky top-0 z-40 border-b \${
        dark ? 'border-zinc-800/80 bg-black' : 'border-zinc-200/80 bg-white'
      }\`}
    >
      x
    </header>
  );
}
`;
    const file = await write(original);
    const edited = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/T.tsx:3:5',
      tag: 'header',
      before: 'sticky top-0 z-40 border-b',
      after: 'sticky top-0 z-50 border-b shadow',
    });
    expect(edited.ok).toBe(true);
    expect(await fs.readFile(file, 'utf8')).toBe(
      original.replace('sticky top-0 z-40 border-b ${', 'sticky top-0 z-50 border-b shadow ${'),
    );

    const undone = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/T.tsx:3:5',
      tag: 'header',
      before: 'sticky top-0 z-50 border-b shadow',
      after: 'sticky top-0 z-40 border-b',
    });
    expect(undone.ok).toBe(true);
    expect(await fs.readFile(file, 'utf8')).toBe(original);
  });

  it('classes added before a leading ${ get a space; clearing them leaves the expression alone [WP-4.00]', async () => {
    const file = await write(wrap('`${v} p-2`'));
    const added = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/T.tsx:2:10',
      tag: 'div',
      before: '',
      after: 'flex',
    });
    expect(added.ok).toBe(true);
    expect(await fs.readFile(file, 'utf8')).toBe(wrap('`flex ${v} p-2`'));

    const cleared = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/T.tsx:2:10',
      tag: 'div',
      before: 'flex',
      after: '',
    });
    expect(cleared.ok).toBe(true);
    expect(await fs.readFile(file, 'utf8')).toBe(wrap('`${v} p-2`'));
  });

  it('a template without ${ keeps its backticks when edited (was written as ``a c``) [WP-4.00]', async () => {
    const file = await write(wrap('`a b`'));
    const edited = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/T.tsx:2:10',
      tag: 'div',
      before: 'a b',
      after: 'a c',
    });
    expect(edited.ok).toBe(true);
    expect(await fs.readFile(file, 'utf8')).toBe(wrap('`a c`'));
  });

  it('a backtick or ${ in the new classes is escaped, so the template stays one string [WP-4.00]', async () => {
    const file = await write(wrap("`p-2 ${dark ? 'a' : 'b'}`"));
    const edited = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/T.tsx:2:10',
      tag: 'div',
      before: 'p-2',
      after: "p-2 content-['`'] x-${y}",
    });
    expect(edited.ok).toBe(true);
    const read = await service.getElement(tmpDir, 'src/T.tsx:2:10');
    expect(read.ok && read.value.className).toMatchObject({
      kind: 'templateStatic',
      rest: "${dark ? 'a' : 'b'}",
    });
    expect(await fs.readFile(file, 'utf8')).toContain("`p-2 content-['\\`'] x-\\${y} ${dark");
  });
});
