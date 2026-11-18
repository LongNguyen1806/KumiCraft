// A source file created while the dev server runs reloads the CSS modules once, so Tailwind scans
// again and the new file's classes get CSS (the owner's report, 2026-11-18; tour 12c, 12d).
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type CssRefreshServer, watchCreatedSources } from './css-refresh.ts';

const ROOT = join('D:', 'project');

function fakeServer() {
  let onAdd: (file: string) => void = () => undefined;
  const css = { file: join(ROOT, 'src', 'index.css') };
  const js = { file: join(ROOT, 'src', 'App.tsx') };
  const reloaded: unknown[] = [];
  const server: CssRefreshServer = {
    watcher: {
      on: (_event, listener) => {
        onAdd = listener;
      },
    },
    moduleGraph: {
      idToModuleMap: new Map<string, { readonly file?: unknown }>([
        ['/src/index.css', css],
        ['/src/App.tsx', js],
      ]),
    },
    reloadModule: (module) => {
      reloaded.push(module);
      return Promise.resolve();
    },
  };
  watchCreatedSources(server, { rootDir: ROOT, sourceDir: 'src' });
  return {
    add: (file: string) => {
      onAdd(file);
    },
    reloaded,
    css,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('watchCreatedSources', () => {
  it('reloads the CSS once when source files are created [R-DR-12]', () => {
    const { add, reloaded, css } = fakeServer();
    add(join(ROOT, 'src', 'drafts', 'BanNhap1.tsx'));
    add(join(ROOT, 'src', 'kumicraft', 'Reveal.tsx'));
    vi.runAllTimers();
    expect(reloaded).toEqual([css]);
  });

  it('leaves a created stylesheet and a file outside the source folder alone [R-DR-12]', () => {
    const { add, reloaded } = fakeServer();
    add(join(ROOT, 'src', 'theme.css'));
    add(join(ROOT, 'dist', 'index.js'));
    vi.runAllTimers();
    expect(reloaded).toEqual([]);
  });
});
