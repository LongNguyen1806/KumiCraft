// Pure class/CSS diffing and JSX rewriting helpers for SelectGroup (K9.8-1 TK-73).
import type { Result } from '@kumicraft/shared';
import { err, ok } from '@kumicraft/shared';

import type { AstNode } from '../ast-helpers.ts';
import { asAstNode, getJsxTagName } from '../ast-helpers.ts';
import { readClassName } from '../attribute-reader.ts';

export type SelectGroupSplitResult = {
  readonly baseClassesPerItem: readonly string[];
  readonly selectedOnlyTokens: readonly string[];
  readonly fallbackSelectedClass: string | undefined;
};

function tokenize(cls: string | undefined): string[] {
  return (cls ?? '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('data-[selected=true]:'));
}

export function stripSelectedVariants(className: string | undefined): string {
  return (className ?? '')
    .split(/\s+/)
    .filter((tok) => tok.length > 0 && !tok.startsWith('data-[selected=true]:'))
    .map((tok) => tok.trim())
    .join(' ');
}

export function splitTailwindSelectClasses(
  classNames: readonly (string | undefined)[],
): readonly string[] {
  const lists = classNames.map(tokenize);
  const first = lists[0] ?? [];
  const rest = lists.slice(1);
  if (rest.length === 0) return classNames.map((c) => c ?? '');

  const restIntersect = rest[0]?.filter((t) => rest.every((r) => r.includes(t))) ?? [];
  const selectedOnly = first.filter((t) => !restIntersect.includes(t));
  const commonAll = first.filter((t) => restIntersect.includes(t));
  const unselectedDiff = restIntersect.filter((t) => !first.includes(t));

  const sharedBase = [...commonAll, ...unselectedDiff];
  const prefixedSelected = selectedOnly.map((t) => `data-[selected=true]:${t}`);
  const merged = [...sharedBase, ...prefixedSelected].join(' ');
  return classNames.map(() => merged);
}

export function readElementStaticClassName(el: AstNode, code: string): Result<string> {
  const opening = asAstNode(el['openingElement']);
  if (opening === undefined) {
    return err({ code: 'E023', params: { reason: 'missingOpening' } });
  }
  const attrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  const cls = readClassName(attrs, code);
  if (cls.kind === 'expression' || cls.kind === 'duplicate') {
    return err({ code: 'E023', params: { reason: 'classExpression' } });
  }
  if (cls.kind === 'static' || cls.kind === 'callStatic' || cls.kind === 'templateStatic') {
    return ok(cls.value);
  }
  return ok('');
}

export function readAttrsExcluding(
  opening: AstNode,
  code: string,
  excludedNames: ReadonlySet<string>,
): readonly string[] {
  const attrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  const kept: string[] = [];
  for (const raw of attrs) {
    const attr = asAstNode(raw);
    if (attr === undefined || attr.start === undefined || attr.end === undefined) continue;
    if (attr.type === 'JSXAttribute') {
      const name = asAstNode(attr['name'])?.['name'];
      if (typeof name === 'string' && excludedNames.has(name)) continue;
    }
    kept.push(code.slice(attr.start, attr.end));
  }
  return kept;
}

export function buildSelectItemJsx(options: {
  readonly originalTag: string;
  readonly value: string;
  readonly className: string;
  readonly selectedClassName?: string | undefined;
  readonly otherAttrs: readonly string[];
  readonly childrenCode: string | undefined;
}): string {
  const attrs: string[] = [
    `as="${options.originalTag}"`,
    `value="${options.value}"`,
    ...(options.className.length > 0 ? [`className="${options.className}"`] : []),
    ...(options.selectedClassName && options.selectedClassName.length > 0
      ? [`selectedClassName="${options.selectedClassName}"`]
      : []),
    ...options.otherAttrs,
  ];
  if (options.childrenCode === undefined) {
    return `<SelectItem ${attrs.join(' ')} />`;
  }
  return `<SelectItem ${attrs.join(' ')}>${options.childrenCode}</SelectItem>`;
}

export function restoreElementFromSelectItem(
  el: AstNode,
  code: string,
  isTailwind: boolean,
): Result<string> {
  const opening = asAstNode(el['openingElement']);
  if (opening === undefined) return err({ code: 'E023', params: { reason: 'missingOpening' } });
  const attrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  let asTag = 'button';
  for (const raw of attrs) {
    const attr = asAstNode(raw);
    if (attr?.type !== 'JSXAttribute') continue;
    if (asAstNode(attr['name'])?.['name'] === 'as') {
      const val = asAstNode(attr['value']);
      if (val?.type === 'StringLiteral' && typeof val['value'] === 'string') {
        asTag = val['value'];
      }
    }
  }
  const rawClass = readElementStaticClassName(el, code);
  const cleanedClass = rawClass.ok
    ? isTailwind
      ? stripSelectedVariants(rawClass.value)
      : rawClass.value
    : '';
  const kept = readAttrsExcluding(
    opening,
    code,
    new Set(['as', 'value', 'className', 'selectedClassName']),
  );
  const allAttrs = [
    ...(cleanedClass.length > 0 ? [`className="${cleanedClass}"`] : []),
    ...kept,
  ].join(' ');
  const attrStr = allAttrs.length > 0 ? ` ${allAttrs}` : '';
  const selfClosing = opening['selfClosing'] === true;
  if (selfClosing) return ok(`<${asTag}${attrStr} />`);
  const closing = asAstNode(el['closingElement']);
  const innerStart = opening.end ?? el.start ?? 0;
  const innerEnd = closing?.start ?? el.end ?? innerStart;
  return ok(`<${asTag}${attrStr}>${code.slice(innerStart, innerEnd)}</${asTag}>`);
}

export function readJsxAttrString(opening: AstNode, attrName: string): string | undefined {
  const attrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  for (const raw of attrs) {
    const attr = asAstNode(raw);
    if (attr?.type !== 'JSXAttribute') continue;
    if (asAstNode(attr['name'])?.['name'] !== attrName) continue;
    const val = asAstNode(attr['value']);
    if (val?.type === 'StringLiteral' && typeof val['value'] === 'string') {
      return val['value'];
    }
  }
  return undefined;
}

export function tagOf(node: AstNode): string | undefined {
  const opening = asAstNode(node['openingElement']);
  return opening !== undefined ? getJsxTagName(opening) : undefined;
}
