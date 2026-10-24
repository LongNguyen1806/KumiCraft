// Writing Inspector changes to a Bootstrap 5 project (SPEC-04 M-ST, R-ST-09, R-ST-10).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  type BridgeStyleProbePayload,
  type MatchedRule,
  type StyleChange,
  type StylingReport,
} from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSourceEditorService } from '../source-editor/source-editor-service.ts';
import { nodeFs } from '../workspace/test-support.ts';
import { applyStyleChange } from './style-apply.ts';

const INDEX_CSS = `.btn-buy {
  background-color: #0d6efd;
}
`;
const HOME_TSX = `import './index.css';

export function Home() {
  return (
    <main>
      <div className="card p-3">One</div>
      <div className="card pt-2">Two</div>
    </main>
  );
}
`;

const BOOTSTRAP_STYLING: StylingReport = {
  primary: 'bootstrap',
  systems: [{ id: 'bootstrap', version: '5.3.3' }, { id: 'css' }],
  editable: true,
  globalCss: ['src/index.css'],
};

describe('applyStyleChange with Bootstrap 5 [R-ST-09, R-ST-10]', () => {
  let root: string;
  let ids = 0;

  beforeEach(async () => {
    ids = 0;
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-style-boot-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'src/index.css'), INDEX_CSS);
    await fs.writeFile(path.join(root, 'src/Home.tsx'), HOME_TSX);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const read = (rel: string) => fs.readFile(path.join(root, rel), 'utf8');
  const bootRule = (selector: string): MatchedRule => ({
    sheet: {
      kind: 'module',
      id: path
        .join(root, 'node_modules/bootstrap/dist/css/bootstrap.min.css')
        .replaceAll('\\', '/'),
    },
    selector,
    media: [],
    occurrence: 0,
    ruleIndex: 0,
    declarations: [{ property: 'padding-top', value: '1rem', important: true }],
    affects: 1,
  });
  const probe = (loc: string, rules: MatchedRule[]): BridgeStyleProbePayload => ({
    ref: { loc, index: 0 },
    found: true,
    rules,
    inline: [],
    computed: {},
  });
  const deps = () => ({
    fs: nodeFs,
    sourceEditor: createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' }),
    newId: () => `bt0${String(ids++)}`,
    styling: BOOTSTRAP_STYLING,
  });
  const apply = (loc: string, rules: MatchedRule[], change: StyleChange) =>
    applyStyleChange(deps(), root, { probe: probe(loc, rules), tag: 'div', change });

  it('keeps "all N" a CSS edit when the project rule wins, even on the Bootstrap scale [R-ST-07, R-ST-10]', async () => {
    const projectRule: MatchedRule = {
      sheet: { kind: 'module', id: path.join(root, 'src/index.css').replaceAll('\\', '/') },
      selector: '.btn-buy',
      media: [],
      occurrence: 0,
      ruleIndex: 0,
      declarations: [{ property: 'background-color', value: '#0d6efd', important: false }],
      affects: 3,
    };
    const res = await apply('src/Home.tsx:6:7', [projectRule], {
      property: 'backgroundColor',
      value: '#084298',
      target: 'rule',
    });
    expect(res.ok && res.value.files.map((f) => f.path)).toEqual(['src/index.css']);
    expect(await read('src/Home.tsx')).toBe(HOME_TSX);

    const padRule: MatchedRule = {
      ...projectRule,
      declarations: [{ property: 'padding-top', value: '16px', important: false }],
    };
    const pad = await apply('src/Home.tsx:6:7', [padRule], {
      property: 'paddingTop',
      value: '24px',
      target: 'rule',
    });
    expect(pad.ok && pad.value.className).toBeUndefined();
    expect(await read('src/Home.tsx')).toBe(HOME_TSX);
    expect(await read('src/index.css')).toContain('padding-top: 24px;');
  });

  it('adds pt-4 to card p-3 when setting paddingTop to 24px, modifying only JSX [R-ST-10]', async () => {
    const res = await apply('src/Home.tsx:6:7', [bootRule('.p-3')], {
      property: 'paddingTop',
      value: '24px',
      target: 'rule',
    });

    expect(res.ok && res.value.className).toBe('pt-4');
    expect(res.ok && res.value.files.map((f) => f.path)).toEqual(['src/Home.tsx']);
    expect(await read('src/Home.tsx')).toContain('<div className="card p-3 pt-4">One</div>');
    expect(await read('src/index.css')).toBe(INDEX_CSS);
  });

  it('replaces pt-2 with pt-4 on card pt-2 when setting paddingTop to 24px [R-ST-10]', async () => {
    const res = await apply('src/Home.tsx:7:7', [bootRule('.pt-2')], {
      property: 'paddingTop',
      value: '24px',
      target: 'rule',
    });

    expect(res.ok && res.value.className).toBe('pt-4');
    expect(await read('src/Home.tsx')).toContain('<div className="card pt-4">Two</div>');
  });

  it('adds pt-md-4 while keeping pt-2 when media is (min-width: 768px) [R-ST-09]', async () => {
    const res = await apply('src/Home.tsx:7:7', [bootRule('.pt-2')], {
      property: 'paddingTop',
      value: '24px',
      target: 'rule',
      media: '(min-width: 768px)',
    });

    expect(res.ok && res.value.className).toBe('pt-md-4');
    expect(await read('src/Home.tsx')).toContain('<div className="card pt-2 pt-md-4">Two</div>');
  });

  it('falls back to plain CSS inside @media when media is desktop-first (max-width: 767px) [R-ST-09]', async () => {
    const res = await apply('src/Home.tsx:6:7', [bootRule('.p-3')], {
      property: 'paddingTop',
      value: '24px',
      target: 'rule',
      media: '(max-width: 767px)',
    });

    expect(res.ok && res.value.className).toBe('card-bt00');
    expect(await read('src/Home.tsx')).toContain('<div className="card p-3 card-bt00">One</div>');
    expect(await read('src/index.css')).toBe(
      `${INDEX_CSS}\n@media (max-width: 767px) {\n  .card-bt00 {\n    padding-top: 24px;\n  }\n}\n`,
    );
  });

  it('falls back to plain CSS "only this element" with own class card-xxxx when value 20px is off-scale [R-ST-10]', async () => {
    const res = await apply('src/Home.tsx:6:7', [bootRule('.p-3')], {
      property: 'paddingTop',
      value: '20px',
      target: 'rule',
    });

    expect(res.ok && res.value.className).toBe('card-bt00');
    expect(await read('src/Home.tsx')).toContain('<div className="card p-3 card-bt00">One</div>');
    expect(await read('src/index.css')).toBe(
      `${INDEX_CSS}\n.card-bt00 {\n  padding-top: 20px;\n}\n`,
    );
  });
});
