// "Show one after another" (TK-20, QA K9.7-2): Reveal wraps ONE element (a list or grid), so the
// stagger must delay that element's own children step by step, not add one delay to the wrapper.
import { describe, expect, it } from 'vitest';

import { buildRevealComponentCode } from './reveal-template.ts';

describe('Reveal template stagger [TK-20]', () => {
  it.each([true, false])('tsx=%s staggers the children of the wrapped element', (tsx) => {
    const code = buildRevealComponentCode(tsx);
    expect(code).toContain('firstElementChild?.children');
    expect(code).toContain('delay + index * stagger');
    // With a stagger the wrapper itself does not fade; its items do.
    expect(code).toContain('style={stagger > 0 ? undefined : motion(visible, delay)}');
    expect(code).not.toContain('delay + stagger');
  });

  it('keeps reduced motion: no movement when the user asks for less', () => {
    for (const tsx of [true, false]) {
      expect(buildRevealComponentCode(tsx)).toContain(
        "matchMedia('(prefers-reduced-motion: reduce)')",
      );
    }
  });
});
