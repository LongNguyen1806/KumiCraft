// Server unit tests for K9.7-2 TK-1..4, TK-6, TK-18..21 (Tests 1, 4, 6, 8-server, 17).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { EditRequestSchema } from '@kumicraft/shared';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../../kernel/history/history-service.ts';
import { nodeFs } from '../../../services/workspace/test-support.ts';
import { createSourceEditorService } from './source-editor-service.ts';
import { applyRevealEdit } from './structure/reveal-service.ts';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-k972-se-'));
  await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('K9.7-2 server element edits & Reveal', () => {
  it('Test 1: setTag changes div to section keeping attrs/children/CRLF and self-closing, rejects component/void/unsafe tags, Undo restores byte-for-byte', async () => {
    const fileRel = 'src/App.tsx';
    const absFile = path.join(tmpDir, fileRel);
    const initial =
      'export function App() {\r\n' +
      '  return (\r\n' +
      '    <div id="hero" className="p-4">\r\n' +
      '      {/* keep comment */}\r\n' +
      '      <span>Hello</span>\r\n' +
      '      <div className="dot" />\r\n' +
      '      <Card />\r\n' +
      '      <img src="/a.png" alt="a" />\r\n' +
      '    </div>\r\n' +
      '  );\r\n' +
      '}\r\n';
    await fs.writeFile(absFile, initial, 'utf8');

    const history = createHistoryService({ fs: nodeFs });
    const service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });

    const r1 = await service.applyEdit(
      tmpDir,
      { kind: 'setTag', loc: 'src/App.tsx:3:5', tag: 'div', after: 'section' },
      (written) => {
        history.recordInternalWrite(written.path, written.afterHash);
        history.push({
          label: { key: 'history:setTag', params: { tag: 'section' } },
          files: [written],
        });
      },
    );
    expect(r1.ok).toBe(true);
    const after1 = await fs.readFile(absFile, 'utf8');
    expect(after1).toContain('<section id="hero" className="p-4">\r\n');
    expect(after1).toContain('</section>');
    expect(after1).toContain('{/* keep comment */}');
    expect(after1).toContain('<span>Hello</span>');

    const rSelf = await service.applyEdit(tmpDir, {
      kind: 'setTag',
      loc: 'src/App.tsx:6:7',
      tag: 'div',
      after: 'article',
    });
    expect(rSelf.ok).toBe(true);
    expect(await fs.readFile(absFile, 'utf8')).toContain('<article className="dot" />');

    // Separate file check for pure byte-for-byte Undo on first edit
    await fs.writeFile(absFile, initial, 'utf8');
    const h2 = createHistoryService({ fs: nodeFs });
    const rSingle = await service.applyEdit(
      tmpDir,
      { kind: 'setTag', loc: 'src/App.tsx:3:5', tag: 'div', after: 'section' },
      (written) => {
        h2.recordInternalWrite(written.path, written.afterHash);
        h2.push({ label: { key: 'history:setTag', params: { tag: 'section' } }, files: [written] });
      },
    );
    expect(rSingle.ok).toBe(true);
    expect((await h2.undo(tmpDir)).ok).toBe(true);
    expect(await fs.readFile(absFile, 'utf8')).toBe(initial);

    // Rejections: component tag, void tag, non-allowlist tag
    const rComp = await service.applyEdit(tmpDir, {
      kind: 'setTag',
      loc: 'src/App.tsx:7:7',
      tag: 'Card',
      after: 'section',
    });
    expect(rComp.ok).toBe(false);

    const rVoid = await service.applyEdit(tmpDir, {
      kind: 'setTag',
      loc: 'src/App.tsx:8:7',
      tag: 'img',
      after: 'div',
    });
    expect(rVoid.ok).toBe(false);

    expect(
      EditRequestSchema.safeParse({
        edit: { kind: 'setTag', loc: 'src/App.tsx:3:5', tag: 'div', after: 'script' },
      }).success,
    ).toBe(false);
  });

  it('Test 4: wrapText wraps middle/start/end with &amp;, rejects JSX expression E023, inserts CSS rules for plain CSS, Undo byte-for-byte', async () => {
    const appRel = 'src/App.tsx';
    const cssRel = 'src/styles.css';
    const initialTsx = [
      "import './styles.css';",
      'export function App() {',
      '  return (',
      '    <div>',
      '      <p>Alpha &amp; Beta Gamma</p>',
      '      <p>Hi {name} bye</p>',
      '    </div>',
      '  );',
      '}',
      '',
    ].join('\n');
    const initialCss = '.box { color: black; }\n';
    await fs.writeFile(path.join(tmpDir, appRel), initialTsx, 'utf8');
    await fs.writeFile(path.join(tmpDir, cssRel), initialCss, 'utf8');

    const history = createHistoryService({ fs: nodeFs });
    const service = createSourceEditorService(
      {
        fs: nodeFs,
        styling: () => ({
          systems: [{ id: 'css' }],
          primary: 'css',
          editable: false,
          globalCss: [cssRel],
        }),
      },
      { sourceDir: 'src' },
    );

    // Middle wrap with entity &amp; intact in CSS mode (writing rule into styles.css)
    const rMiddle = await service.applyStructureEdit(
      tmpDir,
      {
        kind: 'wrapText',
        loc: 'src/App.tsx:5:7',
        tag: 'p',
        start: 8,
        end: 12,
        wrapper: { tag: 'span', className: 'kc-inline-bold' },
        css: {
          rules: [{ selector: '.kc-inline-bold', declarations: { 'font-weight': '700' } }],
        },
      },
      (files) => {
        for (const f of files) history.recordInternalWrite(f.path, f.afterHash);
        history.push({ label: { key: 'history:wrap', params: { tag: 'span' } }, files });
      },
    );
    expect(rMiddle.ok).toBe(true);
    const updatedTsx = await fs.readFile(path.join(tmpDir, appRel), 'utf8');
    expect(updatedTsx).toContain(
      '<p>Alpha &amp; <span className="kc-inline-bold">Beta</span> Gamma</p>',
    );
    const updatedCss = await fs.readFile(path.join(tmpDir, cssRel), 'utf8');
    expect(updatedCss).toContain('.kc-inline-bold');
    expect(updatedCss).toContain('font-weight: 700');

    // Undo restores both TSX and CSS byte-for-byte
    expect((await history.undo(tmpDir)).ok).toBe(true);
    expect(await fs.readFile(path.join(tmpDir, appRel), 'utf8')).toBe(initialTsx);
    expect(await fs.readFile(path.join(tmpDir, cssRel), 'utf8')).toBe(initialCss);

    // Start + End wrap (Tailwind classes)
    const rStart = await service.applyStructureEdit(tmpDir, {
      kind: 'wrapText',
      loc: 'src/App.tsx:5:7',
      tag: 'p',
      start: 0,
      end: 5,
      wrapper: { tag: 'strong', className: 'font-bold' },
    });
    expect(rStart.ok).toBe(true);
    expect(await fs.readFile(path.join(tmpDir, appRel), 'utf8')).toContain(
      '<strong className="font-bold">Alpha</strong>',
    );

    await fs.writeFile(path.join(tmpDir, appRel), initialTsx, 'utf8');
    const rEnd = await service.applyStructureEdit(tmpDir, {
      kind: 'wrapText',
      loc: 'src/App.tsx:5:7',
      tag: 'p',
      start: 13,
      end: 18,
      wrapper: { tag: 'em', className: 'italic' },
    });
    expect(rEnd.ok).toBe(true);
    expect(await fs.readFile(path.join(tmpDir, appRel), 'utf8')).toContain(
      '<em className="italic">Gamma</em>',
    );

    // Rejects span overlapping expression {name} with E023
    const rExpr = await service.applyStructureEdit(tmpDir, {
      kind: 'wrapText',
      loc: 'src/App.tsx:6:7',
      tag: 'p',
      start: 1,
      end: 9,
      wrapper: { tag: 'span', className: 'font-bold' },
    });
    expect(rExpr.ok).toBe(false);
    if (!rExpr.ok) expect(rExpr.error.code).toBe('E023');
  });

  it('Test 6: setAttribute supports id/aria-label/data-* and blocks unsafe attrs', async () => {
    const initial = 'export function App() {\n  return <div className="box">Hi</div>;\n}\n';
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), initial, 'utf8');
    const service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });

    const rId = await service.applyEdit(tmpDir, {
      kind: 'setAttribute',
      loc: 'src/App.tsx:2:10',
      tag: 'div',
      name: 'id',
      after: 'main-box',
    });
    expect(rId.ok).toBe(true);

    const rAria = await service.applyEdit(tmpDir, {
      kind: 'setAttribute',
      loc: 'src/App.tsx:2:10',
      tag: 'div',
      name: 'aria-label',
      after: 'Greeting box',
    });
    expect(rAria.ok).toBe(true);

    const rData = await service.applyEdit(tmpDir, {
      kind: 'setAttribute',
      loc: 'src/App.tsx:2:10',
      tag: 'div',
      name: 'data-track',
      after: 'cta',
    });
    expect(rData.ok).toBe(true);

    const read = await service.getElement(tmpDir, 'src/App.tsx:2:10');
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.attributes['id']).toEqual({ kind: 'static', value: 'main-box' });
      expect(read.value.attributes['aria-label']).toEqual({
        kind: 'static',
        value: 'Greeting box',
      });
      expect(read.value.attributes['data-track']).toEqual({ kind: 'static', value: 'cta' });
    }

    for (const forbidden of [
      'onClick',
      'onload',
      'style',
      'className',
      'key',
      'ref',
      'dangerouslySetInnerHTML',
      'data-rc-loc',
    ]) {
      expect(
        EditRequestSchema.safeParse({
          edit: {
            kind: 'setAttribute',
            loc: 'src/App.tsx:2:10',
            tag: 'div',
            name: forbidden,
            after: 'x',
          },
        }).success,
      ).toBe(false);
    }
  });

  it('Test 8 (server): replaceSvg updates svg children & data-icon cleanly, rejects script/foreignObject, Undo byte-for-byte', async () => {
    const initial = [
      'export function App() {',
      '  return (',
      '    <svg width="24" height="24" viewBox="0 0 24 24" className="text-red-500" data-icon="star">',
      '      <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9" />',
      '    </svg>',
      '  );',
      '}',
      '',
    ].join('\n');
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), initial, 'utf8');
    const history = createHistoryService({ fs: nodeFs });
    const service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });

    const rOk = await service.applyStructureEdit(
      tmpDir,
      {
        kind: 'replaceSvg',
        loc: 'src/App.tsx:3:5',
        tag: 'svg',
        icon: {
          name: 'heart',
          node: [['path', { d: 'M12 21s-6-4.35-9-8.5C1 9.5 3.5 5 7.5 5c2.2 0 4 1.3 4.5 2.5' }]],
        },
      },
      (files) => {
        for (const f of files) history.recordInternalWrite(f.path, f.afterHash);
        history.push({ label: { key: 'history:setAttribute', params: { tag: 'svg' } }, files });
      },
    );
    expect(rOk.ok).toBe(true);
    const updated = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    expect(updated).toContain('data-icon="heart"');
    expect(updated).toContain('className="text-red-500"');
    expect(updated).toContain('<path d="M12 21');
    expect(updated).not.toContain('polygon');

    expect((await history.undo(tmpDir)).ok).toBe(true);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8')).toBe(initial);

    expect(
      EditRequestSchema.safeParse({
        edit: {
          kind: 'replaceSvg',
          loc: 'src/App.tsx:3:5',
          tag: 'svg',
          icon: { name: 'bad', node: [['script', { src: '/x.js' }]] },
        },
      }).success,
    ).toBe(false);
    expect(
      EditRequestSchema.safeParse({
        edit: {
          kind: 'replaceSvg',
          loc: 'src/App.tsx:3:5',
          tag: 'svg',
          icon: { name: 'bad', node: [['foreignObject', { width: '10' }]] },
        },
      }).success,
    ).toBe(false);
  });

  it('Test 17: Reveal component generated once, passes strict TS check, wraps/unwraps & Undo byte-for-byte', async () => {
    const initial = [
      'export function App() {',
      '  return (',
      '    <section>',
      '      <h2>Heading</h2>',
      '      <p>Paragraph</p>',
      '    </section>',
      '  );',
      '}',
      '',
    ].join('\n');
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), initial, 'utf8');
    await fs.writeFile(path.join(tmpDir, 'tsconfig.json'), '{}', 'utf8');
    const history = createHistoryService({ fs: nodeFs });

    const r1 = await applyRevealEdit(
      {
        fs: nodeFs,
        onWritten: (files) => {
          for (const f of files) history.recordInternalWrite(f.path, f.afterHash);
          history.push({ label: { key: 'history:wrap', params: { tag: 'Reveal' } }, files });
        },
      },
      tmpDir,
      { action: 'wrap', loc: 'src/App.tsx:4:7', tag: 'h2', effect: 'slide-up', delay: 100 },
    );
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.value.created).toBe(true);
      expect(r1.value.revealFile).toBe('src/kumicraft/Reveal.tsx');
    }

    const revealCode = await fs.readFile(path.join(tmpDir, 'src/kumicraft/Reveal.tsx'), 'utf8');
    expect(revealCode).toContain('IntersectionObserver');
    expect(revealCode).toContain('prefers-reduced-motion: reduce');
    expect(revealCode).not.toContain('null');

    const wrappedTsx = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    expect(wrappedTsx).toContain("import { Reveal } from './kumicraft/Reveal';");
    expect(wrappedTsx).toContain('<Reveal effect="slide-up" delay={100}>');

    // TypeScript check of generated Reveal.tsx against project react types
    const revealAbs = path.join(tmpDir, 'src/kumicraft/Reveal.tsx');
    const studioTypes = path.resolve(__dirname, '../../../../../studio/node_modules/@types');
    const program = ts.createProgram([revealAbs], {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      typeRoots: [studioTypes],
      skipLibCheck: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual(
      [],
    );

    // Second wrap reuses Reveal.tsx without creating again
    const r2 = await applyRevealEdit({ fs: nodeFs }, tmpDir, {
      action: 'wrap',
      loc: 'src/App.tsx:8:7',
      tag: 'p',
      effect: 'zoom',
    });
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.value.created).toBe(false);

    // Unwrap first element works cleanly
    const rUnwrap = await applyRevealEdit({ fs: nodeFs }, tmpDir, {
      action: 'unwrap',
      loc: 'src/App.tsx:6:9',
      tag: 'h2',
    });
    expect(rUnwrap.ok).toBe(true);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8')).not.toContain('slide-up');

    // Separate file test: Undo on wrap deletes Reveal.tsx & restores App.tsx byte-for-byte
    const h2 = createHistoryService({ fs: nodeFs });
    await fs.rm(path.join(tmpDir, 'src/kumicraft'), { recursive: true, force: true });
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), initial, 'utf8');
    const rUndoWrap = await applyRevealEdit(
      {
        fs: nodeFs,
        onWritten: (files) => {
          for (const f of files) h2.recordInternalWrite(f.path, f.afterHash);
          h2.push({ label: { key: 'history:wrap', params: { tag: 'Reveal' } }, files });
        },
      },
      tmpDir,
      { action: 'wrap', loc: 'src/App.tsx:4:7', tag: 'h2', effect: 'fade' },
    );
    expect(rUndoWrap.ok).toBe(true);
    expect((await h2.undo(tmpDir)).ok).toBe(true);
    expect(await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8')).toBe(initial);
    await expect(fs.stat(path.join(tmpDir, 'src/kumicraft/Reveal.tsx'))).rejects.toThrow();
  });
});
