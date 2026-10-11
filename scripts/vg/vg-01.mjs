// Spike VG-01: Windows NTFS atomic write & transaction verification (ADR-BE-18)
// Run with: node scripts/vg/vg-01.mjs
import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { clearTimeout, setTimeout } from 'node:timers';

import writeFileAtomic from 'write-file-atomic';

const RETRY_DELAYS = [0, 25, 50, 100, 200];
const RETRYABLE_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const sha256 = (val) => createHash('sha256').update(val).digest('hex');

/** ADR-BE-18 atomic write wrapper with progressive backoff for Windows. */
async function atomicWrite(targetPath, data, options = {}) {
  const delays = options.delays ?? RETRY_DELAYS;
  let lastError;
  mkdirSync(dirname(targetPath), { recursive: true });

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      await writeFileAtomic(targetPath, data, options);
      return { ok: true, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;
      const isRetryable =
        err && typeof err === 'object' && 'code' in err && RETRYABLE_CODES.has(err.code);
      if (isRetryable && attempt < delays.length - 1) continue;
      break;
    }
  }
  return { ok: false, attempts: delays.length, error: lastError };
}

/** Rollback helper: restores modified files and purges newly created files. */
async function rollbackTransaction(snapshots, newlyCreated, actuallyModified) {
  const restored = [];
  const removed = [];
  const errors = [];

  for (const createdPath of newlyCreated) {
    if (existsSync(createdPath)) {
      try {
        unlinkSync(createdPath);
        removed.push(createdPath);
      } catch (err) {
        errors.push({ path: createdPath, action: 'unlink', error: err });
      }
    }
  }

  for (const modifiedPath of actuallyModified) {
    if (snapshots.has(modifiedPath)) {
      try {
        const res = await atomicWrite(modifiedPath, snapshots.get(modifiedPath));
        if (res.ok) restored.push(modifiedPath);
        else errors.push({ path: modifiedPath, action: 'restore', error: res.error });
      } catch (err) {
        errors.push({ path: modifiedPath, action: 'restore', error: err });
      }
    }
  }

  return {
    ok: errors.length === 0,
    restoredCount: restored.length,
    removedCount: removed.length,
    errors,
  };
}

/** ADR-BE-18 Export Transaction with snapshot & precise rollback. */
async function executeExportTransaction(files, options = {}) {
  const { injectFaultAtIndex } = options;
  const snapshots = new Map();
  const createdBeforeTx = new Set();
  const newlyCreated = [];
  const actuallyModified = [];

  for (const file of files) {
    if (existsSync(file.path)) {
      snapshots.set(file.path, readFileSync(file.path));
      createdBeforeTx.add(file.path);
    }
  }

  for (let i = 0; i < files.length; i += 1) {
    if (injectFaultAtIndex !== undefined && i === injectFaultAtIndex) {
      const err = new Error(`Simulated fault at index ${i}`);
      const rollback = await rollbackTransaction(snapshots, newlyCreated, actuallyModified);
      return { ok: false, faultAtIndex: i, error: err, rollback };
    }

    const file = files[i];
    const isNew = !createdBeforeTx.has(file.path);
    const writeRes = await atomicWrite(file.path, file.content);

    if (!writeRes.ok) {
      const rollback = await rollbackTransaction(snapshots, newlyCreated, actuallyModified);
      return { ok: false, faultAtIndex: i, error: writeRes.error, rollback };
    }

    if (isNew) newlyCreated.push(file.path);
    else actuallyModified.push(file.path);
  }

  return { ok: true, writtenCount: files.length, rollback: undefined };
}

function countTempFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.includes('.tmp') || /\.[0-9]{6,}$/.test(f)).length;
}

// ---------------------------------------------------------
// Scenarios
// ---------------------------------------------------------

async function runScenario1(baseDir) {
  console.log('\n[Scenario 1] Baseline Stress: 100 sequential atomic writes');
  const targetFile = join(baseDir, 's1', 'target.json');
  const latencies = [];
  let lastHash = '';

  for (let i = 1; i <= 100; i += 1) {
    const payload = JSON.stringify({
      i,
      t: Date.now(),
      d: randomBytes(64 + (i % 200)).toString('hex'),
    });
    lastHash = sha256(payload);
    const start = performance.now();
    const res = await atomicWrite(targetFile, payload);
    latencies.push(performance.now() - start);
    if (!res.ok) throw new Error(`S1 failed at ${i}: ${res.error?.message}`);
  }

  const finalHash = sha256(readFileSync(targetFile, 'utf8'));
  const tempCount = countTempFiles(dirname(targetFile));
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const ok = finalHash === lastHash && tempCount === 0;

  console.log(`  - 100/100 writes succeeded, final hash match: ${ok}, temp files: ${tempCount}`);
  console.log(`  - Latency: p50 = ${p50.toFixed(2)}ms, p95 = ${p95.toFixed(2)}ms`);
  return { ok, p50, p95 };
}

async function runScenario2(baseDir) {
  console.log('\n[Scenario 2] Active Lock Contention: Simulating Defender / VS Code handle hold');
  const target = join(baseDir, 's2', 'locked.txt');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, 'initial', 'utf8');

  const fdA = openSync(target, 'r');
  let rawBlocked = false;
  try {
    await writeFileAtomic(target, 'update');
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EPERM') rawBlocked = true;
  } finally {
    closeSync(fdA);
  }

  const fdB = openSync(target, 'r');
  const timer = setTimeout(() => {
    closeSync(fdB);
  }, 60);

  const start = performance.now();
  const retryRes = await atomicWrite(target, 'recovered-content');
  const duration = performance.now() - start;
  clearTimeout(timer);

  const content = readFileSync(target, 'utf8');
  const ok = rawBlocked && retryRes.ok && retryRes.attempts > 1 && content === 'recovered-content';
  console.log(
    `  - Raw blocked: ${rawBlocked}, Recovered: ${retryRes.ok} (attempts: ${retryRes.attempts}, ${duration.toFixed(2)}ms)`,
  );
  return { ok, attempts: retryRes.attempts, duration };
}

async function runScenario3(baseDir) {
  console.log('\n[Scenario 3] Permanent Lock Contention: Timeout & Corruption Protection');
  const target = join(baseDir, 's3', 'perm.txt');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, 'pristine', 'utf8');

  const fd = openSync(target, 'r');
  let res;
  try {
    res = await atomicWrite(target, 'corrupt-attempt');
  } finally {
    closeSync(fd);
  }

  const ok =
    !res.ok && readFileSync(target, 'utf8') === 'pristine' && countTempFiles(dirname(target)) === 0;
  console.log(
    `  - Timed out: ${!res.ok}, File intact: ${ok}, Clean temp: ${countTempFiles(dirname(target)) === 0}`,
  );
  return { ok };
}

async function runScenario4(baseDir) {
  console.log('\n[Scenario 4] Concurrent Competing Writers: Stressing parallel swaps');
  const target = join(baseDir, 's4', 'concurrent.txt');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, 'initial', 'utf8');

  const promises = [];
  for (let w = 0; w < 10; w += 1) {
    promises.push(atomicWrite(target, `WRITER-${w}-${randomBytes(64).toString('hex')}`));
  }

  const results = await Promise.all(promises);
  const successCount = results.filter((r) => r.ok).length;
  const content = readFileSync(target, 'utf8');
  const ok =
    successCount === 10 &&
    /^WRITER-\d+-[0-9a-f]{128}$/.test(content) &&
    countTempFiles(dirname(target)) === 0;
  console.log(
    `  - 10/10 parallel writes completed: ${successCount === 10}, Final content atomic: ${ok}`,
  );
  return { ok };
}

async function runScenario5(baseDir) {
  console.log('\n[Scenario 5] Export Transaction (20 files, injected error at file 15)');
  const txDir = join(baseDir, 's5');
  mkdirSync(txDir, { recursive: true });

  const existingFiles = [];
  for (let i = 0; i < 10; i += 1) {
    const p = join(txDir, `exist-${i}.tsx`);
    const orig = `// ORIGINAL ${i}`;
    writeFileSync(p, orig, 'utf8');
    existingFiles.push({ path: p, orig });
  }

  const txFiles = [];
  for (let i = 0; i < 20; i += 1) {
    if (i < 10) txFiles.push({ path: existingFiles[i].path, content: `// UPDATED ${i}` });
    else txFiles.push({ path: join(txDir, `new-${i}.tsx`), content: `// NEW ${i}` });
  }

  const txRes = await executeExportTransaction(txFiles, { injectFaultAtIndex: 14 });
  const restoredOk = existingFiles.every((e) => readFileSync(e.path, 'utf8') === e.orig);
  const newDeleted = Array.from(
    { length: 10 },
    (_, i) => !existsSync(join(txDir, `new-${i + 10}.tsx`)),
  ).every(Boolean);

  const ok =
    !txRes.ok && txRes.rollback.ok && restoredOk && newDeleted && countTempFiles(txDir) === 0;
  console.log(
    `  - Aborted at 14: ${!txRes.ok}, Rollback: ${txRes.rollback.ok}, Restored: ${restoredOk}, New deleted: ${newDeleted}`,
  );
  return { ok };
}

async function runScenario6(baseDir) {
  console.log('\n[Scenario 6] Transaction Abort on Unwritable Target (Read-Only)');
  const txDir = join(baseDir, 's6');
  mkdirSync(txDir, { recursive: true });

  const files = [];
  for (let i = 0; i < 10; i += 1) {
    const p = join(txDir, `doc-${i}.json`);
    writeFileSync(p, JSON.stringify({ orig: i }), 'utf8');
    files.push({ path: p, content: JSON.stringify({ updated: i }) });
  }

  chmodSync(files[5].path, 0o444);
  let txRes;
  try {
    txRes = await executeExportTransaction(files);
  } finally {
    try {
      chmodSync(files[5].path, 0o666);
    } catch {
      // ignore
    }
  }

  const restoredOk = [0, 1, 2, 3, 4].every(
    (i) => readFileSync(files[i].path, 'utf8') === JSON.stringify({ orig: i }),
  );
  const ok = !txRes.ok && txRes.rollback.ok && restoredOk;
  console.log(
    `  - Aborted: ${!txRes.ok}, Rollback ok: ${txRes.rollback.ok}, Files 0-4 restored: ${restoredOk}`,
  );
  return { ok };
}

async function runScenario7(baseDir) {
  console.log(
    '\n[Scenario 7] Path, Encoding & Payload Edge Cases (Unicode, Deep Dirs, 0-byte, 5MB)',
  );
  const dir = join(baseDir, 's7');

  const vnPath = join(dir, 'tiếng-việt', 'giao-diện.tsx');
  const vnContent = '// Giao diện ReactCraft Local — Tiếng Việt UTF-8';
  const vnOk =
    (await atomicWrite(vnPath, vnContent)).ok && readFileSync(vnPath, 'utf8') === vnContent;

  const deepPath = join(dir, 'a', 'b', 'c', 'd', 'e', 'deep.ts');
  const deepContent = 'export const deep = 42;';
  const deepOk =
    (await atomicWrite(deepPath, deepContent)).ok && readFileSync(deepPath, 'utf8') === deepContent;

  const emptyPath = join(dir, 'empty.txt');
  const emptyOk = (await atomicWrite(emptyPath, '')).ok && statSync(emptyPath).size === 0;

  const largePath = join(dir, 'large.dat');
  const largeBuf = randomBytes(5 * 1024 * 1024);
  const expectedHash = sha256(largeBuf);
  const start = performance.now();
  const largeOk =
    (await atomicWrite(largePath, largeBuf)).ok && sha256(readFileSync(largePath)) === expectedHash;
  const largeTime = performance.now() - start;

  const ok = vnOk && deepOk && emptyOk && largeOk;
  console.log(
    `  - Unicode: ${vnOk}, Deep dirs: ${deepOk}, 0-byte: ${emptyOk}, 5MB: ${largeOk} (${largeTime.toFixed(2)}ms)`,
  );
  return { ok };
}

// ---------------------------------------------------------
// Main
// ---------------------------------------------------------

async function main() {
  const root = mkdtempSync(join(tmpdir(), 'reactcraft-vg-01-'));
  console.log('=== Spike VG-01: Windows NTFS Atomic Write & Transaction Verification ===');
  console.log(`Test dir: ${root}`);

  const results = {};
  try {
    results.s1 = await runScenario1(root);
    results.s2 = await runScenario2(root);
    results.s3 = await runScenario3(root);
    results.s4 = await runScenario4(root);
    results.s5 = await runScenario5(root);
    results.s6 = await runScenario6(root);
    results.s7 = await runScenario7(root);
  } finally {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  const allPassed = Object.values(results).every((r) => r.ok);
  console.log(`\n=== Overall Result: ${allPassed ? 'PASSED (ĐẠT)' : 'FAILED (KHÔNG ĐẠT)'} ===`);
  if (!allPassed) process.exitCode = 1;
}

await main();
