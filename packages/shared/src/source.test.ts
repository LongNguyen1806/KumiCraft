import { describe, expect, it } from 'vitest';

import {
  EditRequestSchema,
  EditResultSchema,
  ElementSourceSchema,
  INSERT_JSX_MAX_BYTES,
  InsertEditSchema,
  parseLocString,
  SetAttributeEditSchema,
  SetClassNameEditSchema,
  SetTextEditSchema,
  SourceEditSchema,
  StaticOrStringSchema,
} from './source.ts';

describe('source schemas and utilities', () => {
  describe('parseLocString', () => {
    it('parses valid loc string from right to left [V-101, V-102]', () => {
      const parsed = parseLocString('src/App.tsx:12:5');
      expect(parsed).toEqual({
        file: 'src/App.tsx',
        line: 12,
        column: 5,
      });

      const nested = parseLocString('src/components/ui/card.test.tsx:104:22');
      expect(nested).toEqual({
        file: 'src/components/ui/card.test.tsx',
        line: 104,
        column: 22,
      });
    });

    it('returns undefined for invalid loc strings', () => {
      expect(parseLocString('')).toBeUndefined();
      expect(parseLocString('foo')).toBeUndefined();
      expect(parseLocString('foo:bar')).toBeUndefined();
      expect(parseLocString('App.tsx:0:5')).toBeUndefined();
      expect(parseLocString('App.tsx:10:0')).toBeUndefined();
      expect(parseLocString('App.tsx:-1:5')).toBeUndefined();
      expect(parseLocString('App.tsx:abc:5')).toBeUndefined();
    });
  });

  describe('StaticOrStringSchema', () => {
    it('validates static, expression and none variants', () => {
      expect(StaticOrStringSchema.safeParse({ kind: 'static', value: 'p-4 flex' }).success).toBe(
        true,
      );
      expect(
        StaticOrStringSchema.safeParse({ kind: 'expression', code: 'cn("flex", active && "bold")' })
          .success,
      ).toBe(true);
      expect(StaticOrStringSchema.safeParse({ kind: 'none' }).success).toBe(true);
      expect(StaticOrStringSchema.safeParse({ kind: 'unknown' }).success).toBe(false);
    });
  });

  describe('ElementSourceSchema', () => {
    it('validates full ElementSource payload', () => {
      const valid = {
        loc: 'src/App.tsx:10:5',
        tag: 'div',
        fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        className: { kind: 'static', value: 'container mx-auto' },
        text: { kind: 'none' },
        attributes: {
          href: { kind: 'none' },
        },
        component: { name: 'App', usages: 1 },
        inLoop: false,
      };

      const result = ElementSourceSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('validates duplicate class and selfClosing text variants', () => {
      const valid = {
        loc: 'src/components/Button.tsx:5:3',
        tag: 'button',
        fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        className: { kind: 'duplicate' },
        text: { kind: 'selfClosing' },
        attributes: {},
        inLoop: true,
      };

      const result = ElementSourceSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('SourceEditSchema & EditRequestSchema', () => {
    it('validates setClassName edit', () => {
      const edit = {
        kind: 'setClassName',
        loc: 'src/App.tsx:10:5',
        tag: 'div',
        before: 'p-2',
        after: 'p-4',
      };
      expect(SetClassNameEditSchema.safeParse(edit).success).toBe(true);
      expect(SourceEditSchema.safeParse(edit).success).toBe(true);
      expect(EditRequestSchema.safeParse({ edit, coalesceKey: 'slider-padding' }).success).toBe(
        true,
      );
    });

    it('validates setText edit', () => {
      const edit = {
        kind: 'setText',
        loc: 'src/App.tsx:12:7',
        tag: 'h1',
        before: 'Old Title',
        after: 'New Title',
      };
      expect(SetTextEditSchema.safeParse(edit).success).toBe(true);
      expect(SourceEditSchema.safeParse(edit).success).toBe(true);
    });

    it('validates setAttribute edit', () => {
      const edit = {
        kind: 'setAttribute',
        loc: 'src/App.tsx:15:9',
        tag: 'a',
        name: 'href',
        before: 'https://example.com',
        after: 'https://reactcraft.dev',
      };
      expect(SetAttributeEditSchema.safeParse(edit).success).toBe(true);
      expect(SourceEditSchema.safeParse(edit).success).toBe(true);
    });
  });

  describe('EditResultSchema', () => {
    it('validates EditResult payload', () => {
      const res = {
        changed: true,
        historyId: 'h_1234567890',
        file: 'src/App.tsx',
        fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        element: {
          loc: 'src/App.tsx:10:5',
          tag: 'div',
          fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          className: { kind: 'static', value: 'p-4' },
          text: { kind: 'none' },
          attributes: {},
          inLoop: false,
        },
      };
      expect(EditResultSchema.safeParse(res).success).toBe(true);
    });
  });

  describe('InsertEditSchema', () => {
    it('takes a clipboard paste up to 1 MB and refuses a larger one [S-17]', () => {
      const insert = (jsx: string) =>
        InsertEditSchema.safeParse({
          kind: 'insert',
          target: { kind: 'child', parent: { loc: 'src/App.tsx:3:5', tag: 'div' }, where: 'end' },
          jsx,
        }).success;
      expect(INSERT_JSX_MAX_BYTES).toBe(1024 * 1024);
      expect(insert(`<p>${'a'.repeat(512 * 1024)}</p>`)).toBe(true);
      expect(insert('a'.repeat(INSERT_JSX_MAX_BYTES + 1))).toBe(false);
    });
  });
});
