// Unit tests for transformJsx (SPEC-04 M-BR section 4 required tests).
import { describe, expect, it } from 'vitest';

import { shouldTransform, transformJsx } from './transform-jsx.ts';

const rootDir = 'D:/project';
const sourceDir = 'src';
const defaultOptions = { rootDir, sourceDir };

describe('shouldTransform', () => {
  it('accepts files inside sourceDir with valid extensions [R-BR-01]', () => {
    expect(shouldTransform('D:/project/src/App.tsx', defaultOptions)).toBe(true);
    expect(shouldTransform('D:/project/src/components/Button.jsx', defaultOptions)).toBe(true);
    expect(shouldTransform('D:/project/src/main.ts', defaultOptions)).toBe(true);
  });

  it('rejects virtual ids, queries, node_modules, and files outside sourceDir [R-BR-01]', () => {
    expect(shouldTransform('\0virtual:module', defaultOptions)).toBe(false);
    expect(shouldTransform('D:/project/src/App.tsx?raw', defaultOptions)).toBe(false);
    expect(shouldTransform('D:/project/node_modules/pkg/index.jsx', defaultOptions)).toBe(false);
    expect(shouldTransform('D:/project/src/types.d.ts', defaultOptions)).toBe(false);
    expect(shouldTransform('D:/project/scripts/run.ts', defaultOptions)).toBe(false);
    expect(shouldTransform('D:/other/src/App.tsx', defaultOptions)).toBe(false);
  });
});

describe('transformJsx', () => {
  it('attaches data-rc-loc to standard and self-closing lowercase HTML tags [R-BR-02]', () => {
    const code = 'export function App() { return <div><img src="pic.png" /></div>; }';
    const res = transformJsx(code, 'D:/project/src/App.tsx', defaultOptions);
    expect(res).toBeDefined();
    expect(res?.code).toContain('data-rc-loc="src/App.tsx:1:32"');
    expect(res?.code).toContain('data-rc-loc="src/App.tsx:1:37"');
  });

  it('attaches data-rc-loc to SVG elements [R-BR-02]', () => {
    const code = '<svg viewBox="0 0 10 10"><path d="M0 0" /></svg>';
    const res = transformJsx(code, 'D:/project/src/Icon.tsx', defaultOptions);
    expect(res).toBeDefined();
    expect(res?.code).toContain('<svg data-rc-loc="src/Icon.tsx:1:1"');
    expect(res?.code).toContain('<path data-rc-loc="src/Icon.tsx:1:26"');
  });

  it('skips Fragments, uppercase components, dotted names, namespaced tags and existing loc [R-BR-02]', () => {
    const code = `
      export function Page() {
        return (
          <>
            <Card>
              <motion.div>
                <svg:rect />
                <div data-rc-loc="src/Custom.tsx:1:1">Already</div>
                <span>New</span>
              </motion.div>
            </Card>
          </>
        );
      }
    `;
    const res = transformJsx(code, 'D:/project/src/Page.tsx', defaultOptions);
    expect(res).toBeDefined();
    expect(res?.code).not.toContain('<Card data-rc-loc');
    expect(res?.code).not.toContain('<motion.div data-rc-loc');
    expect(res?.code).not.toContain('<svg:rect data-rc-loc');
    expect(res?.code).not.toContain('data-rc-loc="src/Page.tsx:8:17"');
    expect(res?.code).toContain('<span data-rc-loc="src/Page.tsx:9:17"');
  });

  it('attaches data-rc-loc inside array maps [R-BR-02]', () => {
    const code = 'const list = items.map((item) => <li key={item}>{item}</li>);';
    const res = transformJsx(code, 'D:/project/src/List.tsx', defaultOptions);
    expect(res).toBeDefined();
    expect(res?.code).toContain('<li data-rc-loc="src/List.tsx:1:34"');
  });

  it('preserves line and column with Windows CRLF [V-102]', () => {
    const code = 'const x = 1;\r\nconst y = 2;\r\n<div>OK</div>';
    const res = transformJsx(code, 'D:/project/src/Crlf.tsx', defaultOptions);
    expect(res).toBeDefined();
    expect(res?.code).toContain('<div data-rc-loc="src/Crlf.tsx:3:1">OK</div>');
  });

  it('does not count BOM in column index on line 1 [V-102]', () => {
    const code = '\uFEFF<div>With BOM</div>';
    const res = transformJsx(code, 'D:/project/src/Bom.tsx', defaultOptions);
    expect(res).toBeDefined();
    expect(res?.code).toContain('<div data-rc-loc="src/Bom.tsx:1:1">');
  });

  it('calculates UTF-16 code unit column with Vietnamese characters [V-102]', () => {
    const code = 'const tiêuĐề = "Xin chào";\r\n<span>Nội dung</span>';
    const res = transformJsx(code, 'D:/project/src/Viet.tsx', defaultOptions);
    expect(res).toBeDefined();
    expect(res?.code).toContain('<span data-rc-loc="src/Viet.tsx:2:1">');
  });

  it('returns undefined on syntax errors per R-BR-03', () => {
    const brokenCode = 'export function Broken() { return <div className=; }';
    const res = transformJsx(brokenCode, 'D:/project/src/Broken.tsx', defaultOptions);
    expect(res).toBeUndefined();
  });

  it('generates high-resolution source map [R-BR-03]', () => {
    const code = '<div><span>Hello</span></div>';
    const res = transformJsx(code, 'D:/project/src/MapTest.tsx', defaultOptions);
    expect(res).toBeDefined();
    expect(res?.map).toBeDefined();
  });
});
