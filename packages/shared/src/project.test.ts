// Test schemas for project and fs types (SPEC-03 section 5.3, section 5.1).
import { describe, expect, it } from 'vitest';

import { DirectoryListingSchema } from './fs.ts';
import {
  BackendInfoSchema,
  ProjectInfoSchema,
  ProjectProbeSchema,
  SupportReportSchema,
  ThemeInfoSchema,
} from './project.ts';

describe('ProjectProbeSchema', () => {
  it('parses valid missing probe', () => {
    const probe = { kind: 'missing', canCreate: true };
    expect(ProjectProbeSchema.safeParse(probe).success).toBe(true);
  });

  it('parses valid empty probe', () => {
    const probe = { kind: 'empty' };
    expect(ProjectProbeSchema.safeParse(probe).success).toBe(true);
  });

  it('parses valid project probe with support report', () => {
    const probe = {
      kind: 'project',
      hasWorkspace: true,
      support: {
        supported: true,
        reasons: [],
        framework: 'vite-react',
        versions: { vite: '8.0.0', react: '19.0.0', tailwindcss: '4.0.0' },
        language: 'ts',
        packageManager: 'pnpm',
        viteConfig: 'vite.config.ts',
        tailwindCss: 'src/index.css',
      },
    };
    expect(ProjectProbeSchema.safeParse(probe).success).toBe(true);
  });

  it('rejects unknown kinds', () => {
    const probe = { kind: 'unknown' };
    expect(ProjectProbeSchema.safeParse(probe).success).toBe(false);
  });
});

describe('SupportReportSchema', () => {
  it('parses valid support report', () => {
    const report = {
      supported: true,
      reasons: [],
      framework: 'vite-react',
      versions: { vite: '8.0.0', react: '19.0.0' },
      language: 'ts',
      packageManager: 'pnpm',
    };
    expect(SupportReportSchema.safeParse(report).success).toBe(true);
  });
});

describe('BackendInfoSchema', () => {
  it('validates a complete backend info [S-80]', () => {
    const backend = {
      id: 'api0000001',
      path: '../api',
      label: 'Shop API',
      status: 'ok',
      resolvedPath: 'D:/projects/api',
      outsideParent: false,
    };
    expect(BackendInfoSchema.safeParse(backend).success).toBe(true);
  });
});

describe('ProjectInfoSchema', () => {
  it('validates a complete project info', () => {
    const info = {
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
      installCommand: ['pnpm', 'install'],
      responsiveMode: 'desktop-first',
      frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
      primaryFrameId: 'desktop',
      backends: [
        {
          id: 'api0000001',
          path: '../api',
          label: 'Shop API',
          status: 'ok',
          resolvedPath: 'D:/projects/api',
          outsideParent: false,
        },
      ],
      trusted: true,
    };
    expect(ProjectInfoSchema.safeParse(info).success).toBe(true);
  });
});

describe('ThemeInfoSchema', () => {
  it('validates theme tokens', () => {
    const theme = {
      file: 'src/index.css',
      colors: [{ name: 'primary', value: '#3b82f6' }],
      fontSizes: [{ name: 'lg', value: '1.125rem' }],
      radii: [],
      fonts: [],
      shadows: [],
      breakpoints: [],
    };
    expect(ThemeInfoSchema.safeParse(theme).success).toBe(true);
  });
});

describe('DirectoryListingSchema', () => {
  it('validates directory listing with roots and entries', () => {
    const listing = {
      path: 'D:/Study',
      roots: ['C:/', 'D:/'],
      entries: [
        { name: 'my-project', path: 'D:/Study/my-project', isProject: true },
        { name: 'notes', path: 'D:/Study/notes', isProject: false },
      ],
      truncated: true,
    };
    expect(DirectoryListingSchema.safeParse(listing).success).toBe(true);
  });
});
