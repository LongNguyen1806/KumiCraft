// Tests for K9.8-1 Groups 4, 5, 6 & 8: Dark mode config, smooth scroll + sticky offset, LoadingButton, Links, ScrollSpy.
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { StylingReport } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../../../services/workspace/test-support.ts';
import { applyInteractionAction } from '../structure/interaction-ops.ts';
import { enableProjectDarkMode } from './dark-mode-service.ts';
import { applyProjectSmoothScroll } from './smooth-scroll-service.ts';

function locOf(file: string, code: string, snippet: string): string {
  const lines = code.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const idx = lines[i]?.indexOf(snippet) ?? -1;
    if (idx >= 0) return `${file}:${String(i + 1)}:${String(idx + 1)}`;
  }
  throw new Error(`Snippet not found: ${snippet}`);
}

const tw4Styling: StylingReport = {
  systems: [{ id: 'tailwind', version: '4.1.0' }],
  primary: 'tailwind',
  editable: true,
  globalCss: ['src/index.css'],
};

describe('Dark mode, smooth scroll, LoadingButton, Links, ScrollSpy (K9.8-1 Groups 4-8)', () => {
  let root = '';

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-dark-int-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'src/main.tsx'), "import './index.css';\n", 'utf8');
    await fs.writeFile(path.join(root, 'src/index.css'), '@import "tailwindcss";\n', 'utf8');
  });

  afterEach(async () => {
    if (root.length > 0) await fs.rm(root, { recursive: true, force: true });
  });

  it('only checks dark mode and never writes: setup is a job for the AI tab [QA K9.8-1]', async () => {
    const deps = {
      fs: nodeFs,
      styling: tw4Styling,
      tailwindCss: 'src/index.css',
      sourceDir: 'src',
    };
    const check = await enableProjectDarkMode(deps, root, true);
    expect(check.ok).toBe(true);
    // Tailwind `dark:` always applies (system setting, or the project's own variant).
    if (check.ok) expect(check.value).toMatchObject({ enabled: true, changed: false, files: [] });

    const write = await enableProjectDarkMode(deps, root, false);
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.params).toMatchObject({ reason: 'projectWideViaAi' });
    expect(await fs.readFile(path.join(root, 'src/index.css'), 'utf8')).toBe(
      '@import "tailwindcss";\n',
    );
    expect(await fs.readFile(path.join(root, 'src/main.tsx'), 'utf8')).toBe(
      "import './index.css';\n",
    );
  });

  it('plain CSS: dark colors apply only when the project already uses a dark class [QA K9.8-1]', async () => {
    const cssDeps = { fs: nodeFs, sourceDir: 'src' };
    const before = await enableProjectDarkMode(cssDeps, root, true);
    if (before.ok) expect(before.value.enabled).toBe(false);

    // Like MarketLink: a store toggles `dark` on <html> and the CSS has `.dark …` rules.
    await fs.writeFile(
      path.join(root, 'src/ui.store.js'),
      "export const apply = (t) => document.documentElement.classList.toggle('dark', t === 'dark');\n",
      'utf8',
    );
    const after = await enableProjectDarkMode(cssDeps, root, true);
    if (after.ok) expect(after.value.enabled).toBe(true);
  });

  it('keeps the project own smooth scrolling and adds no second rule [QA K9.8-1]', async () => {
    await fs.writeFile(
      path.join(root, 'src/reset.css'),
      'html {\n  scroll-behavior: smooth;\n}\n',
      'utf8',
    );
    const res = await applyProjectSmoothScroll(
      { fs: nodeFs, styling: tw4Styling, sourceDir: 'src' },
      root,
      { enabled: true },
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toMatchObject({ changed: false, alreadySmooth: true });
    expect(await fs.readFile(path.join(root, 'src/index.css'), 'utf8')).toBe(
      '@import "tailwindcss";\n',
    );
  });

  it('adds smooth-scroll CSS and scroll-mt offset when section target is given, plus internal/external links (Group 8)', async () => {
    const pageFile = 'src/Home.tsx';
    const pageCode = [
      "import { Link } from 'react-router-dom';",
      'export function Home() {',
      '  return (',
      '    <main>',
      '      <nav>',
      '        <a href="#old">Features</a>',
      '        <button type="button">Docs</button>',
      '      </nav>',
      '      <section id="features" className="py-12">Features body</section>',
      '    </main>',
      '  );',
      '}',
    ].join('\n');
    await fs.writeFile(path.join(root, pageFile), pageCode, 'utf8');

    const smoothRes = await applyProjectSmoothScroll(
      { fs: nodeFs, styling: tw4Styling, sourceDir: 'src' },
      root,
      {
        enabled: true,
        targetLoc: locOf(pageFile, pageCode, '<section id="features"'),
        targetTag: 'section',
        headerHeightPx: 72,
      },
    );
    expect(smoothRes.ok).toBe(true);
    const css = await fs.readFile(path.join(root, 'src/index.css'), 'utf8');
    expect(css).toContain('scroll-behavior: smooth');
    expect(css).toContain('prefers-reduced-motion: reduce');
    const updatedPage = await fs.readFile(path.join(root, pageFile), 'utf8');
    expect(updatedPage).toContain('scroll-mt-[72px]');

    const extRes = await applyInteractionAction(
      { fs: nodeFs, styling: tw4Styling, sourceDir: 'src' },
      root,
      {
        action: 'setLinkTarget',
        element: { loc: locOf(pageFile, updatedPage, '<button type="button">Docs'), tag: 'button' },
        targetKind: 'external',
        target: 'https://example.com',
        newTab: true,
      },
    );
    expect(extRes.ok).toBe(true);
    const afterExt = await fs.readFile(path.join(root, pageFile), 'utf8');
    expect(afterExt).toContain('href="https://example.com"');
    expect(afterExt).toContain('target="_blank"');
    expect(afterExt).toContain('rel="noopener noreferrer"');

    const navRes = await applyInteractionAction(
      { fs: nodeFs, styling: tw4Styling, sourceDir: 'src' },
      root,
      {
        action: 'markActiveNav',
        element: { loc: locOf(pageFile, afterExt, '<nav>'), tag: 'nav' },
      },
    );
    expect(navRes.ok).toBe(true);
    const afterNav = await fs.readFile(path.join(root, pageFile), 'utf8');
    expect(afterNav).toContain('<ScrollSpy>');
  });

  it('converts a button to LoadingButton (Group 6)', async () => {
    const deps = { fs: nodeFs, styling: tw4Styling, sourceDir: 'src' };
    const loadFile = 'src/Checkout.tsx';
    const loadCode =
      'export function Checkout() {\n  return <button type="button">Thanh toán</button>;\n}\n';
    await fs.writeFile(path.join(root, loadFile), loadCode, 'utf8');
    const loadOk = await applyInteractionAction(deps, root, {
      action: 'makeLoadingButton',
      element: { loc: locOf(loadFile, loadCode, '<button'), tag: 'button' },
      loadingText: 'Đang thanh toán...',
    });
    expect(loadOk.ok).toBe(true);
    const afterLoad = await fs.readFile(path.join(root, loadFile), 'utf8');
    expect(afterLoad).toContain('<LoadingButton');
    expect(afterLoad).toContain('loadingText="Đang thanh toán..."');
    expect(afterLoad).toContain('</LoadingButton>');
  });
});
