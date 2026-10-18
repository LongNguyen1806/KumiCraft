import { describe, expect, it } from 'vitest';

import { pageNames } from './page-names.ts';

describe('pageNames [R-PG-11, R-PJ-11]', () => {
  it('handles Vietnamese accents, spaces, numbers, and symbols (#1)', () => {
    expect(pageNames('Giới thiệu', 'ts')).toEqual({
      component: 'GioiThieu',
      path: '/gioi-thieu',
      fileName: 'GioiThieu.tsx',
    });

    expect(pageNames('Đặt hàng 2', 'ts')).toEqual({
      component: 'DatHang2',
      path: '/dat-hang-2',
      fileName: 'DatHang2.tsx',
    });

    expect(pageNames('123', 'ts')).toEqual({
      component: 'Page123',
      path: '/123',
      fileName: 'Page123.tsx',
    });

    expect(pageNames('!!!', 'ts')).toEqual({
      component: 'Page',
      path: '/page',
      fileName: 'Page.tsx',
    });

    expect(pageNames('Product Details', 'js')).toEqual({
      component: 'ProductDetails',
      path: '/product-details',
      fileName: 'ProductDetails.jsx',
    });
  });
});
