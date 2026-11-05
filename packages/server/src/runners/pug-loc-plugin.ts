// Injects data-rc-loc into Pug AST for Visual Inspection (SPEC-04 M-RN, Phase 4 K4).
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';

type PugAttr = {
  name: string;
  val: string;
  mustEscape?: boolean;
};

type PugAstNode = {
  type?: string;
  name?: string;
  line?: number;
  column?: number;
  filename?: string;
  attrs?: PugAttr[];
  nodes?: unknown[];
  block?: unknown;
  consequent?: unknown;
  alternate?: unknown;
  [key: string]: unknown;
};

const SKIP_TAGS = new Set(['html', 'head', 'body']);
const CHILD_KEYS = ['nodes', 'block', 'consequent', 'alternate'] as const;

function shouldSkipTag(name: string, inHead: boolean): boolean {
  return inHead || SKIP_TAGS.has(name);
}

function attachLocAttr(node: PugAstNode, root: string): void {
  if (typeof node.filename !== 'string') return;
  if (!Array.isArray(node.attrs)) {
    node.attrs = [];
  }
  const hasLoc = node.attrs.some((a) => a.name === 'data-rc-loc');
  if (hasLoc) return;

  const rel = relative(root, node.filename).replaceAll('\\', '/');
  const line = node.line ?? 1;
  const col = typeof node.column === 'number' ? node.column : 1;
  node.attrs.push({
    name: 'data-rc-loc',
    val: JSON.stringify(`${rel}:${String(line)}:${String(col)}`),
    mustEscape: false,
  });
}

function walkPugAst(node: unknown, root: string, inHead = false): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) {
      walkPugAst(item, root, inHead);
    }
    return;
  }

  const astNode = node as PugAstNode;
  const tagName = typeof astNode.name === 'string' ? astNode.name.toLowerCase() : '';
  const isHead = astNode.type === 'Tag' && tagName === 'head';
  const headScope = inHead || isHead;

  if (astNode.type === 'Tag' && typeof astNode.line === 'number') {
    if (!shouldSkipTag(tagName, headScope)) {
      attachLocAttr(astNode, root);
    }
  }

  for (const key of CHILD_KEYS) {
    if (astNode[key] !== undefined) {
      walkPugAst(astNode[key], root, headScope);
    }
  }
}

export type PugPlugin = {
  postLink: (ast: unknown) => unknown;
};

export function createPugLocPlugin(root: string): PugPlugin {
  return {
    postLink: (ast: unknown) => {
      walkPugAst(ast, root);
      return ast;
    },
  };
}

const HOOKED_PUG = Symbol.for('kumicraft.hooked.pug');

function withPlugin(options: unknown, plugin: PugPlugin): Record<string, unknown> {
  const opts =
    options && typeof options === 'object' ? { ...(options as Record<string, unknown>) } : {};
  const existing = Array.isArray(opts.plugins) ? (opts.plugins as unknown[]) : [];
  opts.plugins = [...existing, plugin];
  return opts;
}

function wrapCompile(pug: Record<string | symbol, unknown>, plugin: PugPlugin): void {
  const origCompile = pug.compile as ((...args: unknown[]) => unknown) | undefined;
  if (typeof origCompile === 'function') {
    pug.compile = function (template: unknown, options?: unknown) {
      return origCompile.call(this, template, withPlugin(options, plugin));
    };
  }
  const origCompileFile = pug.compileFile as ((...args: unknown[]) => unknown) | undefined;
  if (typeof origCompileFile === 'function') {
    pug.compileFile = function (path: unknown, options?: unknown) {
      return origCompileFile.call(this, path, withPlugin(options, plugin));
    };
  }
}

function wrapRender(pug: Record<string | symbol, unknown>, plugin: PugPlugin): void {
  const origRender = pug.render as ((...args: unknown[]) => unknown) | undefined;
  if (typeof origRender === 'function') {
    pug.render = function (template: unknown, options?: unknown, callback?: unknown) {
      if (typeof options === 'function') {
        return origRender.call(this, template, withPlugin(undefined, plugin), options);
      }
      return origRender.call(this, template, withPlugin(options, plugin), callback);
    };
  }
  const origRenderFile = pug.renderFile as ((...args: unknown[]) => unknown) | undefined;
  if (typeof origRenderFile === 'function') {
    pug.renderFile = function (path: unknown, options?: unknown, callback?: unknown) {
      if (typeof options === 'function') {
        return origRenderFile.call(this, path, withPlugin(undefined, plugin), options);
      }
      return origRenderFile.call(this, path, withPlugin(options, plugin), callback);
    };
  }
}

function wrapExpress(pug: Record<string | symbol, unknown>, plugin: PugPlugin): void {
  const origExpress = pug.__express as ((...args: unknown[]) => unknown) | undefined;
  if (typeof origExpress === 'function') {
    pug.__express = function (path: unknown, options?: unknown, callback?: unknown) {
      return origExpress.call(this, path, withPlugin(options, plugin), callback);
    };
  }
}

export function hookPug(
  root: string,
  pugModule?: Record<string | symbol, unknown>,
): Record<string | symbol, unknown> | undefined {
  let pug = pugModule;
  if (!pug) {
    try {
      const projectRequire = createRequire(join(root, 'package.json'));
      pug = projectRequire('pug') as Record<string | symbol, unknown>;
    } catch {
      return undefined;
    }
  }
  if (pug[HOOKED_PUG]) return pug;
  pug[HOOKED_PUG] = true;

  const plugin = createPugLocPlugin(root);
  wrapCompile(pug, plugin);
  wrapRender(pug, plugin);
  wrapExpress(pug, plugin);
  return pug;
}
