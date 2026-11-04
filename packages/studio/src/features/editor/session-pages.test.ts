// Which page uses which login session (spec-log #78).
import type { PageInfo } from '@kumicraft/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { pageKeyOf, readSessionPages, sessionForPage, writeSessionPages } from './session-pages.ts';

const PAGES: readonly PageInfo[] = [
  { path: '/', dynamic: false },
  { path: '/admin/farmers', dynamic: false },
  { path: '/admin/farmers/:id', dynamic: true },
  { path: '/farmer/products/new', dynamic: false },
  { path: '/farmer/products/:id', dynamic: true },
  { path: '*', dynamic: false },
];

describe('session pages [WP-4.00]', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keys a route by the page pattern it matches, a literal page first', () => {
    expect(pageKeyOf('/admin/farmers/5', PAGES)).toBe('/admin/farmers/:id');
    expect(pageKeyOf('/admin/farmers/9?tab=orders', PAGES)).toBe('/admin/farmers/:id');
    expect(pageKeyOf('/admin/farmers', PAGES)).toBe('/admin/farmers');
    expect(pageKeyOf('/farmer/products/new', PAGES)).toBe('/farmer/products/new');
    // A route no page knows (the catch-all is not a page) is its own key.
    expect(pageKeyOf('/somewhere/else', PAGES)).toBe('/somewhere/else');
  });

  it('remembers ties per project and forgets a tie to a session that is gone', () => {
    writeSessionPages('p1', { '/': 1, '/farmer': 3 });
    writeSessionPages('p2', { '/': 2 });
    const p1 = readSessionPages('p1');
    expect(p1).toEqual({ '/': 1, '/farmer': 3 });
    expect(sessionForPage(p1, '/farmer', [1, 3])).toBe(3);
    expect(sessionForPage(p1, '/farmer', [1, 2])).toBeUndefined();
    expect(sessionForPage(p1, '/missing', [1, 3])).toBeUndefined();
    expect(readSessionPages('p2')).toEqual({ '/': 2 });

    localStorage.setItem('kumicraft.sessionPages.bad', '[1,2]');
    expect(readSessionPages('bad')).toEqual({});
  });
});
