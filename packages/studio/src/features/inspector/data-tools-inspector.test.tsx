// @vitest-environment happy-dom
// Tests 4, 7, 9, 10: DataGrid, ComponentProps, FreeFrame Advanced, A11yHints.
import { DEFAULT_DESIGN_DIRS, type ElementSource, type Frame } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClient from '../../api/events-client.ts';
import * as projectClient from '../../api/project-client.ts';
import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useProjectStore } from '../project/project-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { A11yHintsSection } from './components/a11y-hints-section.tsx';
import { ComponentPropsSection } from './components/component-props-section.tsx';
import { DataGridSection } from './components/data-grid-section.tsx';
import { InspectorPanel } from './inspector-panel.tsx';
import type { InspectorTarget } from './types.ts';

const MOCK_DESKTOP: Frame = { id: 'desktop', label: 'Desktop', width: 1440, height: 900 };
const MOCK_MOBILE: Frame = { id: 'mobile', label: 'Mobile', width: 375, height: 667 };

function makeSource(overrides: Partial<ElementSource> = {}): ElementSource {
  return {
    loc: 'src/App.tsx:10:5',
    tag: 'div',
    fileHash: 'a'.repeat(64),
    className: { kind: 'static', value: 'p-4' },
    text: { kind: 'none' },
    attributes: {},
    inLoop: false,
    ...overrides,
  };
}

function makeTarget(
  src: ElementSource,
  refresh = vi.fn(),
): Extract<InspectorTarget, { readonly kind: 'element' }> {
  return {
    kind: 'element',
    ref: { loc: src.loc, index: 0 },
    loading: false,
    source: src,
    warnings: [],
    currentScope: { breakpoint: 'base' },
    writePrefix: '',
    setInteractionState: vi.fn(),
    refresh,
  };
}

describe('Studio K9.7-4 Data & Quality Inspector Controls (Tests 4, 7, 9, 10, 11)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    vi.spyOn(eventsClient, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    useProjectStore.setState({
      project: {
        id: 'p-insp-test',
        name: 'Inspector Test',
        root: '/tmp/insp',
        sourceDir: 'src',
        support: {
          supported: true,
          reasons: [],
          framework: 'vite-react',
          versions: { tailwindcss: '4.0.0' },
          language: 'ts',
          styling: {
            systems: [{ id: 'tailwind' }],
            primary: 'tailwind',
            editable: true,
            globalCss: ['src/index.css'],
          },
        },
        needsInstall: false,
        responsiveMode: 'desktop-first',
        frames: [MOCK_DESKTOP, MOCK_MOBILE],
        primaryFrameId: 'desktop',
        backends: [],
        designDirs: DEFAULT_DESIGN_DIRS,
        trusted: true,
      },
    });
    useSelectionStore.getState().reset();
    useCanvasViewStore.setState({
      draftsDir: 'src/kumicraft/drafts',
      frames: [MOCK_DESKTOP, MOCK_MOBILE],
      openFrames: [
        { id: 'of-desktop', frameId: 'desktop', route: '/', sessionId: 1 },
        { id: 'of-mobile', frameId: 'mobile', route: '/', sessionId: 1 },
      ],
      activeOpenFrameId: 'of-desktop',
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Test 4: DataGrid edits rows and shows readonly banner', async () => {
    const structSpy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      locs: [],
      files: ['src/kumicraft/data/cards.data.ts'],
    });
    const onDone = vi.fn();

    render(
      <DataGridSection
        dataContext={{
          file: 'src/kumicraft/data/cards.data.ts',
          exportName: 'cardsData',
          columns: ['title', 'price'],
          rows: [
            { title: 'Item A', price: 10 },
            { title: 'Item B', price: 20 },
          ],
        }}
        onSaved={onDone}
      />,
    );

    const cell = screen.getByTestId<HTMLInputElement>('data-cell-0-title');
    fireEvent.change(cell, { target: { value: 'Updated A' } });
    fireEvent.click(screen.getByTestId('data-grid-add-row'));
    fireEvent.click(screen.getByTestId('data-grid-save'));

    await waitFor(() => {
      expect(structSpy).toHaveBeenCalledTimes(1);
    });
    const saveArg = structSpy.mock.calls[0]?.[0];
    expect(saveArg?.kind).toBe('setDataArray');
    if (saveArg?.kind === 'setDataArray') {
      expect(saveArg.rows).toHaveLength(3);
      expect(saveArg.rows[0]?.title).toBe('Updated A');
    }

    cleanup();
    render(
      <DataGridSection
        dataContext={{
          file: 'src/App.tsx',
          exportName: 'dynamic',
          columns: [],
          rows: [],
          readonlyReason: 'expression',
        }}
        onSaved={onDone}
      />,
    );
    expect(screen.getByTestId('data-grid-readonly')).toBeDefined();
    expect(screen.queryByTestId('data-grid-save')).toBeNull();
  });

  it('Test 7: ComponentPropsSection renders union/boolean/number/complex controls, blocks on*, and calls setProp', async () => {
    vi.spyOn(projectClient, 'fetchComponentProps').mockResolvedValue({
      tag: 'ActionButton',
      sourceKind: 'typescript',
      props: [
        {
          name: 'variant',
          kind: 'union',
          required: false,
          options: ['solid', 'outline'],
          hasValue: true,
          value: 'solid',
          readonlyExpression: false,
        },
        {
          name: 'disabled',
          kind: 'boolean',
          required: false,
          hasValue: false,
          readonlyExpression: false,
        },
        {
          name: 'count',
          kind: 'number',
          required: true,
          hasValue: true,
          value: 3,
          readonlyExpression: false,
        },
        {
          name: 'renderItem',
          kind: 'complex',
          required: false,
          hasValue: true,
          readonlyExpression: true,
        },
        {
          name: 'onClick',
          kind: 'complex',
          required: false,
          hasValue: true,
          readonlyExpression: true,
        },
      ],
    });
    const editSpy = vi.spyOn(sourceClient, 'editSource').mockResolvedValue({
      changed: true,
      file: 'src/App.tsx',
      fileHash: 'b'.repeat(64),
      element: makeSource({ loc: 'src/App.tsx:20:5', tag: 'ActionButton' }),
    });

    render(
      <ComponentPropsSection
        loc="src/App.tsx:20:5"
        tag="ActionButton"
        fileHash={'a'.repeat(64)}
        disabled={false}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('prop-input-variant')).toBeDefined();
    });
    expect(screen.getByTestId('prop-input-variant').tagName).toBe('SELECT');
    expect(screen.getByTestId<HTMLInputElement>('prop-input-disabled').type).toBe('checkbox');
    expect(screen.getByTestId<HTMLInputElement>('prop-input-count').type).toBe('number');
    expect(screen.getByTestId('prop-readonly-renderItem')).toBeDefined();
    expect(screen.queryByTestId('prop-readonly-onClick')).toBeNull();

    fireEvent.change(screen.getByTestId('prop-input-variant'), { target: { value: 'outline' } });
    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledTimes(1);
    });
    expect(editSpy.mock.calls[0]?.[0].edit).toMatchObject({
      kind: 'setProp',
      name: 'variant',
      value: 'outline',
    });
  });

  it('Test 9 (TK-62): Inspector puts FreeFrameToggle inside Advanced accordion on real pages and keeps it inline on drafts', async () => {
    vi.spyOn(projectClient, 'fetchComponentProps').mockResolvedValue({
      tag: 'div',
      sourceKind: 'unknown',
      props: [],
    });
    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(
      makeSource({ loc: 'src/App.tsx:10:5' }),
    );
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:10:5', index: 0 }]);
    useSelectionStore
      .getState()
      .setSelectionInfo([
        { ref: { loc: 'src/App.tsx:10:5', index: 0 }, found: true, tag: 'div', instances: 1 },
      ]);

    render(
      <InspectorPanel
        options={{
          frame: MOCK_DESKTOP,
          primaryFrame: MOCK_DESKTOP,
          responsiveMode: 'desktop-first',
        }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('free-frame-advanced')).toBeDefined();
    });
    expect(screen.getByTestId('free-frame-toggle')).toBeDefined();

    cleanup();
    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(
      makeSource({ loc: 'src/kumicraft/drafts/Hero.tsx:5:3' }),
    );
    useSelectionStore
      .getState()
      .setSelectedRefs([{ loc: 'src/kumicraft/drafts/Hero.tsx:5:3', index: 0 }]);
    useSelectionStore.getState().setSelectionInfo([
      {
        ref: { loc: 'src/kumicraft/drafts/Hero.tsx:5:3', index: 0 },
        found: true,
        tag: 'div',
        instances: 1,
      },
    ]);

    render(
      <InspectorPanel
        options={{
          frame: MOCK_DESKTOP,
          primaryFrame: MOCK_DESKTOP,
          responsiveMode: 'desktop-first',
        }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('free-frame-toggle')).toBeDefined();
    });
    expect(screen.queryByTestId('free-frame-advanced')).toBeNull();
  });

  it('Test 10 (TK-65): A11yHintsSection surfaces contrast/alt/name hints and applies 1-click aria-label fix', async () => {
    const src = makeSource({ tag: 'button', loc: 'src/App.tsx:30:5' });
    const target = makeTarget(src);
    useSelectionStore.setState({
      selectionInfo: [
        {
          ref: { loc: 'src/App.tsx:30:5', index: 0 },
          found: true,
          tag: 'button',
          instances: 1,
          a11y: {
            hasText: true,
            contrast: 2.1,
            missingAlt: true,
            missingAccessibleName: true,
            unlabeledInput: false,
          },
        },
      ],
    });
    const editSpy = vi.spyOn(sourceClient, 'editSource').mockResolvedValue({
      changed: true,
      file: 'src/App.tsx',
      fileHash: 'c'.repeat(64),
      element: src,
    });

    render(<A11yHintsSection target={target} disabled={false} onFixAltEmpty={vi.fn()} />);

    expect(screen.getByTestId('a11y-contrast-warning').textContent).toContain('2.10');
    expect(screen.getByTestId('a11y-fix-alt-empty')).toBeDefined();

    fireEvent.change(screen.getByTestId('a11y-aria-label-input'), {
      target: { value: 'Close dialog' },
    });
    fireEvent.click(screen.getByTestId('a11y-fix-aria-label'));

    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledTimes(1);
    });
    expect(editSpy.mock.calls[0]?.[0].edit).toMatchObject({
      kind: 'setAttribute',
      name: 'aria-label',
      after: 'Close dialog',
    });
  });
});
