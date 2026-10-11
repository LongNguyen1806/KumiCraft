// Spike VG-10: Tailwind runtime in iframe verification (ADR-FE-05)
// Run with: node scripts/vg/vg-10.mjs
/* global document, window, setTimeout */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { chromium } from '@playwright/test';

const TAILWIND_GLOBAL_SCRIPT = readFileSync(
  join('packages/studio', 'node_modules', '@tailwindcss', 'browser', 'dist', 'index.global.js'),
  'utf8',
);

async function initOfflinePage(browser) {
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage();

  let networkRequestsCount = 0;
  page.on('request', () => {
    networkRequestsCount += 1;
  });

  const baseHtml = [
    '<!DOCTYPE html>',
    '<html><head><style type="text/tailwindcss">',
    '  @theme { --color-brand: #ff0055; }',
    '</style></head><body><div id="canvas-root"></div></body></html>',
  ].join('\n');

  await page.setContent(baseHtml);
  await page.addScriptTag({ content: TAILWIND_GLOBAL_SCRIPT });
  await page.waitForTimeout(100);

  const isOfflineSafe = networkRequestsCount === 0;
  console.log(`  - Running in completely offline browser context: true`);
  console.log(`  - External network requests during init: ${networkRequestsCount}`);
  return { page, isOfflineSafe };
}

async function verifyArbitraryAndTheme(page) {
  console.log('\n[Part 2] Arbitrary Values & @theme Custom Tokens');
  await page.evaluate(() => {
    const root = document.getElementById('canvas-root');
    const el = document.createElement('div');
    el.id = 'arbitrary-test-node';
    el.className = 'p-[13px] bg-[#123456] text-brand';
    root?.appendChild(el);
  });

  await page.waitForTimeout(60);

  const styles = await page.evaluate(() => {
    const el = document.getElementById('arbitrary-test-node');
    if (el === undefined) return {};
    const cs = window.getComputedStyle(el);
    return { padding: cs.padding, bgColor: cs.backgroundColor, color: cs.color };
  });

  const paddingOk = styles.padding === '13px';
  const bgOk = styles.bgColor === 'rgb(18, 52, 86)';
  const themeOk = styles.color === 'rgb(255, 0, 85)';

  console.log(`  - Arbitrary padding (p-[13px]): ${paddingOk}`);
  console.log(`  - Arbitrary background (bg-[#123456]): ${bgOk}`);
  console.log(`  - @theme custom token (text-brand): ${themeOk}`);
  return paddingOk && bgOk && themeOk;
}

async function verifyStressAndLatency(page) {
  console.log('\n[Part 3] 500-Node Stress & Dynamic Class Update Latency');
  // First render 500 nodes and wait for initial compile
  await page.evaluate(() => {
    const root = document.getElementById('canvas-root');
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 500; i += 1) {
      const node = document.createElement('div');
      node.id = `node-${String(i)}`;
      node.className = 'flex items-center text-sm p-1 gap-2';
      node.textContent = `Item ${String(i)}`;
      fragment.appendChild(node);
    }
    root?.appendChild(fragment);
  });

  await page.waitForTimeout(100);

  // Now measure adding dynamic new class to existing node in 500-node canvas
  const updateLatency = await page.evaluate(async () => {
    const target = document.getElementById('node-250');
    if (target === undefined) return 999;
    const t0 = performance.now();
    target.classList.add('p-[29px]');

    while (performance.now() - t0 < 500) {
      const cs = window.getComputedStyle(target);
      if (cs.paddingTop === '29px') break;
      await new Promise((r) => {
        setTimeout(r, 2);
      });
    }
    return performance.now() - t0;
  });

  const checkValue = await page.evaluate(() => {
    const target = document.getElementById('node-250');
    return target === undefined ? '' : window.getComputedStyle(target).paddingTop;
  });

  const latencyOk = updateLatency <= 30 && checkValue === '29px';
  console.log(`  - 500 nodes rendered in Canvas`);
  console.log(`  - Target paddingTop after update: ${checkValue}`);
  console.log(
    `  - Dynamic new class update latency: ${updateLatency.toFixed(2)} ms (Budget <= 30 ms)`,
  );
  console.log(`  - Meets update latency budget: ${latencyOk}`);
  return { ok: latencyOk, updateLatency };
}

async function main() {
  console.log('=== Spike VG-10: Tailwind Runtime in iframe (ADR-FE-05) ===');
  const browser = await chromium.launch();
  try {
    const { page, isOfflineSafe } = await initOfflinePage(browser);
    const themeOk = await verifyArbitraryAndTheme(page);
    const stress = await verifyStressAndLatency(page);

    const allPassed = isOfflineSafe && themeOk && stress.ok;
    console.log(`\n=== Overall Result: ${allPassed ? 'PASSED (ĐẠT)' : 'FAILED (KHÔNG ĐẠT)'} ===`);
    if (!allPassed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
