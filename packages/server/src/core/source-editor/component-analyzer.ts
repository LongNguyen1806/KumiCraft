// Enclosing component and loop detection (R-SE-14, R-SE-15). Usages over the project are counted in
// component-usages.ts.
import type { AstNode } from './ast-helpers.ts';
import { asAstNode } from './ast-helpers.ts';

function getComponentNameFromNode(astN: AstNode): string | undefined {
  const nameNode = asAstNode(astN['id']);
  const idName = typeof nameNode?.['name'] === 'string' ? nameNode['name'] : '';
  if (!/^[A-Z]/.test(idName)) return undefined;

  if (astN.type === 'FunctionDeclaration') {
    return idName;
  }
  if (
    astN.type === 'VariableDeclarator' &&
    typeof asAstNode(astN['init'])?.type === 'string' &&
    (asAstNode(astN['init'])?.type.includes('Function') ?? false)
  ) {
    return idName;
  }
  return undefined;
}

function walkAstChildren(node: AstNode, callback: (child: unknown) => void): void {
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) callback(item);
    } else if (child !== undefined && typeof child === 'object') {
      callback(child);
    }
  }
}

export function findEnclosingComponent(ast: AstNode, targetNode: AstNode): string | undefined {
  let compName: string | undefined;

  function walk(node: unknown, currentComp?: string) {
    const astN = asAstNode(node);
    if (!astN) return;

    const detected = getComponentNameFromNode(astN);
    const nextComp = detected ?? currentComp;

    if (astN === targetNode) {
      compName = nextComp;
      return;
    }

    walkAstChildren(astN, (child) => {
      walk(child, nextComp);
    });
  }

  walk(ast['program'], undefined);
  return compName;
}

export function checkInLoop(ast: AstNode, targetNode: AstNode): boolean {
  let inLoop = false;

  function walk(node: unknown, loopDepth: number) {
    const astN = asAstNode(node);
    if (!astN) return;

    let nextDepth = loopDepth;
    if (astN.type === 'CallExpression') {
      const callee = asAstNode(astN['callee']);
      const prop = asAstNode(callee?.['property']);
      if (prop?.['name'] === 'map' || prop?.['name'] === 'flatMap') {
        nextDepth++;
      }
    }

    if (astN === targetNode) {
      if (nextDepth > 0) inLoop = true;
      return;
    }

    walkAstChildren(astN, (child) => {
      walk(child, nextDepth);
    });
  }

  walk(ast['program'], 0);
  return inLoop;
}
