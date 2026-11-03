// SPEC-03 section 3: the workspace file of a project.
import { describe, expect, it } from 'vitest';

import { ProjectInfoSchema } from './project.ts';
import { relPathProblem } from './rel-path.ts';
import {
  DEFAULT_DESIGN_DIRS,
  defaultFrames,
  DesignDirsSchema,
  LoginSessionsSchema,
  newWorkspaceFile,
  normalizeDesignDirs,
  normalizeSessions,
  normalizeWorkspaceAi,
  parseWorkspaceFile,
  serializeWorkspaceFile,
  sessionOrigin,
} from './workspace-file.ts';

const base = () =>
  newWorkspaceFile({
    id: 'abcdefghij',
    name: 'Shop',
    createdAt: '2026-10-14T08:00:00.000Z',
    responsiveMode: 'desktop-first',
  });

describe('relPathProblem', () => {
  it('accepts project-relative paths [V-100]', () => {
    expect(['src', 'src/pages/Home.tsx', '.kumicraft/workspace.json'].map(relPathProblem)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('rejects absolute, parent, empty, backslash and control-character paths [V-100]', () => {
    const bad = [
      '',
      '/src',
      'C:/src',
      'c:x',
      '../x',
      'src/../x',
      'a//b',
      './a',
      'a\\b',
      'a\u0000b',
    ];

    expect(bad.map(relPathProblem).every((problem) => problem !== undefined)).toBe(true);
    expect(relPathProblem('a'.repeat(513))).toBe('length');
  });
});

describe('defaultFrames', () => {
  it('puts the primary frame first: Desktop for desktop-first, Mobile for mobile-first', () => {
    expect(defaultFrames('desktop-first').frames.map((frame) => frame.width)).toEqual([
      1440, 768, 375,
    ]);
    expect(defaultFrames('mobile-first').primaryFrameId).toBe('mobile');
  });
});

describe('parseWorkspaceFile', () => {
  it('reads back what it writes', () => {
    const file = base();

    const parsed = parseWorkspaceFile(JSON.parse(serializeWorkspaceFile(file)));

    expect(parsed).toEqual({ ok: true, value: file });
  });

  it('refuses another schema version, including 1 of 0.18 [V-105]', () => {
    for (const value of [
      { ...base(), schemaVersion: 1 },
      {},
      undefined,
      'text',
      JSON.parse('null'),
    ]) {
      const parsed = parseWorkspaceFile(value);

      expect(parsed.ok ? undefined : parsed.error.params).toEqual({
        file: '.kumicraft/workspace.json',
        reason: 'unsupportedVersion',
      });
    }
  });

  it('refuses an invalid file with the E003 invalid reason [V-105]', () => {
    const parsed = parseWorkspaceFile({ ...base(), name: '', extra: true });

    expect(parsed.ok ? undefined : parsed.error).toMatchObject({
      code: 'E003',
      params: { reason: 'invalid' },
    });
  });

  it('needs unique frame ids and exactly one primary frame [V-09]', () => {
    const file = base();
    const duplicate = { ...file, frames: [...file.frames, file.frames[0]] };
    const missing = { ...file, primaryFrameId: 'watch' };

    expect(parseWorkspaceFile(duplicate).ok).toBe(false);
    expect(parseWorkspaceFile(missing).ok).toBe(false);
  });

  it('keeps every frame on the right side of the primary frame [V-07]', () => {
    const desktop = base();
    const wider = {
      ...desktop,
      frames: [...desktop.frames, { id: 'tv', label: 'TV', width: 1920, height: 1080 }],
    };
    const mobile = { ...newWorkspaceFile({ ...desktop, responsiveMode: 'mobile-first' }) };
    const narrower = {
      ...mobile,
      frames: [...mobile.frames, { id: 'watch', label: 'Watch', width: 320, height: 400 }],
    };

    expect(parseWorkspaceFile(wider).ok).toBe(false);
    expect(parseWorkspaceFile(narrower).ok).toBe(false);
  });

  it('limits frames, backends and sizes [V-09]', () => {
    const file = base();
    const tooMany = {
      ...file,
      frames: Array.from({ length: 9 }, (_, i) => ({
        id: `f${String(i)}`,
        label: 'F',
        width: 400,
        height: 400,
      })),
    };
    const tooSmall = { ...file, frames: [{ ...file.frames[0], width: 200 }] };

    expect(parseWorkspaceFile(tooMany).ok).toBe(false);
    expect(parseWorkspaceFile(tooSmall).ok).toBe(false);
  });

  it('Test 1 [WP-4.00]: workspace.json with string designDirs parses; normalizeDesignDirs returns arrays; absent designDirs -> default', () => {
    const rawLegacy = {
      schemaVersion: 2,
      id: 'abcdefghij',
      name: 'Shop',
      createdAt: '2026-10-14T08:00:00.000Z',
      framework: 'vite-react',
      sourceDir: 'src',
      backends: [],
      responsiveMode: 'desktop-first',
      frames: [
        { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
        { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
        { id: 'mobile', label: 'Mobile', width: 375, height: 812 },
      ],
      primaryFrameId: 'desktop',
      designDirs: {
        pages: 'src/views',
        layouts: 'src/layouts',
        components: 'src/ui',
        drafts: 'src/drafts',
      },
    };
    const parsed = parseWorkspaceFile(rawLegacy);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.designDirs?.pages).toBe('src/views');
      const normalized = normalizeDesignDirs(parsed.value.designDirs);
      expect(normalized.pages).toEqual(['src/views']);
      expect(normalized.layouts).toEqual(['src/layouts']);
      expect(normalized.components).toEqual(['src/ui']);
      expect(normalized.drafts).toBe('src/drafts');
    }

    const defaultNorm = normalizeDesignDirs(undefined);
    expect(defaultNorm.pages).toEqual(['src/pages']);
    expect(defaultNorm.layouts).toEqual(['src/layouts']);
    expect(defaultNorm.components).toEqual(['src/components']);
    expect(defaultNorm.drafts).toBe('src/drafts');
  });

  it('Test 2 [WP-4.00]: empty array, > 10 directories, absolute paths are invalid', () => {
    // Empty array
    expect(
      DesignDirsSchema.safeParse({
        pages: [],
        layouts: ['src/layouts'],
        components: ['src/components'],
      }).success,
    ).toBe(false);

    // > 10 directories
    const elevenDirs = Array.from({ length: 11 }, (_, i) => `src/components${String(i)}`);
    expect(
      DesignDirsSchema.safeParse({
        pages: ['src/pages'],
        layouts: ['src/layouts'],
        components: elevenDirs,
      }).success,
    ).toBe(false);

    // Absolute path
    expect(
      DesignDirsSchema.safeParse({
        pages: ['/absolute/pages'],
        layouts: ['src/layouts'],
        components: ['src/components'],
      }).success,
    ).toBe(false);
  });

  it('D1 [WP-4.00]: sessionOrigin maps session 1 to runnerOrigin, session 2..8 to s<n>.localhost, and throws on invalid input', () => {
    expect(sessionOrigin('http://127.0.0.1:5173', 1)).toBe('http://127.0.0.1:5173');
    expect(sessionOrigin('http://127.0.0.1:5173', 2)).toBe('http://s2.localhost:5173');
    expect(sessionOrigin('http://127.0.0.1:4000', 8)).toBe('http://s8.localhost:4000');

    expect(() => sessionOrigin('http://127.0.0.1:5173', 0)).toThrow(/sessionId/i);
    expect(() => sessionOrigin('http://127.0.0.1:5173', 9)).toThrow(/sessionId/i);
    expect(() => sessionOrigin('http://127.0.0.1:5173', 1.5)).toThrow(/sessionId/i);
    expect(() => sessionOrigin('not-a-url', 1)).toThrow(/runnerOrigin/i);
    expect(() => sessionOrigin('http://127.0.0.1', 2)).toThrow(/runnerOrigin/i);
    expect(() => sessionOrigin('ftp://127.0.0.1:5173', 2)).toThrow(/runnerOrigin/i);
  });

  it('validates sessions and ai in workspace.json and normalizes defaults in ProjectInfoSchema [WP-4.00]', () => {
    const legacy = base();
    const parsedLegacy = parseWorkspaceFile(legacy);
    expect(parsedLegacy.ok).toBe(true);
    if (parsedLegacy.ok) {
      expect(normalizeSessions(parsedLegacy.value.sessions)).toEqual([{ id: 1, label: 'Phiên 1' }]);
      expect(normalizeWorkspaceAi(parsedLegacy.value.ai)).toEqual({ allowEdits: true });
    }

    // Duplicate session id or missing session 1 is rejected
    expect(
      LoginSessionsSchema.safeParse([
        { id: 1, label: 'A' },
        { id: 1, label: 'B' },
      ]).success,
    ).toBe(false);
    expect(LoginSessionsSchema.safeParse([{ id: 2, label: 'Only 2' }]).success).toBe(false);

    // ProjectInfoSchema fills in normalized defaults when absent
    const parsedInfo = ProjectInfoSchema.parse({
      id: 'proj123456',
      name: 'My Project',
      root: 'D:/projects/my-app',
      sourceDir: 'src',
      support: {
        supported: true,
        reasons: [],
        framework: 'vite-react',
        versions: {},
        language: 'ts',
      },
      needsInstall: false,
      responsiveMode: 'desktop-first',
      frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
      primaryFrameId: 'desktop',
      backends: [],
      trusted: true,
      designDirs: DEFAULT_DESIGN_DIRS,
    });
    expect(parsedInfo.sessions).toEqual([{ id: 1, label: 'Phiên 1' }]);
    expect(parsedInfo.ai).toEqual({ allowEdits: true });
  });
});
