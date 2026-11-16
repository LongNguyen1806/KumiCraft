// @vitest-environment happy-dom
// The "Customize" group (thiet-ke-component.md §3–§5): a card naming the component, the knobs
// grouped by what they do in plain words, a package flagged and never edited inside, nothing for a
// plain element, text written when the field is left rather than on each key.
import type { ComponentPropsResponse } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as projectClient from '../../../api/project-client.ts';
import * as sourceClient from '../../../api/source-client.ts';
import { initI18n } from '../../../i18n/i18n.ts';
import { ComponentPropsSection } from './component-props-section.tsx';

beforeAll(async () => {
  await initI18n();
  await i18next.changeLanguage('vi');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const base = { required: false, hasValue: false, readonlyExpression: false } as const;

function renderWith(response: ComponentPropsResponse, tag = 'ProductCard') {
  vi.spyOn(projectClient, 'fetchComponentProps').mockResolvedValue(response);
  const edit = vi.spyOn(sourceClient, 'editSource').mockResolvedValue({
    changed: true,
    file: 'src/pages/Home.tsx',
    fileHash: 'b'.repeat(64),
    element: {
      loc: 'src/pages/Home.tsx:7:9',
      tag: tag,
      fileHash: 'b'.repeat(64),
      className: { kind: 'static', value: '' },
      text: { kind: 'none' },
      attributes: {},
      inLoop: false,
    },
  });
  render(
    <ComponentPropsSection
      loc="src/pages/Home.tsx:7:9"
      tag={tag}
      fileHash={'a'.repeat(64)}
      disabled={false}
      onSaved={vi.fn()}
    />,
  );
  return edit;
}

describe('ComponentPropsSection', () => {
  it('groups the knobs of a project component under a card, in plain words [R-IN-11]', async () => {
    renderWith({
      tag: 'ProductCard',
      sourceKind: 'typescript',
      componentFile: 'src/components/ProductCard.tsx',
      props: [
        { ...base, name: 'price', kind: 'string', role: 'content' },
        { ...base, name: 'name', kind: 'string', role: 'content', hasValue: true, value: 'Áo' },
        {
          ...base,
          name: 'image',
          kind: 'string',
          role: 'image',
          hasValue: true,
          readonlyExpression: true,
          expression: 'item.img',
        },
        { ...base, name: 'showSale', kind: 'boolean', role: 'toggle', defaultValue: true },
        { ...base, name: 'sku', kind: 'string', role: 'advanced' },
      ],
    });
    await waitFor(() => {
      expect(screen.getByTestId('prop-group-content')).toBeDefined();
    });
    expect(screen.getByTestId('component-card').textContent).toContain('ProductCard.tsx');
    expect(screen.getByTestId('component-edit')).toBeDefined();
    // Set knobs first; the name in words with the code name under it.
    const content = screen.getByTestId('prop-group-content').textContent;
    expect(content.indexOf('Tên')).toBeLessThan(content.indexOf('Giá'));
    // An image knob picks from the project's images, even over a value written as code.
    expect(screen.getByTestId('prop-pick-image-image')).toBeDefined();
    expect(screen.getByTestId('prop-row-image').textContent).toContain('item.img');
    expect(screen.getByTestId<HTMLInputElement>('prop-input-showSale').checked).toBe(true);
    expect(screen.getByTestId('prop-row-showSale').textContent).toContain('Hiện nhãn giảm giá');
    expect(screen.getByTestId('prop-group-advanced').textContent).toContain('sku');
  });

  it('writes text when the field is left, not on each key [R-IN-11]', async () => {
    const edit = renderWith({
      tag: 'ProductCard',
      sourceKind: 'typescript',
      props: [{ ...base, name: 'price', kind: 'string', role: 'content' }],
    });
    const field = await screen.findByTestId<HTMLInputElement>('prop-input-price');
    fireEvent.change(field, { target: { value: '200k' } });
    expect(edit).not.toHaveBeenCalled();
    fireEvent.blur(field);
    await waitFor(() => {
      expect(edit).toHaveBeenCalledTimes(1);
    });
    expect(edit.mock.calls[0]?.[0].edit).toMatchObject({ name: 'price', value: '200k' });
  });

  it('swaps a value written as code for a fixed one when asked [R-IN-11]', async () => {
    const edit = renderWith({
      tag: 'ProductCard',
      sourceKind: 'typescript',
      props: [
        {
          ...base,
          name: 'price',
          kind: 'string',
          role: 'content',
          hasValue: true,
          readonlyExpression: true,
          expression: 'item.price',
        },
      ],
    });
    fireEvent.click(await screen.findByTestId('prop-fix-price'));
    const field = screen.getByTestId<HTMLInputElement>('prop-input-price');
    fireEvent.change(field, { target: { value: '99k' } });
    fireEvent.blur(field);
    await waitFor(() => {
      expect(edit).toHaveBeenCalledTimes(1);
    });
    expect(edit.mock.calls[0]?.[0].edit).toMatchObject({
      name: 'price',
      value: '99k',
      replaceExpression: true,
    });
  });

  it('flags a package component and offers no edit of its inside [R-IN-11]', async () => {
    renderWith(
      {
        tag: 'Button',
        sourceKind: 'typescript',
        packageName: '@mui/material',
        props: [
          {
            ...base,
            name: 'variant',
            kind: 'union',
            role: 'style',
            options: ['text', 'outlined', 'contained'],
          },
        ],
      },
      'Button',
    );
    expect((await screen.findByTestId('component-package')).textContent).toContain('@mui/material');
    expect(screen.queryByTestId('component-edit')).toBeNull();
    expect(screen.getByTestId('component-remove')).toBeDefined();
    expect(screen.getByTestId('prop-option-variant-contained').textContent).toBe('Đặc');
  });

  it('says so when a component has no knob, and shows nothing for a plain element [R-IN-11]', async () => {
    renderWith({ tag: 'Footer', sourceKind: 'typescript', props: [] }, 'Footer');
    expect((await screen.findByTestId('component-props-empty')).textContent).toContain(
      'Sửa component',
    );
    cleanup();
    renderWith({ tag: 'img', sourceKind: 'unknown', props: [] }, 'img');
    await waitFor(() => {
      expect(screen.queryByTestId('component-card')).toBeNull();
    });
    expect(screen.queryByTestId('component-props')).toBeNull();
  });
});
