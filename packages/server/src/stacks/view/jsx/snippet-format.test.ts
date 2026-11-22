// Layout of inserted JSX (SPEC-04 M-FM, R-FM-01 to R-FM-06).
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNodeProcess } from '../../../adapters/system/node-process.ts';
import type { ChildProcessHandle, ProcessPort } from '../../../ports/process-port.ts';
import { nodeFs, silentLogger } from '../../../services/workspace/test-support.ts';
import { createSnippetFormatter } from './snippet-format.ts';
import { createSourceEditorService, type WrittenFile } from './source-editor-service.ts';
import { layoutJsxSnippet } from './structure/jsx-layout.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url));
const FORMAT_SCRIPT = fileURLToPath(new URL('../../../runners/format-snippet.ts', import.meta.url));
const PAGE =
  'export function Page() {\n  return (\n    <main>\n      <div>\n        <p>Old</p>\n      </div>\n    </main>\n  );\n}\n';

/** A child that never answers, as a hung Prettier would. */
function hangingProcess(): { port: ProcessPort; kill: ReturnType<typeof vi.fn> } {
  const kill = vi.fn(() => Promise.resolve());
  const handle: ChildProcessHandle = {
    onLine: () => undefined,
    send: () => true,
    onMessage: () => undefined,
    wait: () => new Promise(() => undefined),
    kill,
  };
  return { port: { spawn: () => handle }, kill };
}

describe('layoutJsxSnippet [R-FM-04]', () => {
  it('puts each child element on its own line and closes empty elements [R-FM-04]', () => {
    expect(
      layoutJsxSnippet('<section><h2>A</h2><p>B</p><img src="/a.png"></img></section>', 100),
    ).toBe('<section>\n  <h2>A</h2>\n  <p>B</p>\n  <img src="/a.png" />\n</section>');
  });

  it('keeps text and the spaces between inline elements exactly, since they are rendered [R-FM-04]', () => {
    const inline = '<p>Hello <b>you</b> and <i>me</i></p>';
    expect(layoutJsxSnippet(inline, 100)).toBe(inline);
    expect(layoutJsxSnippet('<div><a>1</a> <a>2</a></div>', 100)).toBe(
      '<div><a>1</a> <a>2</a></div>',
    );
  });

  it('wraps attributes one per line past printWidth, and leaves multi-line snippets alone [R-FM-04]', () => {
    expect(
      layoutJsxSnippet('<button type="button" className="rounded px-4 py-2">Go</button>', 40),
    ).toBe('<button\n  type="button"\n  className="rounded px-4 py-2"\n>\n  Go\n</button>');
    const written = '<div>\n    <p>kept</p></div>';
    expect(layoutJsxSnippet(written, 100)).toBe(written);
  });
});

describe('formatting of inserted JSX [R-FM-01 to R-FM-06]', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-snippet-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const page = () => path.join(tmpDir, 'src/Page.tsx');
  const insertIntoDiv = (
    service: ReturnType<typeof createSourceEditorService>,
    jsx: string,
    onWritten?: (files: readonly WrittenFile[]) => void,
  ) =>
    service.applyStructureEdit(
      tmpDir,
      {
        kind: 'insert',
        target: { kind: 'child', parent: { loc: 'src/Page.tsx:4:7', tag: 'div' }, where: 'end' },
        jsx,
      },
      onWritten,
    );

  it('lays a one-line agent snippet out inside the target and changes nothing else; Undo has the exact old bytes [R-FM-01, R-FM-02, R-FM-06]', async () => {
    await fs.writeFile(page(), PAGE);
    const service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
    let before: string | undefined;

    const res = await insertIntoDiv(service, '<section><h2>A</h2><p>B</p></section>', (files) => {
      before = files[0]?.before;
    });

    expect(res.ok).toBe(true);
    expect(await fs.readFile(page(), 'utf8')).toBe(
      'export function Page() {\n  return (\n    <main>\n      <div>\n        <p>Old</p>\n        <section>\n          <h2>A</h2>\n          <p>B</p>\n        </section>\n      </div>\n    </main>\n  );\n}\n',
    );
    expect(before).toBe(PAGE);
  });

  it('follows the tabs and CRLF of the file [R-FM-02]', async () => {
    await fs.writeFile(page(), PAGE.replaceAll('  ', '\t').replaceAll('\n', '\r\n'));
    const service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });

    // With tabs the <div> opens at column 4.
    await service.applyStructureEdit(tmpDir, {
      kind: 'insert',
      target: { kind: 'child', parent: { loc: 'src/Page.tsx:4:4', tag: 'div' }, where: 'end' },
      jsx: '<ul><li>1</li></ul>',
    });

    expect(await fs.readFile(page(), 'utf8')).toContain(
      '\t\t\t\t<p>Old</p>\r\n\t\t\t\t<ul>\r\n\t\t\t\t\t<li>1</li>\r\n\t\t\t\t</ul>\r\n\t\t\t</div>',
    );
  });

  it.runIf(existsSync(path.join(REPO_ROOT, 'node_modules', 'prettier')))(
    "uses the project's own Prettier and config when the project is trusted [R-FM-03]",
    async () => {
      await fs.writeFile(page(), PAGE);
      await fs.writeFile(path.join(tmpDir, 'package.json'), '{"name":"p","private":true}');
      await fs.writeFile(
        path.join(tmpDir, '.prettierrc'),
        '{"printWidth":60,"jsxSingleQuote":false}',
      );
      await fs.mkdir(path.join(tmpDir, 'node_modules'));
      await fs.symlink(
        path.join(REPO_ROOT, 'node_modules', 'prettier'),
        path.join(tmpDir, 'node_modules', 'prettier'),
        'junction',
      );
      const formatSnippet = createSnippetFormatter({
        fs: nodeFs,
        prettier: {
          process: createNodeProcess(),
          scriptPath: FORMAT_SCRIPT,
          isTrusted: () => true,
        },
      });
      const service = createSourceEditorService(
        { fs: nodeFs, formatSnippet },
        { sourceDir: 'src' },
      );

      await insertIntoDiv(service, "<a href='/x' className='text-blue-600 underline'>Link</a>");

      // Prettier turns JSX single quotes into double quotes; the built-in layout never would.
      expect(await fs.readFile(page(), 'utf8')).toContain(
        '<a href="/x" className="text-blue-600 underline">',
      );
    },
    20_000,
  );

  it('never loads Prettier for a project that is not trusted [R-FM-03, S-80]', async () => {
    await fs.writeFile(page(), PAGE);
    await fs.writeFile(path.join(tmpDir, '.prettierrc'), '{}');
    const spawn = vi.fn();
    const formatSnippet = createSnippetFormatter({
      fs: nodeFs,
      prettier: { process: { spawn }, scriptPath: FORMAT_SCRIPT, isTrusted: () => false },
    });
    const service = createSourceEditorService({ fs: nodeFs, formatSnippet }, { sourceDir: 'src' });

    await insertIntoDiv(service, "<a href='/x'>Link</a>");

    expect(spawn).not.toHaveBeenCalled();
    expect(await fs.readFile(page(), 'utf8')).toContain("<a href='/x'>Link</a>");
  });

  it('falls back to the built-in layout when Prettier hangs past the deadline, and stops it [R-FM-05]', async () => {
    await fs.writeFile(page(), PAGE);
    await fs.writeFile(path.join(tmpDir, '.prettierrc'), '{}');
    await fs.mkdir(path.join(tmpDir, 'node_modules', 'prettier'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'node_modules', 'prettier', 'package.json'), '{}');
    const { port, kill } = hangingProcess();
    const warn = vi.spyOn(silentLogger, 'warn');
    const formatSnippet = createSnippetFormatter({
      fs: nodeFs,
      logger: silentLogger,
      prettier: { process: port, scriptPath: FORMAT_SCRIPT, isTrusted: () => true, timeoutMs: 50 },
    });

    const out = await formatSnippet({
      projectRoot: tmpDir,
      file: 'src/Page.tsx',
      jsx: '<div><p>A</p></div>',
    });

    expect(out).toBe('<div>\n  <p>A</p>\n</div>');
    expect(kill).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'timeout' }),
      expect.any(String),
    );
  });
});
