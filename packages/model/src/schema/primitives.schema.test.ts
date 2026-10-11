import { describe, expect, it } from 'vitest';

import {
  BreakpointSchema,
  ColorSchema,
  DataSourceIdSchema,
  FrameSchema,
  JobIdSchema,
  LimitValueSchema,
  NodeIdSchema,
  PageIdSchema,
  PxSchema,
  SizeValueSchema,
  SpacingSchema,
  TokenRefSchema,
  tokenRefSchema,
} from './primitives.schema.ts';

const accepts = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('identifiers', () => {
  it('accept the documented shapes and reject others', () => {
    expect(accepts(NodeIdSchema, 'n_V1StGXR8_Z')).toBe(true);
    expect(accepts(NodeIdSchema, 'n_short')).toBe(false);
    expect(accepts(NodeIdSchema, 'p_V1StGXR8_Z')).toBe(false);
    expect(accepts(PageIdSchema, 'p_4f90d13a2b')).toBe(true);
    expect(accepts(DataSourceIdSchema, 'ds_products')).toBe(true);
    expect(accepts(DataSourceIdSchema, 'ds_Products')).toBe(false);
    expect(accepts(JobIdSchema, 'j_8fK2pQx9Lm1a')).toBe(true);
  });
});

describe('breakpoints and frames', () => {
  it('lists base and the five Tailwind keys', () => {
    expect(BreakpointSchema.options).toEqual(['base', 'sm', 'md', 'lg', 'xl', '2xl']);
  });

  it('bounds frame size and id format', () => {
    const frame = { id: 'desktop', label: 'Desktop', width: 1440, height: 900 };

    expect(accepts(FrameSchema, frame)).toBe(true);
    expect(accepts(FrameSchema, { ...frame, width: 319 })).toBe(false);
    expect(accepts(FrameSchema, { ...frame, height: 2161 })).toBe(false);
    expect(accepts(FrameSchema, { ...frame, id: 'Desktop' })).toBe(false);
    expect(accepts(FrameSchema, { ...frame, extra: true })).toBe(false);
  });
});

describe('token references', () => {
  it('accept a token of the expected group only [V-01]', () => {
    const spacing = tokenRefSchema('spacing');

    expect(accepts(spacing, 'token:spacing.4')).toBe(true);
    expect(accepts(spacing, 'token:spacing.space-x-2')).toBe(true);
    expect(accepts(spacing, 'token:color.primary')).toBe(false);
    expect(accepts(spacing, 'token:spacing.Big')).toBe(false);
    expect(accepts(spacing, 'token:spacing.')).toBe(false);
  });

  it('accept any group with the generic schema', () => {
    expect(accepts(TokenRefSchema, 'token:shadow.sm')).toBe(true);
    expect(accepts(TokenRefSchema, 'token:unknown.sm')).toBe(false);
  });
});

describe('values', () => {
  it('limits px to 0..10000 with two decimals', () => {
    expect(accepts(PxSchema, { px: 0 })).toBe(true);
    expect(accepts(PxSchema, { px: 12.25 })).toBe(true);
    expect(accepts(PxSchema, { px: 0.29 })).toBe(true);
    expect(accepts(PxSchema, { px: 1.234 })).toBe(false);
    expect(accepts(PxSchema, { px: -1 })).toBe(false);
    expect(accepts(PxSchema, { px: 10001 })).toBe(false);
  });

  it('accepts only lowercase hex colors of 6 or 8 digits [V-02]', () => {
    expect(accepts(ColorSchema, '#1a2b3c')).toBe(true);
    expect(accepts(ColorSchema, '#1a2b3c80')).toBe(true);
    expect(accepts(ColorSchema, 'token:color.primary')).toBe(true);
    expect(accepts(ColorSchema, '#1A2B3C')).toBe(false);
    expect(accepts(ColorSchema, '#abc')).toBe(false);
    expect(accepts(ColorSchema, 'red')).toBe(false);
  });

  it('accepts spacing as a spacing token or px', () => {
    expect(accepts(SpacingSchema, 'token:spacing.2')).toBe(true);
    expect(accepts(SpacingSchema, { px: 8 })).toBe(true);
    expect(accepts(SpacingSchema, 'token:radius.lg')).toBe(false);
  });

  it('accepts size and limit values', () => {
    expect(
      ['hug', 'fill', { fixed: { px: 200 } }, { percent: 50 }].every((v) =>
        accepts(SizeValueSchema, v),
      ),
    ).toBe(true);
    expect(accepts(SizeValueSchema, { percent: 0 })).toBe(false);
    expect(accepts(SizeValueSchema, { percent: 50.5 })).toBe(false);
    expect(accepts(LimitValueSchema, 'none')).toBe(true);
    expect(accepts(LimitValueSchema, { px: 640 })).toBe(true);
  });
});
