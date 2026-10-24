// Component tests for InspectorPanel (SPEC-04 section 9 M-IN, scenarios 1, 2, 5, 6, 7).
import type { ElementSource, Frame } from '@kumicraft/shared';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClient from '../../api/events-client.ts';
import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { InspectorPanel } from './inspector-panel.tsx';

const mockDesktopFrame: Frame = {
  id: 'desktop',
  label: 'Desktop',
  width: 1440,
  height: 900,
};

const mockMobileFrame: Frame = {
  id: 'mobile',
  label: 'Mobile',
  width: 375,
  height: 667,
};

describe('InspectorPanel Component [SPEC-04 section 9 M-IN]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    vi.spyOn(eventsClient, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    useSelectionStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Scenario 7: renders MultiInspectorView when multiple elements selected [R-IN-10, R-CB-15]', () => {
    act(() => {
      useSelectionStore.getState().setSelectedRefs([
        { loc: 'src/App.tsx:10:2', index: 0 },
        { loc: 'src/App.tsx:20:4', index: 0 },
      ]);
    });

    render(<InspectorPanel />);

    const multi = screen.getByTestId('inspector-multi');
    expect(multi).toBeDefined();
    expect(multi.textContent).toContain('2');
    expect(screen.queryByTestId('inspector-panel')).toBeNull();
  });

  it('Scenario 1: renders all groups and matching values for flex flex-col gap-4 p-6 text-lg font-bold bg-white rounded-xl shadow-md [R-IN-10]', async () => {
    const sampleSource: ElementSource = {
      loc: 'src/App.tsx:15:3',
      tag: 'div',
      fileHash: 'b'.repeat(64),
      className: {
        kind: 'static',
        value: 'flex flex-col gap-4 p-6 text-lg font-bold bg-white rounded-xl shadow-md',
      },
      text: { kind: 'none' },
      attributes: {},
      inLoop: false,
    };

    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(sampleSource);

    act(() => {
      useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:15:3', index: 0 }]);
      useSelectionStore
        .getState()
        .setSelectionInfo([
          { ref: { loc: 'src/App.tsx:15:3', index: 0 }, found: true, tag: 'div', instances: 1 },
        ]);
    });

    render(
      <InspectorPanel
        options={{
          frame: mockDesktopFrame,
          primaryFrame: mockDesktopFrame,
          responsiveMode: 'desktop-first',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('inspector-panel')).toBeDefined();
    });

    // Verify key fields match parsed values
    const displayInput = screen.getByTestId<HTMLSelectElement>('input-display');
    expect(displayInput.value).toBe('flex');

    const flexDirInput = screen.getByTestId<HTMLSelectElement>('input-flexDirection');
    expect(flexDirInput.value).toBe('col');

    const gapInput = screen.getByTestId<HTMLSelectElement>('input-gap');
    expect(gapInput.value).toBe('4');

    const paddingInput = screen.getByTestId<HTMLSelectElement>('input-padding');
    expect(paddingInput.value).toBe('6');

    const fontSizeInput = screen.getByTestId<HTMLSelectElement>('input-fontSize');
    expect(fontSizeInput.value).toBe('lg');

    const fontWeightInput = screen.getByTestId<HTMLSelectElement>('input-fontWeight');
    expect(fontWeightInput.value).toBe('bold');

    expect(screen.getByTestId('color-field-backgroundColor').textContent).toContain('white');

    const roundedInput = screen.getByTestId<HTMLSelectElement>('input-borderRadius');
    expect(roundedInput.value).toBe('xl');

    const shadowInput = screen.getByTestId<HTMLSelectElement>('input-boxShadow');
    expect(shadowInput.value).toBe('md');
  });

  it('Scenario 2: Mobile frame desktop-first with p-6 shows "inherited from base" and max-sm: prefix [R-IN-11]', async () => {
    const sampleSource: ElementSource = {
      loc: 'src/App.tsx:25:2',
      tag: 'div',
      fileHash: 'c'.repeat(64),
      className: { kind: 'static', value: 'p-6' },
      text: { kind: 'none' },
      attributes: {},
      inLoop: false,
    };

    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(sampleSource);

    act(() => {
      useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:25:2', index: 0 }]);
    });

    render(
      <InspectorPanel
        options={{
          frame: mockMobileFrame,
          primaryFrame: mockDesktopFrame,
          responsiveMode: 'desktop-first',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('write-prefix-badge').textContent).toBe('max-sm:');
    });

    const paddingField = screen.getByTestId('property-field-padding');
    expect(paddingField).toBeDefined();

    const inheritedBadge = screen.getByTestId('inherited-badge-padding');
    expect(inheritedBadge.textContent).toContain('base');
  });

  it('Scenario 5: locks all inputs when className is expression with code preview and open editor button [R-IN-15]', async () => {
    const exprSource: ElementSource = {
      loc: 'src/App.tsx:30:5',
      tag: 'div',
      fileHash: 'd'.repeat(64),
      className: { kind: 'expression', code: "cn('p-4', active && 'bg-blue-500')" },
      text: { kind: 'none' },
      attributes: {},
      inLoop: false,
    };

    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(exprSource);

    act(() => {
      useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:30:5', index: 0 }]);
    });

    render(<InspectorPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('lock-banner')).toBeDefined();
    });

    // Inputs should be disabled
    const displayInput = screen.getByTestId<HTMLSelectElement>('input-display');
    expect(displayInput.disabled).toBe(true);

    const paddingInput = screen.getByTestId<HTMLSelectElement>('input-padding');
    expect(paddingInput.disabled).toBe(true);

    // Code snippet rendered
    expect(screen.getByTestId('lock-banner').textContent).toContain(
      "cn('p-4', active && 'bg-blue-500')",
    );
  });

  it('Scenario 6: displays warning banners when component.usages > 1 and inLoop / instances > 1 [R-IN-16]', async () => {
    const loopSource: ElementSource = {
      loc: 'src/components/Card.tsx:10:4',
      tag: 'article',
      fileHash: 'e'.repeat(64),
      className: { kind: 'static', value: 'p-4' },
      text: { kind: 'none' },
      attributes: {},
      component: { name: 'Card', usages: 2 },
      inLoop: true,
    };

    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(loopSource);

    act(() => {
      useSelectionStore
        .getState()
        .setSelectedRefs([{ loc: 'src/components/Card.tsx:10:4', index: 0 }]);
      useSelectionStore.getState().setSelectionInfo([
        {
          ref: { loc: 'src/components/Card.tsx:10:4', index: 0 },
          found: true,
          tag: 'article',
          instances: 3,
        },
      ]);
    });

    render(<InspectorPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('warning-usages')).toBeDefined();
      expect(screen.getByTestId('warning-loop')).toBeDefined();
    });

    expect(screen.getByTestId('warning-usages').textContent).toContain('Card');
    expect(screen.getByTestId('warning-loop').textContent).toContain('3');
  });

  it('writes with the hover prefix after choosing Hover [R-IN-12]', async () => {
    const sampleSource: ElementSource = {
      loc: 'src/App.tsx:15:3',
      tag: 'div',
      fileHash: 'b'.repeat(64),
      className: { kind: 'static', value: 'p-4' },
      text: { kind: 'none' },
      attributes: {},
      inLoop: false,
    };

    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(sampleSource);

    act(() => {
      useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:15:3', index: 0 }]);
      useSelectionStore
        .getState()
        .setSelectionInfo([
          { ref: { loc: 'src/App.tsx:15:3', index: 0 }, found: true, tag: 'div', instances: 1 },
        ]);
    });

    render(
      <InspectorPanel
        options={{
          frame: mockDesktopFrame,
          primaryFrame: mockDesktopFrame,
          responsiveMode: 'desktop-first',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('interaction-state-select')).toBeDefined();
    });

    const badge = screen.getByTestId('write-prefix-badge');
    expect(badge.textContent).toBe('Base');

    const select = screen.getByTestId('interaction-state-select');
    fireEvent.change(select, { target: { value: 'hover' } });

    expect(badge.textContent).toBe('hover:');
  });

  it('lists project font sizes first [R-IN-19]', async () => {
    const sampleSource: ElementSource = {
      loc: 'src/App.tsx:15:3',
      tag: 'div',
      fileHash: 'b'.repeat(64),
      className: { kind: 'static', value: 'p-4' },
      text: { kind: 'none' },
      attributes: {},
      inLoop: false,
    };

    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(sampleSource);

    act(() => {
      useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:15:3', index: 0 }]);
      useSelectionStore
        .getState()
        .setSelectionInfo([
          { ref: { loc: 'src/App.tsx:15:3', index: 0 }, found: true, tag: 'div', instances: 1 },
        ]);
    });

    render(
      <InspectorPanel
        options={{
          frame: mockDesktopFrame,
          primaryFrame: mockDesktopFrame,
          responsiveMode: 'desktop-first',
        }}
        theme={{
          colors: [],
          fontSizes: [{ name: 'hero', value: '3rem' }],
          radii: [],
          fonts: [],
          shadows: [],
          breakpoints: [],
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('input-fontSize')).toBeDefined();
    });

    const fontSizeSelect = screen.getByTestId<HTMLSelectElement>('input-fontSize');
    expect(fontSizeSelect.options[1]?.value).toBe('hero');
  });

  it('reads text-brand as the project color brand [R-IN-19]', async () => {
    const sampleSource: ElementSource = {
      loc: 'src/App.tsx:15:3',
      tag: 'div',
      fileHash: 'b'.repeat(64),
      className: { kind: 'static', value: 'text-brand p-4' },
      text: { kind: 'none' },
      attributes: {},
      inLoop: false,
    };

    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(sampleSource);

    act(() => {
      useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:15:3', index: 0 }]);
      useSelectionStore
        .getState()
        .setSelectionInfo([
          { ref: { loc: 'src/App.tsx:15:3', index: 0 }, found: true, tag: 'div', instances: 1 },
        ]);
    });

    render(
      <InspectorPanel
        options={{
          frame: mockDesktopFrame,
          primaryFrame: mockDesktopFrame,
          responsiveMode: 'desktop-first',
        }}
        theme={{
          colors: [{ name: 'brand', value: '#ff0000' }],
          fontSizes: [],
          radii: [],
          fonts: [],
          shadows: [],
          breakpoints: [],
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('color-field-textColor')).toBeDefined();
    });

    const textColorBtn = screen.getByTestId('color-field-textColor');
    expect(textColorBtn.textContent).toContain('brand');
  });
});
