import { checkDocument } from '@reactcraft/model';
import { describe, expect, it } from 'vitest';

import {
  buildFrames,
  createWorkspaceDocument,
  type CreateWorkspaceRequest,
  CreateWorkspaceRequestSchema,
  FRAME_PRESETS,
} from './create-workspace.ts';
import { NOW, sequenceIds } from './test-support.ts';

const create = (request: CreateWorkspaceRequest, language?: 'vi' | 'en') =>
  createWorkspaceDocument(CreateWorkspaceRequestSchema.parse(request), {
    newId: sequenceIds(),
    now: NOW,
    ...(language === undefined ? {} : { language }),
  });

const frameIds = (request: CreateWorkspaceRequest) =>
  create(request).workspace.frames.map((frame) => `${frame.id}:${String(frame.width)}`);

describe('createWorkspaceDocument', () => {
  it('creates a valid workspace with a Home page sized to the primary frame', () => {
    const document = create({ name: '  Shop  ' });

    expect(checkDocument(document).ok).toBe(true);
    expect(document.workspace).toMatchObject({
      name: 'Shop',
      revision: 0,
      primaryFrameId: 'desktop',
      contentLocale: 'en-US',
      darkMode: 'none',
      createdAt: NOW.toISOString(),
    });
    const [page] = Object.values(document.pages);
    expect(page).toMatchObject({
      name: 'Home',
      route: '/',
      root: {
        type: 'Stack',
        style: { direction: 'column', width: 'fill', minHeight: { px: 900 } },
      },
    });
    expect(document.workspace.pageOrder).toEqual([page?.id]);
    expect(Object.keys(document.tokens.color)).toHaveLength(12);
  });

  it('uses the standard frames of each responsive mode', () => {
    expect(frameIds({ name: 'A' })).toEqual(['desktop:1440', 'tablet:768', 'mobile:375']);
    expect(frameIds({ name: 'A', primaryFrame: 'desktop-1920' })).toEqual([
      'desktop:1920',
      'tablet:768',
      'mobile:375',
    ]);
    expect(frameIds({ name: 'A', responsiveMode: 'mobile-first' })).toEqual([
      'mobile:375',
      'tablet:768',
      'desktop:1440',
    ]);
  });

  it('drops standard frames on the wrong side of a custom primary frame [V-07]', () => {
    const custom = { id: 'kiosk', label: 'Kiosk', width: 600, height: 1000 };

    expect(frameIds({ name: 'A', primaryFrame: custom })).toEqual(['kiosk:600', 'mobile:375']);
    expect(frameIds({ name: 'A', primaryFrame: 'mobile-375' })).toEqual(['mobile:375']);
    expect(buildFrames('mobile-first', custom).map((frame) => frame.id)).toEqual([
      'kiosk',
      'tablet',
      'desktop',
    ]);
  });

  it('keeps every preset and mode combination valid [V-07] [V-09]', () => {
    for (const responsiveMode of ['desktop-first', 'mobile-first'] as const) {
      for (const primaryFrame of Object.keys(FRAME_PRESETS) as (keyof typeof FRAME_PRESETS)[]) {
        expect(checkDocument(create({ name: 'A', responsiveMode, primaryFrame })).ok).toBe(true);
      }
    }
  });

  it('follows the interface language for the content locale unless one is given', () => {
    expect(create({ name: 'A' }, 'vi').workspace.contentLocale).toBe('vi-VN');
    expect(create({ name: 'A', contentLocale: 'fr-FR' }, 'vi').workspace.contentLocale).toBe(
      'fr-FR',
    );
  });

  it('rejects an empty name and an unknown preset', () => {
    expect(CreateWorkspaceRequestSchema.safeParse({ name: ' ' }).success).toBe(false);
    expect(
      CreateWorkspaceRequestSchema.safeParse({ name: 'A', primaryFrame: 'tv-4k' }).success,
    ).toBe(false);
  });
});
