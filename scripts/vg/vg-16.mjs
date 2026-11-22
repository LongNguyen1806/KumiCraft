// Spike VG-16: Reversible source code mutations & byte-exact format preservation (ADR-BE-29, ADR-BE-30, PB-03)
// Run with: node scripts/vg/vg-16.mjs
import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { createNodeFileSystem } from '../../packages/server/src/adapters/fs/node-file-system.ts';
import { createSourceEditorService } from '../../packages/server/src/stacks/view/jsx/source-editor-service.ts';

const SAMPLE_TEMPLATES = [
  // 1: standard 2-space tsx (div at 3:5)
  `export function Comp() {
  return (
    <div className="p-4 bg-white">
      <h1 className="text-xl font-bold">Tiêu đề mẫu</h1>
      <p className="text-gray-600">Nội dung đoạn văn</p>
    </div>
  );
}`,
  // 2: 4-space indentation (section at 3:9)
  `export function Comp() {
    return (
        <section className="container mx-auto">
            <span className="badge">Nhãn</span>
        </section>
    );
}`,
  // 3: tab indentation (main at 3:3)
  `export function Comp() {
	return (
		<main className="main-wrap">
			<button className="btn-primary">Bấm vào đây</button>
		</main>
	);
}`,
  // 4: multiline attributes (div at 3:5)
  `export function Comp() {
  return (
    <div
      id="main-card"
      className="rounded-lg shadow-md p-6"
      data-testid="card-element"
    >
      <h2 className="card-title">Tiêu đề thẻ</h2>
    </div>
  );
}`,
  // 5: self-closing tag with multiple classes (div at 3:5)
  `export function Comp() {
  return (
    <div className="flex items-center">
      <img className="h-10 w-10 rounded-full" src="/avatar.png" alt="Avatar" />
    </div>
  );
}`,
  // 6: single quotes (article at 3:5)
  `export function Comp() {
  return (
    <article className='prose max-w-none'>
      <h3 className='text-lg'>Tiêu đề bài viết</h3>
    </article>
  );
}`,
  // 7: html entities in text (p at 3:5)
  `export function Comp() {
  return (
    <p className="description">
      KumiCraft &amp; Vite 8 &lt;bản thử nghiệm&gt;
    </p>
  );
}`,
  // 8: nested JSX structure (div at 3:5)
  `export function Comp() {
  return (
    <div className="wrapper">
      <header className="header">
        <nav className="nav">
          <ul className="nav-list">
            <li className="nav-item">
              <a href="/home" className="nav-link font-medium">Trang chủ</a>
            </li>
          </ul>
        </nav>
      </header>
    </div>
  );
}`,
];

function generateCorpus(count = 40) {
  const corpus = [];
  for (let i = 0; i < count; i++) {
    const templateIndex = i % SAMPLE_TEMPLATES.length;
    const baseTemplate = SAMPLE_TEMPLATES[templateIndex];
    const isCrlf = i % 2 === 1;
    const hasBom = i % 4 === 3;
    const isJsx = i % 5 === 0;

    let content = baseTemplate.replace('Comp', `Comp${String(i)}`);
    if (isCrlf) content = content.replace(/\n/g, '\r\n');
    if (hasBom) content = '\uFEFF' + content;

    let defaultLoc = '3:5';
    if (templateIndex === 1) defaultLoc = '3:9';
    if (templateIndex === 2) defaultLoc = '3:3';

    corpus.push({
      fileName: `File${String(i)}.${isJsx ? 'jsx' : 'tsx'}`,
      content,
      isCrlf,
      hasBom,
      defaultLoc,
    });
  }
  return corpus;
}

async function testSingleFile(item, tmpDir, srcDir, editor, latencies) {
  const filePath = join(srcDir, item.fileName);
  const relPath = `src/${item.fileName}`;
  const originalBuffer = Buffer.from(item.content, 'utf8');
  writeFileSync(filePath, originalBuffer);

  const loc = `${relPath}:${item.defaultLoc}`;
  const readStart = performance.now();
  const sourceRes = await editor.getElement(tmpDir, loc);
  latencies.push(performance.now() - readStart);

  if (!sourceRes.ok) return false;
  const originalSource = sourceRes.value;
  const originalClass = originalSource.className?.value ?? '';

  const edit1Start = performance.now();
  const edit1 = await editor.applyEdit(tmpDir, {
    kind: 'setClassName',
    loc,
    tag: originalSource.tag,
    before: originalClass,
    after: originalClass ? `${originalClass} vg16-class` : 'vg16-class',
  });
  latencies.push(performance.now() - edit1Start);
  if (!edit1.ok) return false;

  const edit2Start = performance.now();
  const edit2 = await editor.applyEdit(tmpDir, {
    kind: 'setClassName',
    loc,
    tag: originalSource.tag,
    before: originalClass ? `${originalClass} vg16-class` : 'vg16-class',
    after: originalClass,
  });
  latencies.push(performance.now() - edit2Start);
  if (!edit2.ok) return false;

  const finalBuffer = readFileSync(filePath);
  return Buffer.compare(originalBuffer, finalBuffer) === 0;
}

async function run() {
  console.log('=== Spike VG-16: Reversible Source Mutations & Preservation ===\n');
  const tmpDir = mkdtempSync(join(tmpdir(), 'vg16-'));
  const srcDir = join(tmpDir, 'src');
  mkdirSync(srcDir, { recursive: true });

  const fs = createNodeFileSystem('win32');
  const editor = createSourceEditorService({ fs });
  const corpus = generateCorpus(40);
  console.log(
    `Generated corpus: ${String(corpus.length)} files (TSX/JSX, LF/CRLF, BOM, varied indentation).\n`,
  );

  let allReversible = true;
  const latencies = [];
  for (const item of corpus) {
    const passed = await testSingleFile(item, tmpDir, srcDir, editor, latencies);
    if (!passed) allReversible = false;
  }

  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const pb03Met = p95Latency <= 100;

  console.log(`Results:`);
  console.log(`  - 40/40 files tested`);
  console.log(`  - Byte-exact preservation (diff = 0): ${allReversible ? 'PASSED' : 'FAILED'}`);
  console.log(`  - Average edit latency: ${avgLatency.toFixed(2)} ms`);
  console.log(`  - P95 edit latency: ${p95Latency.toFixed(2)} ms (PB-03 budget <= 100 ms)`);
  console.log(`  - PB-03 budget met: ${pb03Met ? 'YES' : 'NO'}\n`);

  rmSync(tmpDir, { recursive: true, force: true });
  if (!allReversible || !pb03Met) process.exit(1);
  console.log('Spike VG-16 PASSED successfully.\n');
}

void run();
