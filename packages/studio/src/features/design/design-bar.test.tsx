// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { useComponentsStore } from '../components-panel/use-project-components.ts';
import { DesignBar } from './design-bar.tsx';
import { useDesignStore } from './design-store.ts';

describe('DesignBar (Scenario #10) [R-CP-11]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
    useDesignStore.getState().setTarget(undefined);
  });

  it('renders page name and file when design target has a file', () => {
    useDesignStore.getState().setTarget({
      kind: 'page',
      name: 'Home',
      file: 'src/pages/Home.tsx',
      route: '/',
    });

    render(<DesignBar />);

    expect(screen.getByTestId('design-bar')).toBeDefined();
    expect(screen.getByTestId('design-bar-name').textContent).toBe('Home');
    expect(screen.getByTestId('design-bar-file').textContent).toBe('src/pages/Home.tsx');
  });

  it('renders unknown file notice when design target has no file', () => {
    useDesignStore.getState().setTarget({
      kind: 'page',
      name: 'Custom',
      route: '/custom',
    });

    render(<DesignBar />);

    expect(screen.getByTestId('design-bar')).toBeDefined();
    expect(screen.getByTestId('design-bar-name').textContent).toBe('Custom');
    expect(
      screen.getByText(/The file of this page is unknown|Chưa biết file của trang này/),
    ).toBeDefined();
  });

  it('Scenario 14: renders component kind, name, file, usages and back button in component mode [R-CP-15]', () => {
    useComponentsStore.getState().setComponents([
      {
        name: 'Header',
        file: 'src/components/Header.tsx',
        kind: 'component',
        usages: 3,
        importStatement: "import { Header } from '@/components/Header';",
      },
    ]);

    useDesignStore.getState().enterComponentMode({
      componentName: 'Header',
      filePath: 'src/components/Header.tsx',
    });

    render(<DesignBar />);

    expect(screen.getByTestId('design-bar-kind').textContent).toMatch(/Component/);
    expect(screen.getByTestId('design-bar-name').textContent).toBe('Header');
    expect(screen.getByTestId('design-bar-file').textContent).toBe('src/components/Header.tsx');
    expect(screen.getByTestId('design-bar-usages').textContent).toContain('3');
    expect(screen.getByTestId('design-bar-back')).toBeDefined();

    // Clicking back exits component mode
    screen.getByTestId('design-bar-back').click();
    expect(useDesignStore.getState().componentMode).toBeUndefined();
  });
});
