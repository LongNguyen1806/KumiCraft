// Tests for K9 Chặng B scenarios B3, B4, B6 [WP-4.00]
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  bandOf,
  type BridgeStyleProbePayload,
  editBreakpoint,
  projectBreakpoints,
  type StylingReport,
  type ThemeInfo,
} from '@kumicraft/shared';
import { writeValue } from '@kumicraft/style-tailwind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../kernel/history/history-service.ts';
import { nodeFs } from '../../services/workspace/test-support.ts';
import { createSourceEditorService } from '../view/jsx/source-editor-service.ts';
import { applyStyleChange } from './style-apply.ts';
import { createStyleService } from './style-service.ts';

const cssStyling: StylingReport = {
  systems: [{ id: 'css' }],
  primary: 'css',
  editable: true,
  globalCss: [],
};

describe('Inspector Extended B3, B4, B6 [WP-4.00]', () => {
  let root: string;
  let history: ReturnType<typeof createHistoryService>;
  let sourceEditor: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-extended-b-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    history = createHistoryService({ fs: nodeFs });
    sourceEditor = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('B3: Tailwind 4 with --breakpoint-3xl: 1920px has 3xl after 2xl and frame 1920 writes 3xl: [WP-4.00]', () => {
    const theme: ThemeInfo = {
      colors: [],
      fontSizes: [],
      radii: [],
      fonts: [],
      shadows: [],
      breakpoints: [{ name: '--breakpoint-3xl', value: '1920px' }],
    };

    const bps = projectBreakpoints(theme);
    const keys = bps.map((b) => b.key);
    expect(keys).toEqual(['sm', 'md', 'lg', 'xl', '2xl', '3xl']);
    const item3xl = bps.find((b) => b.key === '3xl');
    expect(item3xl?.min).toBe(1920);

    // Mobile-first: width 1920 belongs to 3xl band; primary 375 is base
    expect(bandOf(1920, 'mobile-first', bps)).toBe('3xl');
    const mobileBp = editBreakpoint(1920, 375, 'mobile-first', bps);
    expect(mobileBp).toBe('3xl');

    const ctx = {
      theme,
      mode: 'mobile-first' as const,
      breakpoints: Object.fromEntries(bps.map((b) => [b.key, b.min])),
    };
    const writtenMobile = writeValue(
      '',
      'paddingTop',
      { breakpoint: mobileBp },
      { kind: 'scale', token: '6' },
      ctx,
    );
    expect(writtenMobile).toBe('3xl:pt-6');

    // Desktop-first: width 1800 (< 1920) belongs to 3xl band; primary 2560 is base
    expect(bandOf(1800, 'desktop-first', bps)).toBe('3xl');
    const desktopBp = editBreakpoint(1800, 2560, 'desktop-first', bps);
    expect(desktopBp).toBe('3xl');

    const ctxDesktop = {
      theme,
      mode: 'desktop-first' as const,
      breakpoints: Object.fromEntries(bps.map((b) => [b.key, b.min])),
    };
    const writtenDesktop = writeValue(
      '',
      'paddingTop',
      { breakpoint: desktopBp },
      { kind: 'scale', token: '6' },
      ctxDesktop,
    );
    expect(writtenDesktop).toBe('max-3xl:pt-6');
  });

  it('B4: unknown breakpoint key sent to server is rejected with error code E016 [WP-4.00]', async () => {
    const cssPath = path.join(root, 'src/Card.css');
    await fs.writeFile(cssPath, '.card { color: black; }\n');
    const tsxPath = path.join(root, 'src/Card.tsx');
    await fs.writeFile(
      tsxPath,
      `import './Card.css';\nexport function Card() { return <div className="card">Hi</div>; }\n`,
    );

    const probe: BridgeStyleProbePayload = {
      ref: { loc: 'src/Card.tsx:2:47', index: 0 },
      found: true,
      rules: [
        {
          selector: '.card',
          sheet: { kind: 'module', id: path.join(root, 'src/Card.css').replaceAll('\\', '/') },
          media: [],
          occurrence: 0,
          ruleIndex: 0,
          declarations: [{ property: 'color', value: 'black', important: false }],
          affects: 1,
        },
      ],
      inline: [],
      computed: { color: 'rgb(0, 0, 0)' },
    };

    // Unknown breakpoint 'weird' should be rejected
    const rejected = await applyStyleChange(
      {
        fs: nodeFs,
        sourceEditor,
        styling: cssStyling,
      },
      root,
      {
        probe,
        tag: 'div',
        change: {
          property: 'textColor',
          target: 'rule',
          value: 'blue',
          breakpoint: 'weird',
        },
      },
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error).toEqual({
        code: 'E016',
        params: { reason: 'unknownBreakpoint' },
      });
    }

    // Known project breakpoint '3xl' is accepted
    const customTheme: ThemeInfo = {
      colors: [],
      fontSizes: [],
      radii: [],
      fonts: [],
      shadows: [],
      breakpoints: [{ name: '--breakpoint-3xl', value: '1920px' }],
    };
    const accepted = await applyStyleChange(
      {
        fs: nodeFs,
        sourceEditor,
        styling: cssStyling,
        theme: customTheme,
      },
      root,
      {
        probe,
        tag: 'div',
        change: {
          property: 'textColor',
          target: 'rule',
          value: 'blue',
          breakpoint: '3xl',
        },
      },
    );
    expect(accepted.ok).toBe(true);
  });

  it('B6: plain CSS border-radius: 4px 8px reads tl=4, tr=8, br=4, bl=8; editing tl writes border-top-left-radius and undo restores [WP-4.00]', async () => {
    const originalCss = `.box {
  border-radius: 4px 8px;
}
`;
    const cssPath = path.join(root, 'src/box.css');
    await fs.writeFile(cssPath, originalCss, 'utf8');

    const tsxPath = path.join(root, 'src/Box.tsx');
    await fs.writeFile(
      tsxPath,
      `import './box.css';
export function Box() {
  return <div className="box">Box</div>;
}
`,
      'utf8',
    );

    const probe: BridgeStyleProbePayload = {
      ref: { loc: 'src/Box.tsx:3:10', index: 0 },
      found: true,
      rules: [
        {
          selector: '.box',
          sheet: { kind: 'module', id: path.join(root, 'src/box.css').replaceAll('\\', '/') },
          media: [],
          occurrence: 0,
          ruleIndex: 0,
          declarations: [{ property: 'border-radius', value: '4px 8px', important: false }],
          affects: 1,
        },
      ],
      inline: [],
      computed: {
        'border-radius': '4px 8px',
      },
    };

    // 1. Read: reads tl=4px, tr=8px, br=4px, bl=8px
    const styleService = createStyleService({ fs: nodeFs });
    const reading = await styleService.read({ root, styling: cssStyling }, probe);

    const tl = reading.properties.find((p) => p.id === 'borderTopLeftRadius');
    const tr = reading.properties.find((p) => p.id === 'borderTopRightRadius');
    const br = reading.properties.find((p) => p.id === 'borderBottomRightRadius');
    const bl = reading.properties.find((p) => p.id === 'borderBottomLeftRadius');

    expect(tl?.value?.css).toBe('4px');
    expect(tr?.value?.css).toBe('8px');
    expect(br?.value?.css).toBe('4px');
    expect(bl?.value?.css).toBe('8px');

    // 2. Edit tl: writes border-top-left-radius: 12px
    const editRes = await applyStyleChange(
      {
        fs: nodeFs,
        sourceEditor,
        styling: cssStyling,
      },
      root,
      {
        probe,
        tag: 'div',
        change: {
          property: 'borderTopLeftRadius',
          target: 'rule',
          value: '12px',
        },
      },
    );
    expect(editRes.ok).toBe(true);
    if (!editRes.ok) return;

    // Simulate history push as done in style routes
    for (const f of editRes.value.files) {
      history.recordInternalWrite(f.path, f.afterHash);
    }
    history.push({
      label: { key: 'history:setStyle', params: { tag: 'div' } },
      files: editRes.value.files,
    });

    const editedCss = await fs.readFile(cssPath, 'utf8');
    expect(editedCss).toContain('border-top-left-radius: 12px;');

    // 3. One step undo restores original file
    const undoRes = await history.undo(root);
    expect(undoRes.ok).toBe(true);

    const revertedCss = await fs.readFile(cssPath, 'utf8');
    expect(revertedCss).toBe(originalCss);
  });
});
