import type { ElementRef, PageInfo, TreeNode } from '@reactcraft/shared';
import { describe, expect, it } from 'vitest';

import { designTargetOf, insertAnchor, matchPage } from './design-target.ts';

describe('matchPage and designTargetOf', () => {
  const pages: readonly PageInfo[] = [
    { component: 'Home', path: '/', file: 'src/pages/Home.tsx', dynamic: false },
    { component: 'About', path: '/about', file: 'src/pages/About.tsx', dynamic: false },
    {
      component: 'ProductDetail',
      path: '/products/:id',
      file: 'src/pages/ProductDetail.tsx',
      dynamic: true,
    },
  ];

  it('[R-CP-11] matches pages by segments, handles :param, ignores query and trailing slash (scenario 8)', () => {
    expect(matchPage(pages, '/')?.component).toBe('Home');
    expect(matchPage(pages, '/about')?.component).toBe('About');
    expect(matchPage(pages, '/about/')?.component).toBe('About');
    expect(matchPage(pages, '/products/42?x=1')?.component).toBe('ProductDetail');
    expect(matchPage(pages, '/khong-co')).toBeUndefined();
  });

  it('[R-CP-11] designTargetOf returns target with name, file and route', () => {
    const target = designTargetOf(pages, '/about');
    expect(target).toEqual({
      kind: 'page',
      name: 'About',
      file: 'src/pages/About.tsx',
      route: '/about',
    });

    const unknown = designTargetOf(pages, '/unknown');
    expect(unknown).toEqual({
      kind: 'page',
      name: undefined,
      file: undefined,
      route: '/unknown',
    });
  });
});

describe('insertAnchor', () => {
  const headerRef: ElementRef = { loc: 'src/components/Header.tsx:5:3', index: 0 };
  const layoutDivRef: ElementRef = { loc: 'src/layouts/MainLayout.tsx:10:5', index: 0 };
  const homeMainRef: ElementRef = { loc: 'src/pages/Home.tsx:20:7', index: 0 };
  const orphanRef: ElementRef = { loc: 'src/components/Footer.tsx:3:2', index: 0 };

  const treeNodes: readonly TreeNode[] = [
    {
      ref: homeMainRef,
      tag: 'main',
      instances: 1,
    },
    {
      ref: layoutDivRef,
      parent: 0,
      tag: 'div',
      instances: 1,
    },
    {
      ref: headerRef,
      parent: 1,
      tag: 'header',
      instances: 1,
    },
    {
      ref: orphanRef,
      tag: 'footer',
      instances: 1,
    },
  ];

  it('[R-CP-11] climbs treeNodes to find ancestor in designFile (scenario 9)', () => {
    const designFile = 'src/pages/Home.tsx';

    // 1. Ref in Header.tsx with parent in MainLayout.tsx and ancestor in Home.tsx -> returns main
    const anchor = insertAnchor(headerRef, treeNodes, designFile);
    expect(anchor).toEqual(homeMainRef);

    // 2. Ref already belongs to Home.tsx -> returns same ref
    expect(insertAnchor(homeMainRef, treeNodes, designFile)).toEqual(homeMainRef);

    // 3. designFile is undefined -> returns same ref
    expect(insertAnchor(headerRef, treeNodes, undefined)).toEqual(headerRef);

    // 4. No ancestor belongs to Home.tsx -> returns undefined
    expect(insertAnchor(orphanRef, treeNodes, designFile)).toBeUndefined();
  });

  it('[R-CP-11] uses the Bridge ancestors of this copy before the tree, which only knows the first copy', () => {
    const designFile = 'src/pages/Home.tsx';
    // The h3 of the second ProductCard: not in `tree` at all.
    const secondTitle: ElementRef = { loc: 'src/components/ProductCard.tsx:5:5', index: 1 };
    const ancestors: readonly ElementRef[] = [
      { loc: 'src/components/ProductCard.tsx:4:3', index: 1 },
      { loc: 'src/pages/Home.tsx:8:5', index: 0 },
      { loc: 'src/pages/Home.tsx:5:3', index: 0 },
    ];

    expect(insertAnchor(secondTitle, treeNodes, designFile)).toBeUndefined();
    expect(insertAnchor(secondTitle, treeNodes, designFile, ancestors)).toEqual({
      loc: 'src/pages/Home.tsx:8:5',
      index: 0,
    });
    // Header of the layout: its real ancestors are all outside the page.
    expect(insertAnchor(headerRef, treeNodes, designFile, [layoutDivRef])).toBeUndefined();
  });
});
