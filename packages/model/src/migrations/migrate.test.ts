import { describe, expect, it } from 'vitest';

import { migrateWorkspace, type Migration, type WorkspaceFiles } from './migrate.ts';

const files = (version: number): WorkspaceFiles => ({
  workspace: { schemaVersion: version, name: 'Shop' },
  tokens: { schemaVersion: version },
  dataSources: { schemaVersion: version },
  pages: { p_home000001: { schemaVersion: version, title: 'Home' } },
  components: {},
});

describe('migrateWorkspace', () => {
  it('passes a current workspace through the pipeline unchanged (empty migration 1 → 1)', () => {
    const input = files(1);

    const result = migrateWorkspace(input);

    expect(result).toEqual({ ok: true, value: { files: input, from: 1, to: 1, migrated: false } });
  });

  it('runs every step in order and stamps the new version on every file', () => {
    const order: string[] = [];
    const steps: Migration[] = [
      {
        from: 1,
        to: 2,
        migrate: (f) => {
          order.push('1→2');
          const page = f.pages['p_home000001'] as { title: string };
          return { ...f, pages: { p_home000001: { ...page, title: page.title.toUpperCase() } } };
        },
      },
      { from: 0, to: 1, migrate: (f) => (order.push('0→1'), f) },
    ];

    const result = migrateWorkspace(files(0), steps, 2);

    expect(order).toEqual(['0→1', '1→2']);
    expect(result).toMatchObject({
      ok: true,
      value: {
        from: 0,
        to: 2,
        migrated: true,
        files: {
          workspace: { schemaVersion: 2 },
          tokens: { schemaVersion: 2 },
          pages: { p_home000001: { schemaVersion: 2, title: 'HOME' } },
        },
      },
    });
  });

  it('refuses a workspace written by a newer ReactCraft (E004 with schemaVersion)', () => {
    expect(migrateWorkspace(files(3))).toMatchObject({
      ok: false,
      error: { code: 'E004', params: { schemaVersion: 3, supported: 1 } },
    });
  });

  it('reports a missing upgrade path, a failing step and a missing version as E004', () => {
    const failing: Migration[] = [
      {
        from: 0,
        to: 1,
        migrate: () => {
          throw new Error('boom');
        },
      },
    ];

    expect(migrateWorkspace(files(0), [])).toMatchObject({
      ok: false,
      error: { code: 'E004', params: { schemaVersion: 0 } },
    });
    expect(migrateWorkspace(files(0), failing)).toMatchObject({
      ok: false,
      error: { code: 'E004' },
    });
    expect(migrateWorkspace({ ...files(1), workspace: {} })).toMatchObject({
      ok: false,
      error: { code: 'E004' },
    });
  });
});
