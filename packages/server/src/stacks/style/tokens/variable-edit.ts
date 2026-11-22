// AST-based CSS, Sass, Less variable reading and editing (SPEC-04 R-TH-10 to R-TH-14, R-ST-11).
import { err, ok, type Result } from '@kumicraft/shared';
import type { ChildNode, Root, Rule } from 'postcss';
import type postcssLess from 'postcss-less';

import { parseStylesheet } from '../css-locate.ts';

export type VariableScope = 'root' | 'sass' | 'less';

export type VariableNode = {
  readonly variable: string;
  readonly value: string;
  readonly start: number;
  readonly end: number;
};

function splitBom(text: string): { readonly bom: string; readonly body: string } {
  if (text.startsWith('\uFEFF')) {
    return { bom: '\uFEFF', body: text.slice(1) };
  }
  return { bom: '', body: text };
}

function parseRoot(text: string, file?: string): Root | undefined {
  try {
    return parseStylesheet(text, file);
  } catch {
    return undefined;
  }
}

function isTopLevelRootRule(node: ChildNode): node is Rule {
  return node.type === 'rule' && node.parent?.type === 'root' && node.selector.trim() === ':root';
}

function isLessVariableAtRule(node: ChildNode): node is postcssLess.VariableAtRule {
  return node.type === 'atrule' && 'variable' in node && Boolean(node.variable);
}

function collectRootVars(root: Root): VariableNode[] {
  const result: VariableNode[] = [];
  root.each((node) => {
    if (!isTopLevelRootRule(node)) return;
    node.each((decl) => {
      if (decl.type !== 'decl' || !decl.prop.startsWith('--')) return;
      if (decl.source?.start?.offset === undefined || decl.source.end?.offset === undefined) return;
      result.push({
        variable: decl.prop.trim(),
        value: decl.value.trim(),
        start: decl.source.start.offset,
        end: decl.source.end.offset,
      });
    });
  });
  return result;
}

function collectSassVars(root: Root): VariableNode[] {
  const result: VariableNode[] = [];
  root.each((decl) => {
    if (decl.type !== 'decl' || !decl.prop.startsWith('$')) return;
    if (decl.source?.start?.offset === undefined || decl.source.end?.offset === undefined) return;
    const cleanVal = decl.value.replace(/\s*!default\s*$/, '').trim();
    result.push({
      variable: decl.prop.trim(),
      value: cleanVal,
      start: decl.source.start.offset,
      end: decl.source.end.offset,
    });
  });
  return result;
}

function collectLessVars(root: Root): VariableNode[] {
  const result: VariableNode[] = [];
  root.each((node) => {
    if (node.parent?.type !== 'root' || !isLessVariableAtRule(node)) return;
    if (node.source?.start?.offset === undefined || node.source.end?.offset === undefined) return;
    const rawVal = typeof node.value === 'string' ? node.value : node.params;
    result.push({
      variable: `@${node.name.trim()}`,
      value: rawVal.trim(),
      start: node.source.start.offset,
      end: node.source.end.offset,
    });
  });
  return result;
}

export function listVariables(
  text: string,
  file: string | undefined,
  scope: VariableScope,
): VariableNode[] {
  const { body } = splitBom(text);
  const root = parseRoot(body, file);
  if (root === undefined) return [];
  switch (scope) {
    case 'root':
      return collectRootVars(root);
    case 'sass':
      return collectSassVars(root);
    case 'less':
      return collectLessVars(root);
  }
}

function replaceNodeValue(nodeText: string, newValue: string): string {
  const colonIdx = nodeText.indexOf(':');
  if (colonIdx === -1) return nodeText;
  const prefix = nodeText.slice(0, colonIdx + 1);
  const rest = nodeText.slice(colonIdx + 1);
  const match = /^(\s*)(.*?)(\s*!(?:default|important))?(\s*;?\s*)$/s.exec(rest) ?? undefined;
  if (match === undefined) return `${prefix} ${newValue};`;
  const leading = match[1] ?? ' ';
  const flag = match[3] ?? '';
  const trailing = match[4] ?? ';';
  return `${prefix}${leading}${newValue}${flag}${trailing}`;
}

export function setVariable(
  text: string,
  file: string | undefined,
  scope: VariableScope,
  variable: string,
  value: string,
): Result<string> {
  const { bom, body } = splitBom(text);
  const vars = listVariables(body, file, scope);
  const target = vars.find((v) => v.variable === variable);
  if (target === undefined) {
    return err({ code: 'E016', params: { reason: 'tokenNotFound' } });
  }

  const nodeText = body.slice(target.start, target.end);
  const updated = replaceNodeValue(nodeText, value.trim());
  const newBody = `${body.slice(0, target.start)}${updated}${body.slice(target.end)}`;
  return ok(`${bom}${newBody}`);
}

export function removeVariable(
  text: string,
  file: string | undefined,
  scope: VariableScope,
  variable: string,
): Result<string> {
  const { bom, body } = splitBom(text);
  const vars = listVariables(body, file, scope);
  const target = vars.find((v) => v.variable === variable);
  if (target === undefined) {
    return err({ code: 'E016', params: { reason: 'tokenNotFound' } });
  }

  const lineStart = body.lastIndexOf('\n', target.start - 1) + 1;
  const isLeadingWhitespace = /^[ \t]*$/.test(body.slice(lineStart, target.start));

  const nextNewline = body.indexOf('\n', target.end);
  const lineEnd = nextNewline === -1 ? body.length : nextNewline + 1;
  let afterOnLine = body.slice(target.end, nextNewline === -1 ? body.length : nextNewline);
  if (afterOnLine.endsWith('\r')) afterOnLine = afterOnLine.slice(0, -1);
  const isTrailingWhitespace = /^[ \t]*$/.test(afterOnLine);

  let removeStart = target.start;
  let removeEnd = target.end;
  if (isLeadingWhitespace && isTrailingWhitespace) {
    removeStart = lineStart;
    removeEnd = lineEnd;
  }

  const newBody = `${body.slice(0, removeStart)}${body.slice(removeEnd)}`;
  return ok(`${bom}${newBody}`);
}

function insertIntoRoot(
  body: string,
  file: string | undefined,
  variable: string,
  value: string,
  eol: string,
): string {
  const root = parseRoot(body, file);
  const rootNode = root?.nodes.find((n) => isTopLevelRootRule(n));
  const lineToInsert = `  ${variable}: ${value.trim()};`;

  if (rootNode?.source?.end?.offset !== undefined) {
    const closeOffset = body.lastIndexOf('}', rootNode.source.end.offset);
    if (closeOffset !== -1) {
      const beforeClose = body.slice(0, closeOffset).trimEnd();
      const afterClose = body.slice(closeOffset);
      return `${beforeClose}${eol}${lineToInsert}${eol}${afterClose}`;
    }
  }

  // Find last top-level @import to place :root after it
  let lastImportOffset = 0;
  root?.each((n) => {
    if (n.type === 'atrule' && n.name === 'import' && n.source?.end?.offset !== undefined) {
      const nextNl = body.indexOf('\n', n.source.end.offset);
      lastImportOffset = nextNl === -1 ? body.length : nextNl + 1;
    }
  });

  const block = `:root {${eol}${lineToInsert}${eol}}${eol}${eol}`;
  if (lastImportOffset > 0) {
    return `${body.slice(0, lastImportOffset)}${eol}${block}${body.slice(lastImportOffset)}`;
  }
  return `${block}${body}`;
}

export function insertVariable(
  text: string,
  file: string | undefined,
  scope: VariableScope,
  variable: string,
  value: string,
  options?: { readonly importOffset?: number },
): Result<string> {
  const { bom, body } = splitBom(text);
  const vars = listVariables(body, file, scope);
  if (vars.some((v) => v.variable === variable)) {
    return err({ code: 'E016', params: { reason: 'tokenExists' } });
  }

  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  if (options?.importOffset !== undefined) {
    const insertion = `${variable}: ${value.trim()};${eol}`;
    const newBody = `${body.slice(0, options.importOffset)}${insertion}${body.slice(options.importOffset)}`;
    return ok(`${bom}${newBody}`);
  }

  if (scope === 'root') {
    return ok(`${bom}${insertIntoRoot(body, file, variable, value, eol)}`);
  }

  // Top-level Sass or Less
  const lastVar = vars[vars.length - 1];
  if (lastVar !== undefined) {
    const nextNl = body.indexOf('\n', lastVar.end);
    const insertPos = nextNl === -1 ? body.length : nextNl + 1;
    const insertion = `${variable}: ${value.trim()};${eol}`;
    const newBody = `${body.slice(0, insertPos)}${insertion}${body.slice(insertPos)}`;
    return ok(`${bom}${newBody}`);
  }

  const newBody = `${variable}: ${value.trim()};${eol}${body}`;
  return ok(`${bom}${newBody}`);
}
