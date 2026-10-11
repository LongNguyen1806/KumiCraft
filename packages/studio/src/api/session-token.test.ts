import { beforeEach, describe, expect, it } from 'vitest';

import { captureSessionToken, readSessionToken } from './session-token.ts';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('captureSessionToken', () => {
  it('moves the token from the fragment to sessionStorage and clears the address bar [S-06]', () => {
    window.history.replaceState(undefined, '', '/settings?x=1#t=abc123');

    captureSessionToken();

    expect(readSessionToken()).toBe('abc123');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname + window.location.search).toBe('/settings?x=1');
    expect(localStorage.length).toBe(0);
  });

  it('keeps the stored token when the URL has none [S-06]', () => {
    sessionStorage.setItem('reactcraft.sessionToken', 'kept');
    window.history.replaceState(undefined, '', '/');

    captureSessionToken();

    expect(readSessionToken()).toBe('kept');
  });
});
