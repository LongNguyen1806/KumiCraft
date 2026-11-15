// @vitest-environment happy-dom
import type { ProjectComponent } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as eventsClient from '../../api/events-client.ts';
import * as projectClient from '../../api/project-client.ts';
import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useDesignStore } from '../design/design-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { ComponentsPanel } from './components-panel.tsx';
import { useComponentsStore } from './use-project-components.ts';

describe('ComponentsPanel (Scenarios #11, #12) [R-CP-12, R-CP-13]', () => {
  const mockComponents: readonly ProjectComponent[] = [
    {
      name: 'MainLayout',
      file: 'src/layouts/MainLayout.tsx',
      kind: 'layout',
      usages: 2,
      importStatement: "import { MainLayout } from '@/layouts/MainLayout';",
    },
    {
      name: 'Header',
      file: 'src/components/Header.tsx',
      kind: 'component',
      usages: 1,
      importStatement: "import { Header } from '@/components/Header';",
    },
    {
      name: 'Card',
      file: 'src/components/ui/Card.tsx',
      kind: 'component',
      usages: 3,
      importStatement: "import { Card } from '@/components/ui/Card';",
    },
    {
      name: 'ProductCard',
      file: 'src/components/ProductCard.tsx',
      kind: 'component',
      usages: 1,
      importStatement: "import { ProductCard } from '@/components/ProductCard';",
    },
  ];

  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useSelectionStore.getState().reset();
    useDesignStore.getState().setTarget(undefined);
  });

  it('Scenario 11: search filters components, layout has badge, self-insert is disabled [R-CP-12]', async () => {
    vi.spyOn(projectClient, 'fetchComponents').mockResolvedValue([...mockComponents]);
    useDesignStore.getState().setTarget({
      kind: 'page',
      name: 'ProductCard',
      file: 'src/components/ProductCard.tsx',
      route: '/card',
    });

    render(<ComponentsPanel />);

    // Wait for components to load
    const mainLayout = await screen.findByTestId('component-item-MainLayout');
    expect(mainLayout).toBeDefined();
    expect(mainLayout.textContent).toMatch(/Bố cục|Layout/);

    // Self-insert: ProductCard file matches designFile
    const productCard = screen.getByTestId('component-item-ProductCard');
    expect(productCard.getAttribute('aria-disabled')).toBe('true');

    // Search for "card"
    const searchInput = screen.getByTestId('component-search');
    fireEvent.change(searchInput, { target: { value: 'card' } });

    expect(screen.getByTestId('component-item-Card')).toBeDefined();
    expect(screen.getByTestId('component-item-ProductCard')).toBeDefined();
    expect(screen.queryByTestId('component-item-MainLayout')).toBeNull();
    expect(screen.queryByTestId('component-item-Header')).toBeNull();
  });

  it('Scenario 12: + on ProductCard when section selected calls applyStructureEdit [R-CP-13]', async () => {
    vi.spyOn(projectClient, 'fetchComponents').mockResolvedValue([...mockComponents]);
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/pages/Home.tsx'],
      locs: ['src/pages/Home.tsx:25:5'],
    });

    useDesignStore.getState().setTarget({
      kind: 'page',
      name: 'Home',
      file: 'src/pages/Home.tsx',
      route: '/',
    });
    useSelectionStore.getState().setTree([
      {
        ref: { loc: 'src/pages/Home.tsx:15:3', index: 0 },
        tag: 'section',
        instances: 1,
      },
    ]);
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/pages/Home.tsx:15:3', index: 0 }]);
    useSelectionStore.getState().setSelectionInfo([
      {
        ref: { loc: 'src/pages/Home.tsx:15:3', index: 0 },
        found: true,
        tag: 'section',
        instances: 1,
      },
    ]);

    render(<ComponentsPanel />);

    // A click on the item itself inserts nothing; its + button does.
    fireEvent.click(await screen.findByTestId('component-item-ProductCard'));
    expect(spy).not.toHaveBeenCalled();
    // The section is not a free frame: the component goes into the flow, without a position.
    const parentLookup = vi.spyOn(sourceClient, 'fetchElementSourceByLoc').mockResolvedValue({
      loc: 'src/pages/Home.tsx:15:3',
      tag: 'section',
      fileHash: 'a'.repeat(64),
      className: { kind: 'static', value: 'py-12' },
      text: { kind: 'none' },
      attributes: {},
      inLoop: false,
    });
    fireEvent.click(screen.getByTestId('component-add-ProductCard'));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    expect(parentLookup).toHaveBeenCalledWith('src/pages/Home.tsx:15:3');
    expect(spy).toHaveBeenCalledWith({
      kind: 'insert',
      target: {
        kind: 'child',
        parent: { loc: 'src/pages/Home.tsx:15:3', tag: 'section' },
        where: 'end',
      },
      jsx: '<ProductCard />',
      from: {
        file: 'src/components/ProductCard.tsx',
        imports: ["import { ProductCard } from '@/components/ProductCard';"],
      },
    });
  });

  it('says the list could not be read, not that there is none, and Try again reads it again (spec-log #122)', async () => {
    useComponentsStore.getState().reset();
    vi.spyOn(eventsClient, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    const fetchSpy = vi
      .spyOn(projectClient, 'fetchComponents')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue([...mockComponents]);
    render(<ComponentsPanel />);

    expect(await screen.findByTestId('components-load-failed')).toBeDefined();
    expect(screen.queryByText('This project has no components yet')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Header')).toBeDefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    useComponentsStore.getState().reset();
  });
});
