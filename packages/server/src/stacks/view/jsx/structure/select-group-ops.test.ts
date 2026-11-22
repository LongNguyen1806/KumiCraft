// Tests for K9.8-1 Groups 1 & 2: SelectGroup creation, base/selected split, linking, unwrap, and 1-step Undo.
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { StylingReport } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHistoryService } from '../../../../kernel/history/history-service.ts';
import { nodeFs } from '../../../../services/workspace/test-support.ts';
import { applyLinkSelectContent, applyRemoveSelectGroup } from './select-group-link-ops.ts';
import { applyMakeSelectGroup, type InteractionOpsDeps } from './select-group-ops.ts';

function locOf(file: string, code: string, snippet: string): string {
  const lines = code.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const idx = lines[i]?.indexOf(snippet) ?? -1;
    if (idx >= 0) return `${file}:${String(i + 1)}:${String(idx + 1)}`;
  }
  throw new Error(`Snippet not found: ${snippet}`);
}

const twStyling: StylingReport = {
  systems: [{ id: 'tailwind', version: '4.1.0' }],
  primary: 'tailwind',
  editable: true,
  globalCss: [],
};

const cssStyling: StylingReport = {
  systems: [{ id: 'css' }],
  primary: 'css',
  editable: true,
  globalCss: [],
};

describe('SelectGroup operations (K9.8-1 Groups 1 & 2)', () => {
  let root = '';
  let history: ReturnType<typeof createHistoryService>;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-select-group-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    history = createHistoryService({ fs: nodeFs });
  });

  afterEach(async () => {
    if (root.length > 0) await fs.rm(root, { recursive: true, force: true });
  });

  function makeDeps(styling: StylingReport): InteractionOpsDeps {
    return {
      fs: nodeFs,
      styling,
      sourceDir: 'src',
      onWritten: (files, key, tag) => {
        for (const f of files) history.recordInternalWrite(f.path, f.afterHash);
        history.push({ label: { key, params: { tag } }, files: [...files] });
      },
    };
  }

  it('wraps 4 sibling cards, splits base vs selected Tailwind classes, and restores in 1 Undo', async () => {
    const file = 'src/Plans.tsx';
    const initial = [
      'export function Plans() {',
      '  return (',
      '    <div className="grid grid-cols-4 gap-4">',
      '      <div data-card="1" className="p-4 rounded border-2 border-indigo-500 bg-indigo-50">Basic</div>',
      '      <div data-card="2" className="p-4 rounded border border-gray-200 bg-white">Pro</div>',
      '      <div data-card="3" className="p-4 rounded border border-gray-200 bg-white">Team</div>',
      '      <div data-card="4" className="p-4 rounded border border-gray-200 bg-white">Enterprise</div>',
      '    </div>',
      '  );',
      '}',
    ].join('\n');
    await fs.writeFile(path.join(root, file), initial, 'utf8');

    const res = await applyMakeSelectGroup(makeDeps(twStyling), root, {
      action: 'makeSelectGroup',
      mode: 'single',
      elements: ['data-card="1"', 'data-card="2"', 'data-card="3"', 'data-card="4"'].map((s) => ({
        loc: locOf(file, initial, s).replace(
          /:\d+$/,
          `:${String(
            (initial
              .split('\n')
              .find((l) => l.includes(s))
              ?.indexOf('<div') ?? 0) + 1,
          )}`,
        ),
        tag: 'div',
      })),
    });
    expect(res.ok).toBe(true);

    const nextCode = await fs.readFile(path.join(root, file), 'utf8');
    expect(nextCode).toContain('<SelectGroup defaultValue="item-1" mode="single">');
    expect(nextCode).toContain("import { SelectGroup, SelectItem } from './kumicraft/SelectGroup'");
    // Base shared padding stays outside data-[selected=true], selected card border moves to data-[selected=true]
    expect(nextCode).toContain('data-[selected=true]:border-2');
    expect(nextCode).toContain('data-[selected=true]:border-indigo-500');
    expect(nextCode).toContain('data-[selected=true]:bg-indigo-50');
    expect(nextCode).toContain('border-gray-200');

    // Generated kit file exists
    const kitText = await fs.readFile(path.join(root, 'src/kumicraft/SelectGroup.tsx'), 'utf8');
    expect(kitText).toContain('export function SelectGroup');

    // 1-step Undo reverts source file cleanly
    const undoRes = await history.undo(root);
    expect(undoRes.ok).toBe(true);
    const reverted = await fs.readFile(path.join(root, file), 'utf8');
    expect(reverted).toBe(initial);
  });

  it('splits CSS selected rules on makeSelectGroup, links target into SelectPanels, and unwraps', async () => {
    const file = 'src/Cards.tsx';
    const cssFile = 'src/cards.css';
    await fs.writeFile(
      path.join(root, cssFile),
      '.card { padding: 16px; }\n.card-active { border-color: #4f46e5; }\n',
      'utf8',
    );
    const code = [
      "import './cards.css';",
      'export function Cards() {',
      '  return (',
      '    <div>',
      '      <div className="tabs">',
      '        <div className="card card-active">One</div>',
      '        <div className="card">Two</div>',
      '      </div>',
      '      <section id="preview" data-testid="pv" className="preview"><img src="/hero.png" alt="Hero" /></section>',
      '    </div>',
      '  );',
      '}',
    ].join('\n');
    await fs.writeFile(path.join(root, file), code, 'utf8');

    const deps = makeDeps(cssStyling);
    const made = await applyMakeSelectGroup(deps, root, {
      action: 'makeSelectGroup',
      mode: 'single',
      styleSystem: 'css',
      elements: [
        { loc: locOf(file, code, '<div className="card card-active">'), tag: 'div' },
        { loc: locOf(file, code, '<div className="card">Two'), tag: 'div' },
      ],
    });
    expect(made.ok).toBe(true);
    const cssAfterSplit = await fs.readFile(path.join(root, cssFile), 'utf8');
    expect(cssAfterSplit).toContain('.card[data-selected="true"]');
    expect(cssAfterSplit).toContain('border-color: #4f46e5');

    const afterMake = await fs.readFile(path.join(root, file), 'utf8');
    const linked = await applyLinkSelectContent(deps, root, {
      action: 'linkSelectContent',
      group: { loc: locOf(file, afterMake, '<SelectGroup'), tag: 'SelectGroup' },
      items: [],
      target: { loc: locOf(file, afterMake, '<section id="preview"'), tag: 'section' },
    });
    expect(linked.ok).toBe(true);

    const afterLink = await fs.readFile(path.join(root, file), 'utf8');
    expect(afterLink).toContain('<SelectPanel value="item-1">');
    expect(afterLink).toContain('<SelectPanel value="item-2">');
    expect(afterLink).toContain('<SelectGroup linked');
    // [QA K9.8-1] The copy gets its own id; other attributes ending in "id" are left alone.
    expect(afterLink.match(/ id="preview"/g)?.length).toBe(1);
    expect(afterLink).toContain(' id="preview-2"');
    expect(afterLink.match(/data-testid="pv"/g)?.length).toBe(2);

    const removed = await applyRemoveSelectGroup(deps, root, {
      action: 'removeSelectGroup',
      group: { loc: locOf(file, afterLink, '<SelectGroup'), tag: 'SelectGroup' },
      styleSystem: 'css',
    });
    expect(removed.ok).toBe(true);
    const afterRemove = await fs.readFile(path.join(root, file), 'utf8');
    expect(afterRemove).not.toContain('SelectGroup');
    expect(afterRemove).not.toContain('SelectPanel');
    expect(afterRemove).toContain('className="card"');
  });

  it('rejects elements with different parents or inside .map()', async () => {
    const file = 'src/Bad.tsx';
    const code = [
      'export function Bad({ items }: { items: string[] }) {',
      '  return (',
      '    <div>',
      '      <div><span>A</span></div>',
      '      <div><span>B</span></div>',
      '      {items.map((x) => <button key={x}>{x}</button>)}',
      '    </div>',
      '  );',
      '}',
    ].join('\n');
    await fs.writeFile(path.join(root, file), code, 'utf8');
    const deps = makeDeps(twStyling);

    const diffParent = await applyMakeSelectGroup(deps, root, {
      action: 'makeSelectGroup',
      mode: 'single',
      elements: [
        { loc: locOf(file, code, '<span>A'), tag: 'span' },
        { loc: locOf(file, code, '<span>B'), tag: 'span' },
      ],
    });
    expect(diffParent.ok).toBe(false);
    if (!diffParent.ok) expect(diffParent.error.code).toBe('E023');

    const inLoop = await applyMakeSelectGroup(deps, root, {
      action: 'makeSelectGroup',
      mode: 'single',
      elements: [{ loc: locOf(file, code, '<button key={x}'), tag: 'button' }],
    });
    expect(inLoop.ok).toBe(false);
  });
});
