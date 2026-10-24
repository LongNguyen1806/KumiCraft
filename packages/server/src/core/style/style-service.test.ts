// Style layer reading on the server (SPEC-04 M-ST, R-ST-02 to R-ST-05).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { BridgeStyleProbePayload, MatchedRule, StylingSystemId } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../workspace/test-support.ts';
import { locateRule } from './css-locate.ts';
import { createStyleService, primarySystem, projectFileOf } from './style-service.ts';

const CARD_CSS = `.card {
  padding: 16px;
  border-radius: 8px;
}

.home .card {
  background-color: #fff;
}

@media (max-width: 640px) {
  .card {
    padding: 8px;
  }
}

.card {
  padding-top: 20px;
}
`;

describe('locateRule [R-ST-04]', () => {
  it('finds a rule by selector, @media and occurrence, and the shorthand line of a longhand', () => {
    expect(
      locateRule(CARD_CSS, { selector: '.card', media: [], occurrence: 0 }, ['padding-top']),
    ).toEqual({
      line: 1,
      declarations: { 'padding-top': 2 },
    });
    expect(
      locateRule(CARD_CSS, { selector: '.card', media: ['(max-width:640px)'], occurrence: 0 }, [
        'padding-top',
      ]),
    ).toEqual({ line: 11, declarations: { 'padding-top': 12 } });
    expect(
      locateRule(CARD_CSS, { selector: '.card', media: [], occurrence: 1 }, ['padding-top'])?.line,
    ).toBe(16);
    expect(
      locateRule(CARD_CSS, { selector: '.home   .card', media: [], occurrence: 0 }, [])?.line,
    ).toBe(6);
  });

  it('is undefined for a rule the file does not have, or a file that does not parse', () => {
    expect(
      locateRule(CARD_CSS, { selector: '.p-4', media: [], occurrence: 0 }, []),
    ).toBeUndefined();
    expect(
      locateRule('.a { color: red', { selector: '.a', media: [], occurrence: 0 }, []),
    ).toBeUndefined();
  });
});

describe('primarySystem and projectFileOf [R-ST-03]', () => {
  it('prefers Tailwind, then Bootstrap, CSS Modules, Sass, Less, plain CSS', () => {
    const report = (ids: StylingSystemId[]) => ({
      systems: ids.map((id) => ({ id })),
      editable: false,
      globalCss: [],
    });
    expect(primarySystem(report(['css', 'tailwind']))).toBe('tailwind4');
    expect(primarySystem(report(['css', 'bootstrap', 'cssModules']))).toBe('bootstrap5');
    expect(primarySystem(report(['css', 'cssModules']))).toBe('cssModules');
    expect(primarySystem(report(['css']))).toBe('css');
    expect(primarySystem(report(['styledComponents']))).toBeUndefined();
  });

  it('turns a Vite module id into a project path, and refuses node_modules or outside files', () => {
    const root = path.resolve('/work/app');
    const abs = (rel: string) => path.join(root, rel).replaceAll('\\', '/');
    expect(projectFileOf(root, `${abs('src/Card.css')}?used`)).toBe('src/Card.css');
    expect(
      projectFileOf(root, abs('node_modules/bootstrap/dist/css/bootstrap.css')),
    ).toBeUndefined();
    expect(projectFileOf(root, path.resolve('/elsewhere/x.css'))).toBeUndefined();
    expect(projectFileOf(root, '/@vite/client')).toBeUndefined();
  });
});

describe('createStyleService().read [R-ST-04, R-ST-05]', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-style-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'src/Card.css'), CARD_CSS);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const rule = (over: Partial<MatchedRule>): MatchedRule => ({
    sheet: { kind: 'module', id: path.join(root, 'src/Card.css').replaceAll('\\', '/') },
    selector: '.card',
    media: [],
    occurrence: 0,
    declarations: [],
    affects: 3,
    ...over,
  });

  const probe = (over: Partial<BridgeStyleProbePayload>): BridgeStyleProbePayload => ({
    ref: { loc: 'src/Card.tsx:4:5', index: 0 },
    found: true,
    rules: [],
    inline: [],
    computed: {
      'padding-top': '16px',
      color: 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
    },
    ...over,
  });

  it('gives each declared property the line that wins, with how many elements share the rule', async () => {
    const service = createStyleService({ fs: nodeFs });
    const reading = await service.read(
      { root, styling: { systems: [{ id: 'css' }], editable: false, globalCss: [] } },
      probe({
        rules: [
          rule({
            selector: '.home .card',
            declarations: [{ property: 'background-color', value: '#fff', important: false }],
          }),
          rule({ declarations: [{ property: 'padding-top', value: '16px', important: false }] }),
        ],
      }),
    );

    expect(reading.primary).toBe('css');
    const byId = Object.fromEntries(reading.properties.map((p) => [p.id, p]));
    expect(byId['paddingTop']).toEqual({
      id: 'paddingTop',
      value: { css: '16px' },
      source: {
        kind: 'rule',
        system: 'css',
        file: 'src/Card.css',
        line: 2,
        selector: '.card',
        affects: 3,
      },
      editable: true,
    });
    expect(byId['backgroundColor']?.source).toMatchObject({
      kind: 'rule',
      line: 7,
      selector: '.home .card',
    });
    expect(byId['textColor']?.source).toEqual({ kind: 'inherited' });
  });

  it('lets !important beat the style attribute, the style attribute beat normal rules, and marks outside sheets', async () => {
    const service = createStyleService({ fs: nodeFs });
    const reading = await service.read(
      { root },
      probe({
        rules: [
          rule({ declarations: [{ property: 'padding-top', value: '16px', important: false }] }),
          rule({
            sheet: { kind: 'link', href: 'https://cdn.example/bootstrap.css' },
            selector: '.text-dark',
            declarations: [{ property: 'color', value: '#000', important: true }],
          }),
        ],
        inline: [
          { property: 'padding-top', value: '4px', important: false },
          { property: 'color', value: 'red', important: false },
        ],
      }),
    );

    const byId = Object.fromEntries(reading.properties.map((p) => [p.id, p]));
    expect(byId['paddingTop']).toMatchObject({ source: { kind: 'inline' }, editable: false });
    expect(byId['textColor']).toMatchObject({
      source: { kind: 'external', href: 'https://cdn.example/bootstrap.css' },
      editable: false,
      reason: 'external',
    });
    expect(reading.primary).toBeUndefined();
  });
});
