// SPEC-03 section 3: the workspace file of a project.
import { describe, expect, it } from 'vitest';

import { relPathProblem } from './rel-path.ts';
import {
  defaultFrames,
  newWorkspaceFile,
  parseWorkspaceFile,
  serializeWorkspaceFile,
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
    expect(['src', 'src/pages/Home.tsx', '.reactcraft/workspace.json'].map(relPathProblem)).toEqual(
      [undefined, undefined, undefined],
    );
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
        file: '.reactcraft/workspace.json',
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
});
