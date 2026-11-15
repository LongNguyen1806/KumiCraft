// Undo/Redo labels: every label the server sends reads as words, never as a raw key (K9.5).
import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { resolveHistoryLabel } from './editor-toolbar.tsx';

const label = (key: string, params?: Record<string, string>) =>
  resolveHistoryLabel(params === undefined ? { key } : { key, params }, i18next.t);

describe('resolveHistoryLabel [K9.5]', () => {
  beforeAll(async () => {
    await initI18n();
    await i18next.changeLanguage('vi');
  });

  it('translates the labels that used to show as raw keys', () => {
    expect(label('history:insert', { tag: 'div' })).toBe('chèn <div>');
    expect(label('history:remove', { tag: 'p' })).toBe('xóa <p>');
    expect(label('history:setStyle', { tag: 'h1' })).toBe('đổi kiểu dáng <h1>');
    expect(label('history:fileCreate', { name: 'a.tsx' })).toBe('tạo file a.tsx');
    expect(label('history:batch', { count: '3' })).toBe('sửa 3 phần tử');
  });

  it('keeps the special theme labels and the older ones', () => {
    expect(label('history:theme', { op: 'add', name: 'brand' })).toBe('thêm token brand');
    expect(label('history:draftCreate', { name: 'Hero' })).toBe('tạo bản nháp Hero');
    expect(label('history:setClassName')).toBe('đổi class');
    expect(label('history:setDataArray', { name: 'products' })).toBe('sửa bảng dữ liệu products');
    expect(label('history:setProp', { tag: 'Button' })).toBe('đổi prop <Button>');
  });

  it('shows the key itself only when there is no translation', () => {
    expect(label('history:somethingNew')).toBe('history:somethingNew');
    expect(label('history:theme', { op: 'set', name: 'x' })).toBe('sửa token x');
  });
});
