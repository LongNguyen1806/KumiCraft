// Tests for cn static class editing [WP-4.00, B1, B2]
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../../services/workspace/test-support.ts';
import { createSourceEditorService } from './source-editor-service.ts';

describe('callStatic: reading and editing static className in cn/clsx/twMerge [WP-4.00, B1, B2]', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'call-static-test-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('B1: reads cn, clsx, twMerge with static first arg as callStatic and non-static as expression [WP-4.00]', async () => {
    const code = `
export function Comp({ active, base }: { active: boolean; base: string }) {
  return (
    <div>
      <h1 className={cn('px-4 py-2', active && 'x')}>Title</h1>
      <h2 className={clsx('text-lg', active && 'font-bold')}>Sub</h2>
      <h3 className={twMerge('rounded-md', active && 'bg-blue-500')}>Card</h3>
      <h4 className={utils.cn('border', active && 'border-red-500')}>Border</h4>
      <h5 className={cn(base, 'x')}>Dynamic</h5>
    </div>
  );
}
`;
    await fs.writeFile(path.join(tmpDir, 'src/Comp.tsx'), code, 'utf8');

    // 1. cn
    const r1 = await service.getElement(tmpDir, 'src/Comp.tsx:5:7');
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.value.className).toEqual({
        kind: 'callStatic',
        value: 'px-4 py-2',
        callee: 'cn',
        rest: "active && 'x'",
      });
    }

    // 2. clsx
    const r2 = await service.getElement(tmpDir, 'src/Comp.tsx:6:7');
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.value.className).toEqual({
        kind: 'callStatic',
        value: 'text-lg',
        callee: 'clsx',
        rest: "active && 'font-bold'",
      });
    }

    // 3. twMerge
    const r3 = await service.getElement(tmpDir, 'src/Comp.tsx:7:7');
    expect(r3.ok).toBe(true);
    if (r3.ok) {
      expect(r3.value.className).toEqual({
        kind: 'callStatic',
        value: 'rounded-md',
        callee: 'twMerge',
        rest: "active && 'bg-blue-500'",
      });
    }

    // 4. utils.cn member expression
    const r4 = await service.getElement(tmpDir, 'src/Comp.tsx:8:7');
    expect(r4.ok).toBe(true);
    if (r4.ok) {
      expect(r4.value.className).toEqual({
        kind: 'callStatic',
        value: 'border',
        callee: 'utils.cn',
        rest: "active && 'border-red-500'",
      });
    }

    // 5. non-static first argument cn(base, 'x')
    const r5 = await service.getElement(tmpDir, 'src/Comp.tsx:9:7');
    expect(r5.ok).toBe(true);
    if (r5.ok) {
      expect(r5.value.className.kind).toBe('expression');
    }
  });

  it('B2: edits class on callStatic touching only first arg, preserving quotes and rest byte-for-byte [WP-4.00]', async () => {
    const original = `export function Card({ active }: { active: boolean }) {
  return (
    <div className={cn('px-4 py-2', active && 'bg-blue-500')}>
      Content
    </div>
  );
}`;
    const filePath = path.join(tmpDir, 'src/Card.tsx');
    await fs.writeFile(filePath, original, 'utf8');

    const editRes = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/Card.tsx:3:5',
      tag: 'div',
      before: 'px-4 py-2',
      after: 'px-6 py-4',
    });
    expect(editRes.ok).toBe(true);

    const edited = await fs.readFile(filePath, 'utf8');
    expect(edited).toBe(`export function Card({ active }: { active: boolean }) {
  return (
    <div className={cn('px-6 py-4', active && 'bg-blue-500')}>
      Content
    </div>
  );
}`);

    // Revert (simulating Undo)
    const undoRes = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/Card.tsx:3:5',
      tag: 'div',
      before: 'px-6 py-4',
      after: 'px-4 py-2',
    });
    expect(undoRes.ok).toBe(true);
    const reverted = await fs.readFile(filePath, 'utf8');
    expect(reverted).toBe(original);
  });

  it("B2: a class holding the literal's quote keeps the code valid and reads back the same [WP-4.00]", async () => {
    const original = `export function Card({ active }: { active: boolean }) {
  return <div className={cn('p-4', active && 'ring')}>A</div>;
}`;
    const filePath = path.join(tmpDir, 'src/Quote.tsx');
    await fs.writeFile(filePath, original, 'utf8');

    const after = "p-4 font-['Inter'] content-['\\\\2022']";
    const editRes = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/Quote.tsx:2:10',
      tag: 'div',
      before: 'p-4',
      after,
    });
    expect(editRes.ok).toBe(true);
    const edited = await fs.readFile(filePath, 'utf8');
    expect(edited).toContain(`cn(${JSON.stringify(after)}, active && 'ring')`);

    const read = await service.getElement(tmpDir, 'src/Quote.tsx:2:10');
    expect(read.ok && read.value.className).toEqual({
      kind: 'callStatic',
      value: after,
      callee: 'cn',
      rest: "active && 'ring'",
    });
  });
});
