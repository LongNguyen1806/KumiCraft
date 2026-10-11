// Spike VG-09A: Compare Tailwind browser runtime vs statically compiled CSS (ADR-FE-04, ADR-FE-05)
// Run with: node scripts/vg/vg-09a.mjs
/* global Image, document */
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

const twDir = join(process.cwd(), 'packages', 'studio', 'node_modules', 'tailwindcss');

const { compile } = await import(pathToFileURL(join(twDir, 'dist', 'lib.mjs')).href);

const TAILWIND_GLOBAL_SCRIPT = readFileSync(
  join('packages/studio', 'node_modules', '@tailwindcss', 'browser', 'dist', 'index.global.js'),
  'utf8',
);

async function loadStylesheet(id, base) {
  if (id === 'tailwindcss' || id === 'tailwindcss/index.css') {
    return {
      content: readFileSync(join(twDir, 'index.css'), 'utf8'),
      base: twDir,
    };
  }
  if (id.startsWith('tailwindcss/')) {
    const sub = id.replace('tailwindcss/', '');
    return {
      content: readFileSync(join(twDir, sub), 'utf8'),
      base: twDir,
    };
  }
  const resolved = isAbsolute(id) ? id : resolve(base, id);
  return {
    content: readFileSync(resolved, 'utf8'),
    base: dirname(resolved),
  };
}

const TEST_CLASSES = [
  'flex',
  'flex-col',
  'items-center',
  'justify-between',
  'gap-4',
  'p-6',
  'bg-slate-50',
  'text-slate-900',
  'font-sans',
  'grid',
  'grid-cols-1',
  'md:grid-cols-3',
  'w-full',
  'max-w-4xl',
  'rounded-2xl',
  'shadow-lg',
  'border',
  'border-slate-200',
  'bg-white',
  'text-xl',
  'font-bold',
  'text-indigo-600',
  'text-sm',
  'text-slate-600',
  'px-4',
  'py-2',
  'rounded-lg',
  'bg-indigo-600',
  'text-white',
  'hover:bg-indigo-700',
  'p-[13px]',
  'bg-[#123456]',
  'mt-2',
  'pb-4',
  'border-b',
  'min-h-screen',
  'text-lg',
  'text-slate-200',
];

const COMPONENT_HTML = `
<div class="flex flex-col items-center gap-4 p-6 bg-slate-50 text-slate-900 font-sans min-h-screen">
  <header class="w-full max-w-4xl flex items-center justify-between border-b border-slate-200 pb-4">
    <h1 class="text-xl font-bold text-indigo-600">ReactCraft Studio Layout</h1>
    <button class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Action</button>
  </header>
  <main class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="p-6 bg-white rounded-2xl shadow-lg border border-slate-200">
      <h2 class="font-bold text-lg">Card 1</h2>
      <p class="text-sm text-slate-600 mt-2">Card description content for visual parity testing.</p>
    </div>
    <div class="p-6 bg-white rounded-2xl shadow-lg border border-slate-200">
      <h2 class="font-bold text-lg">Card 2</h2>
      <p class="text-sm text-slate-600 mt-2">Responsive grid item with standard padding and borders.</p>
    </div>
    <div class="p-[13px] bg-[#123456] text-white rounded-2xl shadow-lg">
      <h2 class="font-bold text-lg">Arbitrary Card</h2>
      <p class="text-sm text-slate-200 mt-2">Arbitrary class styling rendered in runtime and build.</p>
    </div>
  </main>
</div>
`;

async function computePixelDiff(page, screenshotA, screenshotB, viewport) {
  return page.evaluate(
    async ({ b64A, b64B, width, height }) => {
      const loadImg = (b64) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => res(img);
          img.src = `data:image/png;base64,${b64}`;
        });

      const [imgA, imgB] = await Promise.all([loadImg(b64A), loadImg(b64B)]);
      const canvasA = document.createElement('canvas');
      canvasA.width = width;
      canvasA.height = height;
      const ctxA = canvasA.getContext('2d');
      ctxA.drawImage(imgA, 0, 0);
      const dataA = ctxA.getImageData(0, 0, width, height).data;

      const canvasB = document.createElement('canvas');
      canvasB.width = width;
      canvasB.height = height;
      const ctxB = canvasB.getContext('2d');
      ctxB.drawImage(imgB, 0, 0);
      const dataB = ctxB.getImageData(0, 0, width, height).data;

      let diffPixels = 0;
      const totalPixels = width * height;
      for (let i = 0; i < dataA.length; i += 4) {
        const dr = Math.abs(dataA[i] - dataB[i]);
        const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
        const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
        const da = Math.abs(dataA[i + 3] - dataB[i + 3]);
        // Difference threshold per RGBA channel sum > 15
        if (dr + dg + db + da > 15) {
          diffPixels += 1;
        }
      }
      return {
        diffPercent: (diffPixels / totalPixels) * 100,
        diffPixels,
        totalPixels,
      };
    },
    {
      b64A: screenshotA.toString('base64'),
      b64B: screenshotB.toString('base64'),
      width: viewport.width,
      height: viewport.height,
    },
  );
}

async function runViewportTest(browser, compiledCss, viewport) {
  const pageA = await browser.newPage({ viewport });
  const htmlStatic = `<!DOCTYPE html><html><head><style>${compiledCss}</style></head><body style="margin:0">${COMPONENT_HTML}</body></html>`;
  await pageA.setContent(htmlStatic);
  await pageA.waitForTimeout(100);
  const screenshotA = await pageA.screenshot({ fullPage: false });

  const pageB = await browser.newPage({ viewport });
  const htmlRuntime = `<!DOCTYPE html><html><head></head><body style="margin:0">${COMPONENT_HTML}</body></html>`;
  await pageB.setContent(htmlRuntime);
  await pageB.addScriptTag({ content: TAILWIND_GLOBAL_SCRIPT });
  await pageB.waitForTimeout(300);
  const screenshotB = await pageB.screenshot({ fullPage: false });
  await pageB.close();

  const diffResult = await computePixelDiff(pageA, screenshotA, screenshotB, viewport);
  await pageA.close();

  const ok = diffResult.diffPercent <= 1.0;
  console.log(
    `  - Viewport ${String(viewport.width)}x${String(viewport.height)}: Pixel diff = ${diffResult.diffPercent.toFixed(4)}% (${String(diffResult.diffPixels)}/${String(diffResult.totalPixels)} px, Threshold <= 1.0%): ${ok ? 'PASSED' : 'FAILED'}`,
  );
  return { ok, ...diffResult, width: viewport.width, height: viewport.height };
}

async function main() {
  console.log('=== Spike VG-09 (Phase 0 Phase A): Tailwind Browser vs Static Build Parity ===');
  console.log('Compiling static Tailwind v4 CSS via tailwindcss engine...');
  const compiler = await compile('@import "tailwindcss";', {
    base: twDir,
    loadStylesheet,
  });
  const compiledCss = compiler.build(TEST_CLASSES);

  console.log(`Static CSS compiled: ${(compiledCss.length / 1024).toFixed(1)} KB`);

  const browser = await chromium.launch();
  const viewports = [
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ];

  const results = [];
  try {
    for (const vp of viewports) {
      results.push(await runViewportTest(browser, compiledCss, vp));
    }
  } finally {
    await browser.close();
  }

  const allPassed = results.every((r) => r.ok);
  console.log(`\n=== Overall Result: ${allPassed ? 'PASSED (ĐẠT)' : 'FAILED (KHÔNG ĐẠT)'} ===`);
  if (!allPassed) process.exitCode = 1;
}

await main();
