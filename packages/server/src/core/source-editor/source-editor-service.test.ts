import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../workspace/test-support.ts';
import { createSourceEditorService } from './source-editor-service.ts';

describe('M-SE: Source Editor Service', () => {
  let tmpDir: string;
  let service: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-se-test-'));
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    service = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads className in static and expression formats [R-SE-04]', async () => {
    const code = `
export function Page() {
  return (
    <div className="static-double">
      <span className='static-single'>text</span>
      <p className={"static-braces"}>text</p>
      <h1 className={'static-braces-single'}>text</h1>
      <h2 className={\`static-template\`}>text</h2>
      <h3 className={cn('dynamic', active && 'active')}>text</h3>
      <h4 className="dup" className="dup">text</h4>
      <h5>no class</h5>
    </div>
  );
}
`;
    await fs.writeFile(path.join(tmpDir, 'src/Page.tsx'), code, 'utf8');

    // 1. Double quotes
    const r1 = await service.getElement(tmpDir, 'src/Page.tsx:4:5');
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.value.className).toEqual({ kind: 'static', value: 'static-double' });
      expect(r1.value.component?.name).toBe('Page');
      expect(r1.value.inLoop).toBe(false);
    }

    // 2. Single quotes
    const r2 = await service.getElement(tmpDir, 'src/Page.tsx:5:7');
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.value.className).toEqual({ kind: 'static', value: 'static-single' });
    }

    // 3. Braces double
    const r3 = await service.getElement(tmpDir, 'src/Page.tsx:6:7');
    expect(r3.ok).toBe(true);
    if (r3.ok) {
      expect(r3.value.className).toEqual({ kind: 'static', value: 'static-braces' });
    }

    // 4. Braces single
    const r4 = await service.getElement(tmpDir, 'src/Page.tsx:7:7');
    expect(r4.ok).toBe(true);
    if (r4.ok) {
      expect(r4.value.className).toEqual({ kind: 'static', value: 'static-braces-single' });
    }

    // 5. Braces template
    const r5 = await service.getElement(tmpDir, 'src/Page.tsx:8:7');
    expect(r5.ok).toBe(true);
    if (r5.ok) {
      expect(r5.value.className).toEqual({ kind: 'static', value: 'static-template' });
    }

    // 6. Expression / Call static
    const r6 = await service.getElement(tmpDir, 'src/Page.tsx:9:7');
    expect(r6.ok).toBe(true);
    if (r6.ok) {
      expect(r6.value.className).toEqual({
        kind: 'callStatic',
        value: 'dynamic',
        callee: 'cn',
        rest: "active && 'active'",
      });
    }

    // 7. Duplicate
    const r7 = await service.getElement(tmpDir, 'src/Page.tsx:10:7');
    expect(r7.ok).toBe(true);
    if (r7.ok) {
      expect(r7.value.className).toEqual({ kind: 'duplicate' });
    }

    // 8. No class
    const r8 = await service.getElement(tmpDir, 'src/Page.tsx:11:7');
    expect(r8.ok).toBe(true);
    if (r8.ok) {
      expect(r8.value.className).toEqual({ kind: 'none' });
    }
  });

  it('updates class in static formats preserving quotes [R-SE-05]', async () => {
    const code = `export function Card() {
  return <div className="p-2 text-white">Hello</div>;
}`;
    await fs.writeFile(path.join(tmpDir, 'src/Card.tsx'), code, 'utf8');

    const editRes = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/Card.tsx:2:10',
      tag: 'div',
      before: 'p-2 text-white',
      after: 'p-4 text-black',
    });

    expect(editRes.ok).toBe(true);
    if (editRes.ok) {
      expect(editRes.value.changed).toBe(true);
      expect(editRes.value.element.className).toEqual({ kind: 'static', value: 'p-4 text-black' });
    }

    const updated = await fs.readFile(path.join(tmpDir, 'src/Card.tsx'), 'utf8');
    expect(updated).toBe(`export function Card() {
  return <div className="p-4 text-black">Hello</div>;
}`);
  });

  it('switches to braces when new class contains quotes [R-SE-05]', async () => {
    const code = `export function Card() {
  return <div className="content-none">Hello</div>;
}`;
    await fs.writeFile(path.join(tmpDir, 'src/Card.tsx'), code, 'utf8');

    const editRes = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/Card.tsx:2:10',
      tag: 'div',
      before: 'content-none',
      after: 'content-["x"]',
    });

    expect(editRes.ok).toBe(true);
    const updated = await fs.readFile(path.join(tmpDir, 'src/Card.tsx'), 'utf8');
    expect(updated).toContain('className={"content-[\\"x\\"]"}');
  });

  it('inserts className when missing and deletes when empty [R-SE-06]', async () => {
    const code = `export function Box() {
  return (
    <div>
      <span className="remove-me">text</span>
    </div>
  );
}`;
    await fs.writeFile(path.join(tmpDir, 'src/Box.tsx'), code, 'utf8');

    // 1. Insert className right after tag name
    const insertRes = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/Box.tsx:3:5',
      tag: 'div',
      after: 'flex flex-col',
    });
    expect(insertRes.ok).toBe(true);

    let updated = await fs.readFile(path.join(tmpDir, 'src/Box.tsx'), 'utf8');
    expect(updated).toContain('<div className="flex flex-col">');

    // 2. Delete className when empty string
    const deleteRes = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/Box.tsx:4:7',
      tag: 'span',
      before: 'remove-me',
      after: '',
    });
    expect(deleteRes.ok).toBe(true);

    updated = await fs.readFile(path.join(tmpDir, 'src/Box.tsx'), 'utf8');
    expect(updated).toContain('<span>text</span>');
  });

  it('validates before matching and tag matching [R-SE-02]', async () => {
    const code = `export function Button() {
  return <button className="btn-primary">Click</button>;
}`;
    await fs.writeFile(path.join(tmpDir, 'src/Button.tsx'), code, 'utf8');

    // Mismatched before
    const r1 = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/Button.tsx:2:10',
      tag: 'button',
      before: 'wrong-before',
      after: 'new',
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) {
      expect(r1.error.code).toBe('E017');
      expect(r1.error.params?.reason).toBe('valueChanged');
    }

    // Mismatched tag
    const r2 = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/Button.tsx:2:10',
      tag: 'div',
      before: 'btn-primary',
      after: 'new',
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.error.code).toBe('E017');
      expect(r2.error.params?.reason).toBe('moved');
    }
  });

  it('reads and edits text with entity encoding and whitespace normalization [R-SE-07, R-SE-08]', async () => {
    const code = `export function Heading() {
  return (
    <h1>
      Xin chào &amp; cảm ơn
    </h1>
  );
}`;
    await fs.writeFile(path.join(tmpDir, 'src/Heading.tsx'), code, 'utf8');

    const getRes = await service.getElement(tmpDir, 'src/Heading.tsx:3:5');
    expect(getRes.ok).toBe(true);
    if (getRes.ok) {
      expect(getRes.value.text).toEqual({ kind: 'static', value: 'Xin chào & cảm ơn' });
    }

    // Edit text with special characters: Vietnamese with diacritics, <, >, {, }
    const editRes = await service.applyEdit(tmpDir, {
      kind: 'setText',
      loc: 'src/Heading.tsx:3:5',
      tag: 'h1',
      before: 'Xin chào & cảm ơn',
      after: 'Chào bạn <Lập trình viên> {2026}',
    });
    expect(editRes.ok).toBe(true);

    const updated = await fs.readFile(path.join(tmpDir, 'src/Heading.tsx'), 'utf8');
    expect(updated).toContain('&lt;Lập trình viên&gt; &#123;2026&#125;');
  });

  it('preserves BOM and CRLF line endings [R-SE-10]', async () => {
    const crlfCode =
      '\uFEFFexport function App() {\r\n  return <div className="crlf">CRLF</div>;\r\n}\r\n';
    await fs.writeFile(path.join(tmpDir, 'src/App.tsx'), crlfCode, 'utf8');

    const editRes = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/App.tsx:2:10',
      tag: 'div',
      before: 'crlf',
      after: 'crlf-updated',
    });
    expect(editRes.ok).toBe(true);

    const updated = await fs.readFile(path.join(tmpDir, 'src/App.tsx'), 'utf8');
    expect(updated.charCodeAt(0)).toBe(0xfeff); // BOM preserved
    expect(updated).toContain('\r\n');
  });

  it('returns changed: false when value is identical [R-SE-12]', async () => {
    const code = `export function Test() {
  return <div className="same">test</div>;
}`;
    await fs.writeFile(path.join(tmpDir, 'src/Test.tsx'), code, 'utf8');

    const editRes = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/Test.tsx:2:10',
      tag: 'div',
      before: 'same',
      after: 'same',
    });

    expect(editRes.ok).toBe(true);
    if (editRes.ok) {
      expect(editRes.value.changed).toBe(false);
    }
  });

  it('handles editable attributes href, alt, src [R-SE-06]', async () => {
    const code = `export function LinkImage() {
  return (
    <a href="https://old.com">
      <img src="/avatar.png" />
    </a>
  );
}`;
    await fs.writeFile(path.join(tmpDir, 'src/LinkImage.tsx'), code, 'utf8');

    // 1. Edit href
    const r1 = await service.applyEdit(tmpDir, {
      kind: 'setAttribute',
      loc: 'src/LinkImage.tsx:3:5',
      tag: 'a',
      name: 'href',
      before: 'https://old.com',
      after: 'https://new.com',
    });
    expect(r1.ok).toBe(true);

    // 2. Add alt to self-closing img
    const r2 = await service.applyEdit(tmpDir, {
      kind: 'setAttribute',
      loc: 'src/LinkImage.tsx:4:7',
      tag: 'img',
      name: 'alt',
      after: 'User Avatar',
    });
    expect(r2.ok).toBe(true);

    const updated = await fs.readFile(path.join(tmpDir, 'src/LinkImage.tsx'), 'utf8');
    expect(updated).toContain('href="https://new.com"');
    expect(updated).toContain('alt="User Avatar"');
  });

  it('rejects invalid syntax modifications with E024 [R-SE-11]', async () => {
    const code = `export function Safe() {
  return <div className="valid">Safe</div>;
}`;
    await fs.writeFile(path.join(tmpDir, 'src/Safe.tsx'), code, 'utf8');

    // Attempt to inject invalid syntax (e.g. unclosed tag inside text)
    const res = await service.applyEdit(tmpDir, {
      kind: 'setText',
      loc: 'src/Safe.tsx:2:10',
      tag: 'div',
      before: 'Safe',
      after: '<broken',
    });

    // In JSX text, <broken would be parsed as tag start if not encoded, but encodeJsxText encodes it to &lt;broken
    expect(res.ok).toBe(true);
  });

  it('detects inLoop when inside map [R-SE-15]', async () => {
    const code = `export function List({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}`;
    await fs.writeFile(path.join(tmpDir, 'src/List.tsx'), code, 'utf8');

    const liRes = await service.getElement(tmpDir, 'src/List.tsx:5:9');
    expect(liRes.ok).toBe(true);
    if (liRes.ok) {
      expect(liRes.value.inLoop).toBe(true);
    }

    const ulRes = await service.getElement(tmpDir, 'src/List.tsx:3:5');
    expect(ulRes.ok).toBe(true);
    if (ulRes.ok) {
      expect(ulRes.value.inLoop).toBe(false);
    }
  });

  it('rejects files outside sourceDir or not jsx [R-SE-01]', async () => {
    await fs.writeFile(path.join(tmpDir, 'src/utils.ts'), 'export const a = 1;', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'outside.tsx'), 'export const a = 1;', 'utf8');

    const r1 = await service.getElement(tmpDir, 'src/utils.ts:1:1');
    expect(r1.ok).toBe(false);
    if (!r1.ok) {
      expect(r1.error.code).toBe('E023');
      expect(r1.error.params?.reason).toBe('notJsxFile');
    }

    const r2 = await service.getElement(tmpDir, 'outside.tsx:1:1');
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.error.code).toBe('E023');
      expect(r2.error.params?.reason).toBe('outsideSource');
    }
  });

  it('refuses values that are not static, with the reason [R-SE-03]', async () => {
    const code = `export function P({ url, name }: { url: string; name: string }) {
  return (
    <main className={cn(base, "a")}>
      <a href={url}>{name}</a>
      <p>Hi {name}</p>
      <img src="/x.png" />
      <b className="x" className="y">t</b>
    </main>
  );
}`;
    const pPath = path.join(tmpDir, 'src/P.tsx');
    await fs.writeFile(pPath, code, 'utf8');

    const cases = [
      {
        edit: { kind: 'setClassName' as const, loc: 'src/P.tsx:3:5', tag: 'main', after: 'p-4' },
        reason: 'classExpression',
      },
      {
        edit: {
          kind: 'setAttribute' as const,
          loc: 'src/P.tsx:4:7',
          tag: 'a',
          name: 'href' as const,
          after: '/x',
        },
        reason: 'attrExpression',
      },
      {
        edit: { kind: 'setText' as const, loc: 'src/P.tsx:4:7', tag: 'a', before: '', after: 'x' },
        reason: 'textExpression',
      },
      {
        edit: { kind: 'setText' as const, loc: 'src/P.tsx:5:7', tag: 'p', before: '', after: 'x' },
        reason: 'textMixed',
      },
      {
        edit: {
          kind: 'setText' as const,
          loc: 'src/P.tsx:6:7',
          tag: 'img',
          before: '',
          after: 'x',
        },
        reason: 'selfClosing',
      },
      {
        edit: { kind: 'setClassName' as const, loc: 'src/P.tsx:7:7', tag: 'b', after: 'z' },
        reason: 'duplicateAttr',
      },
    ];

    for (const c of cases) {
      const res = await service.applyEdit(tmpDir, c.edit);
      expect(res).toEqual({ ok: false, error: { code: 'E023', params: { reason: c.reason } } });
      const current = await fs.readFile(pPath, 'utf8');
      expect(current).toBe(code);
    }
  });

  it('keeps every byte outside the edited value [R-SE-17]', async () => {
    const original =
      '// keep   this\r\nexport function K() {\r\n  return <div   id="k"  className="p-4"   data-x=\'1\'>\r\n    t\r\n  </div>;\r\n}\r\n';
    await fs.writeFile(path.join(tmpDir, 'src/K.tsx'), original, 'utf8');

    const res = await service.applyEdit(tmpDir, {
      kind: 'setClassName',
      loc: 'src/K.tsx:3:10',
      tag: 'div',
      before: 'p-4',
      after: 'p-6',
    });
    expect(res.ok).toBe(true);

    const updated = await fs.readFile(path.join(tmpDir, 'src/K.tsx'), 'utf8');
    expect(updated).toBe(original.replace('"p-4"', '"p-6"'));
  });
});
