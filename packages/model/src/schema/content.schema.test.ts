import { describe, expect, it } from 'vitest';

import { BindingSchema } from './binding.schema.ts';
import { ContentPropsSchema } from './content.schema.ts';
import { InteractionSchema } from './interaction.schema.ts';

const ok = (value: unknown) => ContentPropsSchema.safeParse(value).success;

describe('ContentPropsSchema', () => {
  it('accepts one variant per kind', () => {
    const samples = [
      { kind: 'text', text: 'Hello' },
      { kind: 'heading', text: 'Title', level: 2 },
      { kind: 'image', src: 'asset:hero.png', alt: 'Hero' },
      { kind: 'icon', name: 'shopping-cart', size: { px: 20 } },
      { kind: 'link', text: 'Docs', href: '/docs' },
      { kind: 'button', text: 'Buy', variant: 'primary', buttonType: 'submit', iconLeft: 'plus' },
      { kind: 'input', label: 'Email', inputType: 'email', fieldName: 'email' },
      { kind: 'textarea', label: 'Note', fieldName: 'note', rows: 4 },
      { kind: 'select', label: 'Size', fieldName: 'size', options: [{ value: 's', label: 'S' }] },
      { kind: 'choice', label: 'Agree', fieldName: 'agree' },
      { kind: 'table', columns: [{ id: 'c1', header: 'Name', field: 'name' }], emptyText: 'None' },
      { kind: 'list', emptyText: 'None', dataOptions: { pageSize: 10 } },
      { kind: 'detail', notFoundText: 'Missing' },
      { kind: 'section', as: 'header' },
      { kind: 'container', maxWidth: 'xl' },
      { kind: 'modal', title: 'Cart' },
      { kind: 'tabs', items: [{ id: 'info', label: 'Info' }] },
      { kind: 'instance', componentId: 'c_9kLm2xQw7e', propValues: { title: 'A' } },
      { kind: 'slot', name: 'actions' },
      { kind: 'none' },
    ];

    expect(samples.filter((sample) => !ok(sample))).toEqual([]);
  });

  it('limits text to 10 000 characters [V-22]', () => {
    expect(ok({ kind: 'text', text: 'a'.repeat(10_000) })).toBe(true);
    expect(ok({ kind: 'text', text: 'a'.repeat(10_001) })).toBe(false);
  });

  it('needs runs that join to text and differ from their neighbours [V-34]', () => {
    const runs = [{ text: 'Hello ' }, { text: 'world', bold: true }];

    expect(ok({ kind: 'text', text: 'Hello world', runs })).toBe(true);
    expect(ok({ kind: 'text', text: 'Hello', runs })).toBe(false);
    expect(
      ok({
        kind: 'text',
        text: 'ab',
        runs: [
          { text: 'a', bold: true },
          { text: 'b', bold: true },
        ],
      }),
    ).toBe(false);
  });

  it('accepts only safe link schemes in links and runs [V-35, V-99]', () => {
    for (const good of [
      'https://a.dev',
      'http://a.dev',
      'mailto:a@b.c',
      'tel:+84',
      '/about',
      '#top',
    ]) {
      expect(ok({ kind: 'link', text: 'x', href: good })).toBe(true);
    }
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      'vbscript:x',
      'file:///etc',
      ' javascript:x',
    ]) {
      expect(ok({ kind: 'link', text: 'x', href: bad })).toBe(false);
    }
    expect(
      ok({ kind: 'text', text: 'x', runs: [{ text: 'x', link: { href: 'javascript:x' } }] }),
    ).toBe(false);
  });

  it('accepts remote images and workspace assets only [V-24]', () => {
    expect(ok({ kind: 'image', src: 'https://cdn.example/a.png', alt: '' })).toBe(true);
    expect(ok({ kind: 'image', src: 'asset:../secret.png', alt: '' })).toBe(false);
    expect(ok({ kind: 'image', src: 'data:image/png;base64,AAA', alt: '' })).toBe(false);
  });

  it('checks field validation bounds and input types [V-36]', () => {
    const input = (inputType: string, validation: object) =>
      ok({ kind: 'input', label: 'x', inputType, fieldName: 'x', validation });

    expect(input('number', { min: 1, max: 5 })).toBe(true);
    expect(input('number', { min: 5, max: 1 })).toBe(false);
    expect(input('text', { min: 1 })).toBe(false);
    expect(input('date', { minDate: '2026-01-01', maxDate: '2026-12-31' })).toBe(true);
    expect(input('date', { minDate: '2026-12-31', maxDate: '2026-01-01' })).toBe(false);
    expect(input('text', { minLength: 3, maxLength: 2 })).toBe(false);
    expect(ok({ kind: 'textarea', label: 'x', fieldName: 'x', validation: { min: 1 } })).toBe(
      false,
    );
  });

  it('accepts valid field names only [V-23]', () => {
    expect(ok({ kind: 'choice', label: 'x', fieldName: '_ok1' })).toBe(true);
    expect(ok({ kind: 'choice', label: 'x', fieldName: '1bad' })).toBe(false);
    expect(ok({ kind: 'choice', label: 'x', fieldName: 'with-dash' })).toBe(false);
  });
});

describe('InteractionSchema', () => {
  const interaction = (actions: unknown[]) =>
    InteractionSchema.safeParse({ id: 'i_Ab3dE6gH', trigger: 'click', actions }).success;

  it('accepts the closed set of actions', () => {
    expect(
      interaction([
        {
          type: 'navigate',
          pageId: 'p_4f90d13a2b',
          params: { id: { kind: 'field', field: 'id' } },
        },
        { type: 'toggle', targetId: 'n_V1StGXR8_Z' },
        { type: 'showToast', message: 'Saved', tone: 'success' },
      ]),
    ).toBe(true);
    expect(interaction([{ type: 'runScript', code: 'x' }])).toBe(false);
  });

  it('allows 1 to 5 actions [V-96]', () => {
    const toast = { type: 'showToast', message: 'x', tone: 'info' };

    expect(interaction([])).toBe(false);
    expect(interaction(Array.from({ length: 5 }, () => toast))).toBe(true);
    expect(interaction(Array.from({ length: 6 }, () => toast))).toBe(false);
  });

  it('opens only http, https, mailto and tel URLs [V-97]', () => {
    expect(interaction([{ type: 'openUrl', url: 'https://a.dev', newTab: true }])).toBe(true);
    expect(interaction([{ type: 'openUrl', url: '/relative', newTab: false }])).toBe(false);
    expect(interaction([{ type: 'openUrl', url: 'javascript:x', newTab: false }])).toBe(false);
  });
});

describe('BindingSchema', () => {
  it('accepts a source with an optional field path', () => {
    expect(
      BindingSchema.safeParse({ source: 'ds_products', field: 'category.name', format: 'text' })
        .success,
    ).toBe(true);
    expect(BindingSchema.safeParse({ source: 'ds_products', field: 'a..b' }).success).toBe(false);
    expect(BindingSchema.safeParse({ source: 'products' }).success).toBe(false);
  });
});
