import { describe, expect, it } from 'vitest';

import { parseRawClasses, tokenizeClasses } from './tokenizer.ts';

describe('M-TW Tokenizer [R-TW-01, R-TW-02]', () => {
  it('Scenario 1 (Table 8.1): parses 6 tokens with variants, important, negative, opacity', () => {
    const input =
      "p-4 md:hover:bg-[url('a b')] !font-bold -mt-2 grid-cols-[repeat(2,minmax(0,1fr))] bg-red-500/50";
    const tokens = parseRawClasses(input);

    expect(tokens).toHaveLength(6);

    const [t0, t1, t2, t3, t4, t5] = tokens;
    if (
      t0 === undefined ||
      t1 === undefined ||
      t2 === undefined ||
      t3 === undefined ||
      t4 === undefined ||
      t5 === undefined
    ) {
      throw new Error('Expected 6 tokens');
    }

    // 1. p-4
    expect(t0).toMatchObject({
      raw: 'p-4',
      utility: 'p-4',
      variants: [],
      important: false,
      negative: false,
      opacity: undefined,
    });
    expect(input.slice(t0.start, t0.end)).toBe('p-4');

    // 2. md:hover:bg-[url('a b')]
    expect(t1).toMatchObject({
      raw: "md:hover:bg-[url('a b')]",
      utility: "bg-[url('a b')]",
      variants: ['md', 'hover'],
      important: false,
      negative: false,
      opacity: undefined,
    });
    expect(input.slice(t1.start, t1.end)).toBe("md:hover:bg-[url('a b')]");

    // 3. !font-bold (v3 important)
    expect(t2).toMatchObject({
      raw: '!font-bold',
      utility: 'font-bold',
      variants: [],
      important: true,
      negative: false,
      opacity: undefined,
    });
    expect(input.slice(t2.start, t2.end)).toBe('!font-bold');

    // 4. -mt-2 (negative)
    expect(t3).toMatchObject({
      raw: '-mt-2',
      utility: 'mt-2',
      variants: [],
      important: false,
      negative: true,
      opacity: undefined,
    });
    expect(input.slice(t3.start, t3.end)).toBe('-mt-2');

    // 5. grid-cols-[repeat(2,minmax(0,1fr))]
    expect(t4).toMatchObject({
      raw: 'grid-cols-[repeat(2,minmax(0,1fr))]',
      utility: 'grid-cols-[repeat(2,minmax(0,1fr))]',
      variants: [],
      important: false,
      negative: false,
      opacity: undefined,
    });
    expect(input.slice(t4.start, t4.end)).toBe('grid-cols-[repeat(2,minmax(0,1fr))]');

    // 6. bg-red-500/50 (opacity)
    expect(t5).toMatchObject({
      raw: 'bg-red-500/50',
      utility: 'bg-red-500',
      variants: [],
      important: false,
      negative: false,
      opacity: '50',
    });
    expect(input.slice(t5.start, t5.end)).toBe('bg-red-500/50');
  });

  it('handles Tailwind v4 important syntax with ! at end', () => {
    const input = 'p-4! text-sm!';
    const tokens = parseRawClasses(input);

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({
      raw: 'p-4!',
      utility: 'p-4',
      important: true,
    });
    expect(tokens[1]).toMatchObject({
      raw: 'text-sm!',
      utility: 'text-sm',
      important: true,
    });
  });

  it('preserves fractions in size and aspect utilities instead of treating as opacity', () => {
    const input = 'w-1/2 h-2/3 aspect-16/9 inset-1/4';
    const tokens = parseRawClasses(input);

    expect(tokens).toHaveLength(4);
    const [t0, t1, t2, t3] = tokens;
    if (t0 === undefined || t1 === undefined || t2 === undefined || t3 === undefined) {
      throw new Error('Expected 4 tokens');
    }

    expect(t0.utility).toBe('w-1/2');
    expect(t0.opacity).toBeUndefined();

    expect(t1.utility).toBe('h-2/3');
    expect(t1.opacity).toBeUndefined();

    expect(t2.utility).toBe('aspect-16/9');
    expect(t2.opacity).toBeUndefined();

    expect(t3.utility).toBe('inset-1/4');
    expect(t3.opacity).toBeUndefined();
  });

  it('does not split on colons inside arbitrary brackets', () => {
    const input = '[--custom-prop:10px] dark:[color:red]';
    const tokens = parseRawClasses(input);

    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({
      raw: '[--custom-prop:10px]',
      variants: [],
      utility: '[--custom-prop:10px]',
    });
    expect(tokens[1]).toMatchObject({
      raw: 'dark:[color:red]',
      variants: ['dark'],
      utility: '[color:red]',
    });
  });

  it('tracks accurate start and end positions with multiple spaces and newlines', () => {
    const input = '  flex   \n\t  justify-center   items-center  ';
    const rawTokens = tokenizeClasses(input);

    expect(rawTokens).toHaveLength(3);
    for (const tok of rawTokens) {
      expect(input.slice(tok.start, tok.end)).toBe(tok.raw);
    }
    const [t0, t1, t2] = rawTokens;
    if (t0 === undefined || t1 === undefined || t2 === undefined) {
      throw new Error('Expected 3 tokens');
    }
    expect(t0.raw).toBe('flex');
    expect(t1.raw).toBe('justify-center');
    expect(t2.raw).toBe('items-center');
  });

  it('handles empty and whitespace-only strings gracefully', () => {
    expect(tokenizeClasses('')).toEqual([]);
    expect(tokenizeClasses('   \t\n  ')).toEqual([]);
    expect(parseRawClasses('')).toEqual([]);
  });
});
