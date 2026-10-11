// Session token in the Studio (SPEC-05 S-05, S-06): handed over in the URL fragment, kept only in
// sessionStorage (gone when the tab closes, never shared between tabs). No localStorage, no cookie.
const STORAGE_KEY = 'reactcraft.sessionToken';

/** Moves the token from `#t=` into sessionStorage and removes it from the address bar at once. */
export function captureSessionToken(): void {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('t');
  if (!token) return;
  sessionStorage.setItem(STORAGE_KEY, token);
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + window.location.search,
  );
}

export function readSessionToken(): string | undefined {
  return sessionStorage.getItem(STORAGE_KEY) ?? undefined;
}
