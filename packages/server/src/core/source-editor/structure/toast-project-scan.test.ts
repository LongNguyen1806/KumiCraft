// "Show a notice on click" never adds a second notice system to a project (QA K9.8-1, plan K9.8).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { StylingReport } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../workspace/test-support.ts';
import { applyInteractionAction } from './interaction-ops.ts';

const styling: StylingReport = {
  systems: [{ id: 'tailwind', version: '4.1.0' }],
  primary: 'tailwind',
  editable: true,
  globalCss: ['src/index.css'],
};

const PAGE = [
  'export function Shop() {',
  '  return (',
  '    <div>',
  '      <button type="button">Thêm vào giỏ</button>',
  '    </div>',
  '  );',
  '}',
].join('\n');

const BUTTON_LOC = 'src/pages/Shop.tsx:4:7';

async function write(root: string, rel: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await fs.writeFile(path.join(root, rel), text, 'utf8');
}

function addToast(root: string) {
  return applyInteractionAction({ fs: nodeFs, styling, sourceDir: 'src' }, root, {
    action: 'addToastOnClick',
    element: { loc: BUTTON_LOC, tag: 'button' },
    message: 'Đã thêm vào giỏ',
    variant: 'success',
    durationMs: 4000,
    position: 'bottom-right',
  });
}

describe('toast on click and the project notice system [QA K9.8-1]', () => {
  let root = '';

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-toast-scan-'));
    await write(root, 'package.json', JSON.stringify({ dependencies: { react: '19.0.0' } }));
    await write(root, 'src/pages/Shop.tsx', PAGE);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('refuses and names the library when the project already uses sonner', async () => {
    await write(root, 'package.json', JSON.stringify({ dependencies: { sonner: '2.0.0' } }));
    const res = await addToast(root);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.params).toMatchObject({ reason: 'projectToastLibrary', library: 'sonner' });
    expect(await fs.readFile(path.join(root, 'src/pages/Shop.tsx'), 'utf8')).toBe(PAGE);
  });

  it("refuses when the project renders its own Toaster (shadcn's or its own)", async () => {
    await write(root, 'src/App.tsx', 'export function App() {\n  return <Toaster />;\n}\n');
    const res = await addToast(root);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.params).toMatchObject({ reason: 'projectToastHost', file: 'src/App.tsx' });
  });

  it('reuses the ToastHost a layout already renders instead of adding one to the page', async () => {
    await write(
      root,
      'src/layouts/MainLayout.tsx',
      'export function MainLayout() {\n  return <main><ToastHost /></main>;\n}\n',
    );
    const res = await addToast(root);
    expect(res.ok).toBe(true);
    const page = await fs.readFile(path.join(root, 'src/pages/Shop.tsx'), 'utf8');
    expect(page).toContain('<ToastTrigger');
    expect(page).not.toContain('<ToastHost');
  });

  it('adds one ToastHost to the page when the project has no notice system', async () => {
    const res = await addToast(root);
    expect(res.ok).toBe(true);
    const page = await fs.readFile(path.join(root, 'src/pages/Shop.tsx'), 'utf8');
    expect(page.match(/<ToastHost\s*\/>/g)?.length).toBe(1);
  });
});
