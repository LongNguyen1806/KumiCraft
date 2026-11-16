// Test 7: readComponentProps (TS + PropTypes) and setProp safety/formatting (TK-49, TK-51).
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SetPropEditSchema } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { createNodeProcess } from '../../adapters/system/node-process.ts';
import { resolveRunnerScript } from '../../index.ts';
import { createSourceEditorService } from '../source-editor/source-editor-service.ts';
import { readComponentProps } from './component-props-reader.ts';

const req = createRequire(import.meta.url);

describe('Component Props & setProp [TK-49, TK-51, Test 7]', () => {
  let tmpRoot = '';
  const nodeFs = createNodeFileSystem('linux');
  const nodeProcess = createNodeProcess();

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(tmpdir(), 'kumicraft-comp-props-'));
    await fs.mkdir(path.join(tmpRoot, 'src/components'), { recursive: true });
    const tsPkg = path.dirname(req.resolve('typescript/package.json'));
    await fs.mkdir(path.join(tmpRoot, 'node_modules'), { recursive: true });
    await fs.symlink(tsPkg, path.join(tmpRoot, 'node_modules/typescript'), 'junction');
    await fs.writeFile(
      path.join(tmpRoot, 'package.json'),
      '{"name":"test","type":"module"}\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(tmpRoot, 'tsconfig.json'),
      '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","jsx":"react-jsx","strict":true},"include":["src"]}\n',
      'utf8',
    );
  });

  afterEach(async () => {
    if (tmpRoot.length > 0) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('reads typed props for TS component and JS PropTypes, edits string/number/boolean, removes false, and blocks dangerous/expr props', async () => {
    await fs.writeFile(
      path.join(tmpRoot, 'src/components/Badge.tsx'),
      "export type BadgeProps = {\n  tone?: 'primary' | 'muted';\n  count: number;\n  pill?: boolean;\n  disabled: boolean;\n  onClick?: () => void;\n};\nexport function Badge({ tone, count, pill, disabled }: BadgeProps) {\n  return <span className={tone} aria-disabled={disabled}>{count}{pill && <i />}</span>;\n}\n",
      'utf8',
    );
    const appPath = path.join(tmpRoot, 'src/App.tsx');
    await fs.writeFile(
      appPath,
      "import { Badge } from './components/Badge';\nexport function App({ n }: { n: number }) {\n  return <Badge count={n} disabled />;\n}\n",
      'utf8',
    );

    const script = resolveRunnerScript(undefined, 'ts-inspect');
    const propsRes = await readComponentProps(
      { fs: nodeFs, process: nodeProcess, tsInspectScript: script },
      tmpRoot,
      'src/App.tsx:3:10',
      'Badge',
    );
    expect(propsRes.ok).toBe(true);
    if (propsRes.ok) {
      expect(propsRes.value.sourceKind).toBe('typescript');
      expect(propsRes.value.props).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'tone',
            kind: 'union',
            options: ['primary', 'muted'],
            required: false,
          }),
          expect.objectContaining({
            name: 'count',
            kind: 'number',
            required: true,
            readonlyExpression: true,
          }),
          expect.objectContaining({ name: 'pill', kind: 'boolean', required: false }),
          expect.objectContaining({
            name: 'disabled',
            kind: 'boolean',
            required: true,
            value: true,
          }),
        ]),
      );
      // onClick is filtered out as blocked on* handler
      expect(propsRes.value.props.find((p) => p.name === 'onClick')).toBeUndefined();
    }

    // Check PropTypes fallback in JS file
    await fs.writeFile(
      path.join(tmpRoot, 'src/JsCard.jsx'),
      "export function JsCard({ size, compact }) { return <div className={size}>{compact && <b />}</div>; }\nJsCard.propTypes = { size: PropTypes.oneOf(['sm', 'lg']), compact: PropTypes.bool };\nexport function Demo() {\n  return <JsCard size=\"sm\" />;\n}\n",
      'utf8',
    );
    const jsProps = await readComponentProps(
      { fs: nodeFs },
      tmpRoot,
      'src/JsCard.jsx:4:10',
      'JsCard',
    );
    expect(jsProps.ok).toBe(true);
    if (jsProps.ok) {
      expect(jsProps.value.sourceKind).toBe('propTypes');
      expect(jsProps.value.props).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'size',
            kind: 'union',
            options: ['sm', 'lg'],
            value: 'sm',
          }),
          expect.objectContaining({ name: 'compact', kind: 'boolean' }),
        ]),
      );
    }

    const editor = createSourceEditorService({ fs: nodeFs });
    // Set union/string prop
    const r1 = await editor.applyEdit(tmpRoot, {
      kind: 'setProp',
      loc: 'src/App.tsx:3:10',
      tag: 'Badge',
      name: 'tone',
      value: 'primary',
    });
    expect(r1.ok).toBe(true);
    // Set optional boolean true -> shorthand pill
    const r2 = await editor.applyEdit(tmpRoot, {
      kind: 'setProp',
      loc: 'src/App.tsx:3:10',
      tag: 'Badge',
      name: 'pill',
      value: true,
    });
    expect(r2.ok).toBe(true);
    // Set optional boolean false -> removes pill
    const r3 = await editor.applyEdit(tmpRoot, {
      kind: 'setProp',
      loc: 'src/App.tsx:3:10',
      tag: 'Badge',
      name: 'pill',
      value: false,
    });
    expect(r3.ok).toBe(true);
    // Set required boolean false -> writes disabled={false}
    const r4 = await editor.applyEdit(tmpRoot, {
      kind: 'setProp',
      loc: 'src/App.tsx:3:10',
      tag: 'Badge',
      name: 'disabled',
      value: false,
      required: true,
    });
    expect(r4.ok).toBe(true);
    // Set numeric literal prop on JsCard
    const r5 = await editor.applyEdit(tmpRoot, {
      kind: 'setProp',
      loc: 'src/JsCard.jsx:4:10',
      tag: 'JsCard',
      name: 'tabCount',
      value: 3,
    });
    expect(r5.ok).toBe(true);

    const appText = await fs.readFile(appPath, 'utf8');
    expect(appText).toContain('tone="primary"');
    expect(appText).toContain('disabled={false}');
    expect(appText).not.toContain('pill');
    expect(await fs.readFile(path.join(tmpRoot, 'src/JsCard.jsx'), 'utf8')).toContain(
      'tabCount={3}',
    );

    // Reject non-constant expression `count={n}`
    const exprErr = await editor.applyEdit(tmpRoot, {
      kind: 'setProp',
      loc: 'src/App.tsx:3:10',
      tag: 'Badge',
      name: 'count',
      value: 5,
    });
    expect(exprErr.ok).toBe(false);

    // Block dangerous props both at schema and mutation layers (Test 7 + reverse-check!)
    for (const blocked of [
      'children',
      'key',
      'ref',
      'dangerouslySetInnerHTML',
      'onClick',
      'className',
      'style',
    ]) {
      expect(
        SetPropEditSchema.safeParse({
          kind: 'setProp',
          loc: 'src/App.tsx:3:10',
          tag: 'Badge',
          name: blocked,
          value: 'x',
        }).success,
      ).toBe(false);
      const mutErr = await editor.applyEdit(tmpRoot, {
        kind: 'setProp',
        loc: 'src/App.tsx:3:10',
        tag: 'Badge',
        name: blocked,
        value: 'x',
      });
      expect(mutErr.ok).toBe(false);
    }
  });
});
