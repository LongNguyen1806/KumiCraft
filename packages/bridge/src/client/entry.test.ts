// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

describe('entry', () => {
  it('does nothing outside the Studio iframe [R-BR-10]', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    await import('./entry.ts');
    expect(postMessageSpy).not.toHaveBeenCalled();
    expect(document.getElementById('__rc_overlay_host')).toBeNull();
  });
});
