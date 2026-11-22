import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import * as ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildKitTemplateCode, kitFileNames } from './kit-templates/index.ts';

describe('kit-templates (Test 7): strict TypeScript, JS syntax, and security', () => {
  let tmpDir = '';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(tmpdir(), 'kumicraft-kit-tpl-'));
  });

  afterEach(async () => {
    if (tmpDir.length > 0) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('compiles every TS template with tsc --strict and checks JS syntax & security', async () => {
    const names = kitFileNames();
    // 11 existing templates + 3 K9.8-1 templates (SelectGroup, LoadingButton, ScrollSpy); the
    // light/dark switch went to the AI tab in QA K9.8-1 and Toast was removed (owner, 2026-11-15).
    expect(names).toHaveLength(14);

    const studioTypes = path.resolve(__dirname, '../../../../../../studio/node_modules/@types');
    const tsFiles: string[] = [];
    const jsFiles: string[] = [];

    for (const name of names) {
      const tsCode = buildKitTemplateCode(name, true);
      const jsCode = buildKitTemplateCode(name, false);
      expect(tsCode).toBeDefined();
      expect(jsCode).toBeDefined();
      if (tsCode === undefined || jsCode === undefined) continue;

      for (const code of [tsCode, jsCode]) {
        expect(code, `${name} unsafe API`).not.toMatch(
          /\bdangerouslySetInnerHTML\b|\beval\s*\(|new\s+Function\b|\bfetch\s*\(|XMLHttpRequest/,
        );
        expect(code, `${name} uses forbidden null`).not.toContain('null');
      }
      expect(jsCode, `${name}.jsx leaked TS types`).not.toMatch(/\bexport type\b|\binterface\s+/);

      const tsPath = path.join(tmpDir, `${name}.tsx`);
      const jsPath = path.join(tmpDir, `${name}.jsx`);
      await fs.writeFile(tsPath, tsCode, 'utf8');
      await fs.writeFile(jsPath, jsCode, 'utf8');
      tsFiles.push(tsPath);
      jsFiles.push(jsPath);
    }

    const tsProgram = ts.createProgram(tsFiles, {
      strict: true,
      noUnusedLocals: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      typeRoots: [studioTypes],
      skipLibCheck: true,
    });
    const tsErrors = ts
      .getPreEmitDiagnostics(tsProgram)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    expect(tsErrors).toEqual([]);

    const jsProgram = ts.createProgram(jsFiles, {
      allowJs: true,
      checkJs: false,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      skipLibCheck: true,
    });
    const jsSyntaxErrors = jsFiles.flatMap((file) => {
      const sf = jsProgram.getSourceFile(file);
      return sf === undefined
        ? [`missing ${file}`]
        : jsProgram
            .getSyntacticDiagnostics(sf)
            .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    });
    expect(jsSyntaxErrors).toEqual([]);
  }, 15_000);
});
