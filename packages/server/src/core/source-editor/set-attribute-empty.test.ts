// A value set on an attribute that is empty (`aria-label=""`): the owner's hand test of
// 2026-11-15 got E013, because magic-string refuses to overwrite the zero-length text between the
// quotes. Emptying a value is the other way round and must work too.
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../workspace/test-support.ts';
import { createSourceEditorService } from './source-editor-service.ts';

const FILE = 'src/App.tsx';
let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-attr-empty-'));
  await fs.mkdir(path.join(dir, 'src'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function setAria(initial: string, before: string, after: string): Promise<string> {
  await fs.writeFile(path.join(dir, FILE), initial);
  const service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
  const res = await service.applyEdit(dir, {
    kind: 'setAttribute',
    loc: `${FILE}:3:5`,
    tag: 'a',
    name: 'aria-label',
    before,
    after,
  });
  expect(res.ok).toBe(true);
  return fs.readFile(path.join(dir, FILE), 'utf8');
}

const page = (aria: string) =>
  `export function App() {\n  return (\n    <a href="#" aria-label="${aria}">Xem</a>\n  );\n}\n`;

describe('setAttribute on an empty value', () => {
  it('fills an empty attribute instead of failing with E013 [R-SE-04]', async () => {
    expect(await setAria(page(''), '', 'Xem giá')).toContain('aria-label="Xem giá"');
  });

  it('empties an attribute that has a value [R-SE-04]', async () => {
    expect(await setAria(page('Xem giá'), 'Xem giá', '')).toContain('aria-label=""');
  });
});
