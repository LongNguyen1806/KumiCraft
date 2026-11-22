// Server CSS tests for K9.7-2 TK-9, TK-10..17 (Tests 9-CSS, 13, 16).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { BridgeStyleProbePayload, StyleApplyRequest, StylingReport } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../services/workspace/test-support.ts';
import { createSourceEditorService } from '../view/jsx/source-editor-service.ts';
import { applyStyleChange, type StyleApplyDeps } from './style-apply.ts';
import { createStyleService } from './style-service.ts';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-k972-css-'));
  await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeProbe(
  loc: string,
  sheetId: string,
  selector: string,
  declarations: { property: string; value: string }[],
  kind: 'link' | 'module' = 'link',
): BridgeStyleProbePayload {
  return {
    ref: { loc, index: 0 },
    found: true,
    rules: [
      {
        sheet:
          kind === 'module' ? { kind: 'module', id: sheetId } : { kind: 'link', href: sheetId },
        selector,
        media: [],
        occurrence: 0,
        ruleIndex: 0,
        affects: 1,
        declarations: declarations.map((d) => ({ ...d, important: false })),
      },
    ],
    inline: [],
    computed: Object.fromEntries(declarations.map((d) => [d.property, d.value])),
  };
}

function cssStyling(cssFile: string): StylingReport {
  return {
    systems: [{ id: 'css' }],
    primary: 'css',
    editable: false,
    globalCss: [cssFile],
  };
}

describe('K9.7-2 CSS image, composite merge, and keyframes', () => {
  it('Test 9 (CSS): reads and writes objectFit, objectPosition, aspectRatio across CSS, Modules, Sass, and Less', async () => {
    const jsx =
      'export function App() {\n  return <img className="pic" src="/a.png" alt="a" />;\n}\n';
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), jsx, 'utf8');

    for (const ext of ['css', 'scss', 'less'] as const) {
      const cssFile = `src/styles.${ext}`;
      await fs.writeFile(path.join(tmpDir, cssFile), `.pic { display: block; }\n`, 'utf8');
      const deps: StyleApplyDeps = {
        fs: nodeFs,
        styling: cssStyling(cssFile),
        sourceEditor: createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' }),
      };
      const probe = makeProbe(
        'src/App.tsx:2:10',
        path.join(tmpDir, cssFile).replace(/\\/g, '/'),
        '.pic',
        [],
        'module',
      );

      const res = await applyStyleChange(deps, tmpDir, {
        probe,
        tag: 'img',
        change: { property: 'objectFit', value: 'cover', target: 'rule' },
      });
      expect(res.ok).toBe(true);
      const res2 = await applyStyleChange(deps, tmpDir, {
        probe,
        tag: 'img',
        change: { property: 'aspectRatio', value: '16 / 9', target: 'rule' },
      });
      expect(res2.ok).toBe(true);
      const written = await fs.readFile(path.join(tmpDir, cssFile), 'utf8');
      expect(written).toContain('object-fit: cover');
      expect(written).toContain('aspect-ratio: 16 / 9');
    }

    // CSS Module read/write check
    const modCss = 'src/Pic.module.css';
    await fs.writeFile(
      path.join(tmpDir, 'src/Pic.tsx'),
      "import styles from './Pic.module.css';\nexport function Pic() { return <img className={styles.pic} src='/a.png' alt='a' />; }\n",
      'utf8',
    );
    await fs.writeFile(path.join(tmpDir, modCss), `.pic { object-position: center; }\n`, 'utf8');
    const modDeps: StyleApplyDeps = {
      fs: nodeFs,
      styling: cssStyling(modCss),
      sourceEditor: createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' }),
    };
    const modProbe = makeProbe(
      'src/Pic.tsx:2:32',
      path.join(tmpDir, modCss).replace(/\\/g, '/'),
      '._pic_123',
      [{ property: 'object-position', value: 'center' }],
      'module',
    );
    const modRes = await applyStyleChange(modDeps, tmpDir, {
      probe: modProbe,
      tag: 'img',
      change: { property: 'objectFit', value: 'contain', target: 'rule' },
    });
    expect(modRes.ok).toBe(true);
    expect(await fs.readFile(path.join(tmpDir, modCss), 'utf8')).toContain('object-fit: contain');
  });

  it('Test 13: CSS composite merge updates transform/transition/filter/linear-gradient without clobbering sibling sub-functions and reads back sub-values', async () => {
    const cssFile = 'src/styles.css';
    const initialCss = [
      '.card {',
      '  transform: scale(0.95);',
      '  transition: transform 150ms ease-in;',
      '  filter: grayscale(100%);',
      '  background-image: linear-gradient(to right, #000000, #ffffff);',
      '}',
      '',
    ].join('\n');
    await fs.writeFile(path.join(tmpDir, cssFile), initialCss, 'utf8');
    await fs.writeFile(
      path.join(tmpDir, 'src/App.tsx'),
      'export function App() { return <div className="card">x</div>; }\n',
      'utf8',
    );
    const deps: StyleApplyDeps = {
      fs: nodeFs,
      styling: cssStyling(cssFile),
      sourceEditor: createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' }),
    };
    const probe = makeProbe(
      'src/App.tsx:1:32',
      path.join(tmpDir, cssFile).replace(/\\/g, '/'),
      '.card',
      [
        { property: 'transform', value: 'scale(0.95)' },
        { property: 'transition', value: 'transform 150ms ease-in' },
        { property: 'filter', value: 'grayscale(100%)' },
        { property: 'background-image', value: 'linear-gradient(to right, #000000, #ffffff)' },
      ],
      'module',
    );
    const req = (
      property: StyleApplyRequest['change']['property'],
      value: string | undefined,
    ): StyleApplyRequest => ({
      probe,
      tag: 'div',
      change: { property, value, target: 'rule' },
    });

    expect((await applyStyleChange(deps, tmpDir, req('rotate', '45deg'))).ok).toBe(true);
    expect((await applyStyleChange(deps, tmpDir, req('duration', '300ms'))).ok).toBe(true);
    expect((await applyStyleChange(deps, tmpDir, req('blur', '4px'))).ok).toBe(true);
    expect((await applyStyleChange(deps, tmpDir, req('gradientTo', '#ff0000'))).ok).toBe(true);

    const out = await fs.readFile(path.join(tmpDir, cssFile), 'utf8');
    expect(out).toContain('transform: scale(0.95) rotate(45deg)');
    expect(out).toContain('transition: transform 300ms ease-in');
    expect(out).toContain('filter: grayscale(100%) blur(4px)');
    expect(out).toContain('linear-gradient(to right, #000000, #ff0000)');

    // StyleService reads individual sub-values back accurately
    const reading = await createStyleService({ fs: nodeFs }).read(
      { root: tmpDir, styling: cssStyling(cssFile) },
      makeProbe(
        'src/App.tsx:1:32',
        path.join(tmpDir, cssFile).replace(/\\/g, '/'),
        '.card',
        [
          { property: 'transform', value: 'scale(0.95) rotate(45deg)' },
          { property: 'transition', value: 'transform 300ms ease-in' },
          { property: 'filter', value: 'grayscale(100%) blur(4px)' },
          { property: 'background-image', value: 'linear-gradient(to right, #000000, #ff0000)' },
        ],
        'module',
      ),
    );
    const valOf = (id: string) => reading.properties.find((p) => p.id === id)?.value?.css;
    expect(valOf('rotate')).toBe('45deg');
    expect(valOf('scale')).toBe('0.95');
    expect(valOf('duration')).toBe('300ms');
    expect(valOf('blur')).toBe('4px');
    expect(valOf('grayscale')).toBe('100%');
    expect(valOf('gradientTo')).toBe('#ff0000');

    // Removing rotate restores scale(0.95)
    expect((await applyStyleChange(deps, tmpDir, req('rotate', undefined))).ok).toBe(true);
    const afterRemove = await fs.readFile(path.join(tmpDir, cssFile), 'utf8');
    expect(afterRemove).toContain('transform: scale(0.95)');
    expect(afterRemove).not.toContain('rotate(45deg)');
  });

  it('Test 16: animation injects @keyframes once into CSS and never duplicates on subsequent writes', async () => {
    const cssFile = 'src/styles.css';
    await fs.writeFile(path.join(tmpDir, cssFile), `.box { display: block; }\n`, 'utf8');
    await fs.writeFile(
      path.join(tmpDir, 'src/App.tsx'),
      'export function App() { return <div className="box">x</div>; }\n',
      'utf8',
    );
    const deps: StyleApplyDeps = {
      fs: nodeFs,
      styling: cssStyling(cssFile),
      sourceEditor: createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' }),
    };
    const probe = makeProbe(
      'src/App.tsx:1:32',
      path.join(tmpDir, cssFile).replace(/\\/g, '/'),
      '.box',
      [],
      'module',
    );

    expect(
      (
        await applyStyleChange(deps, tmpDir, {
          probe,
          tag: 'div',
          change: { property: 'animation', value: 'kc-fade-in 400ms ease-out', target: 'rule' },
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await applyStyleChange(deps, tmpDir, {
          probe,
          tag: 'div',
          change: { property: 'animation', value: 'kc-fade-in 700ms ease-in', target: 'rule' },
        })
      ).ok,
    ).toBe(true);

    const out = await fs.readFile(path.join(tmpDir, cssFile), 'utf8');
    const matches = out.match(/@keyframes\s+kc-fade-in/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(out).toContain('animation: kc-fade-in 700ms ease-in');
  });
});
