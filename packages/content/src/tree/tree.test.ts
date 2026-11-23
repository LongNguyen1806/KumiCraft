// Every library block reads into the neutral tree and renders back to the same page in every
// language (03b section 2.3): the HTML of the tree is the HTML React builds from the block's JSX,
// the JSX written from the tree builds that same HTML, and so does the Pug written from it.
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { LIBRARY_BLOCKS } from '../blocks.ts';
import {
  parseBlockJsx,
  renderHtml,
  renderJsx,
  renderPug,
  renderPugSource,
  renderRazor,
} from './index.ts';

const pugModule: unknown = createRequire(import.meta.url)('pug');

/** Pug's render (the package has no types here). */
function pugRender(source: string): string {
  const render: unknown = Reflect.get(Object(pugModule), 'render');
  if (typeof render !== 'function') throw new Error('pug.render not found');
  return String(Reflect.apply(render, pugModule, [source]));
}

/** What React writes for a JSX string (compiled by TypeScript, as in a project). */
function reactHtml(jsx: string): string {
  const js = ts.transpileModule(`(<>${jsx}</>);`, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      jsxFactory: 'React.createElement',
      jsxFragmentFactory: 'React.Fragment',
    },
    fileName: 'block.tsx',
  }).outputText;
  const element: unknown = runInNewContext(js, { React });
  if (!React.isValidElement(element)) throw new Error('not an element');
  return renderToStaticMarkup(element);
}

/** Pug writes `class` first; attribute order does not change the page, so compare sorted. */
function sortAttrs(html: string): string {
  const attr = /\s[^\s=/>]+(?:="[^"]*")?/g;
  return html.replace(
    /<([a-z][\w-]*)((?:\s[^\s=/>]+(?:="[^"]*")?)*)(\/?)>/g,
    (_m, tag: string, attrs: string, close: string) =>
      `<${tag}${[...(attrs.match(attr) ?? [])].sort().join('')}${close}>`,
  );
}

type Sample = { readonly name: string; readonly jsx: string };

function samples(): Sample[] {
  const out: Sample[] = [];
  for (const block of LIBRARY_BLOCKS) {
    if (block.kit !== undefined) continue; // a kit is a React component, not static markup (03b 2.2)
    const forms = [block, ...(block.variants ?? [])];
    for (const form of forms) {
      for (const lang of ['vi', 'en'] as const) {
        out.push({ name: `${form.id} ${lang} tailwind`, jsx: form.jsx[lang] });
        out.push({ name: `${form.id} ${lang} neutral`, jsx: form.neutral.jsx[lang] });
      }
    }
  }
  return out;
}

const SAMPLES = samples();

describe('neutral block tree [03b section 2.3]', () => {
  it('covers the library', () => {
    expect(SAMPLES.length).toBeGreaterThan(300);
  });

  it.each(SAMPLES)(
    '$name: HTML, JSX, Pug (both) and Razor from the tree build the page React builds',
    ({ jsx }) => {
      const expected = reactHtml(jsx);
      const tree = parseBlockJsx(jsx);

      expect(renderHtml(tree)).toBe(expected);
      expect(reactHtml(renderJsx(tree))).toBe(expected);
      expect(sortAttrs(pugRender(renderPug(tree)))).toBe(sortAttrs(expected));
      expect(sortAttrs(pugRender(renderPugSource(tree).join('\n')))).toBe(sortAttrs(expected));
      // Razor: `@@` is an `@`; the line breaks it adds sit only between laid-out elements.
      const razor = renderRazor(tree, '  ');
      expect(razor.replaceAll(/\n\s*/g, '').replaceAll('@@', '@')).toBe(expected);
    },
  );
});
