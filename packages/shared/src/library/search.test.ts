import { describe, expect, it } from 'vitest';

import { LIBRARY_BLOCKS } from './blocks.ts';
import { normalizeText, searchBlocks } from './search.ts';

describe('searchBlocks [R-LB-13]', () => {
  it('Scenario 13: matches button with "nut", "Nút", "button", "BUTTON", and "xyz" is empty', () => {
    const r1 = searchBlocks('nut');
    expect(r1.map((b) => b.id)).toContain('form.button');

    const r2 = searchBlocks('Nút');
    expect(r2.map((b) => b.id)).toContain('form.button');

    const r3 = searchBlocks('button');
    expect(r3.map((b) => b.id)).toContain('form.button');

    const r4 = searchBlocks('BUTTON');
    expect(r4.map((b) => b.id)).toContain('form.button');

    const emptyRes = searchBlocks('xyz');
    expect(emptyRes).toHaveLength(0);
  });

  it('returns all 19 blocks when query is empty', () => {
    const all = searchBlocks('');
    expect(all).toHaveLength(19);
    expect(all).toEqual(LIBRARY_BLOCKS);
  });

  it('normalizes diacritics including đ/Đ correctly', () => {
    expect(normalizeText('Đoạn văn')).toBe('doan van');
    expect(normalizeText('ĐIỀU HƯỚNG')).toBe('dieu huong');
    const heroRes = searchBlocks('chào mừng');
    expect(heroRes.map((b) => b.id)).toContain('composite.hero');
  });

  it('supports custom label resolver function', () => {
    const customResolver = (id: string) => {
      if (id === 'composite.card') {
        return { vi: 'Hộp sản phẩm độc quyền', en: 'Exclusive Product Box' };
      }
      return { vi: '', en: '' };
    };
    const res = searchBlocks('độc quyền', customResolver);
    expect(res.map((b) => b.id)).toEqual(['composite.card']);
  });
});
