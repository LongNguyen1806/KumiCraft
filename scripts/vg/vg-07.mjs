// Spike VG-07: Local server security, REST throughput & latency benchmark (ADR-BE-03, ADR-BE-06)
// Run with: node scripts/vg/vg-07.mjs
import { Buffer } from 'node:buffer';
import http from 'node:http';
import { performance } from 'node:perf_hooks';

import { createHttpApp } from '../../packages/server/src/adapters/http/create-http-app.ts';
import { HOST, startServer } from '../../packages/server/src/index.ts';

const BATCH_PAYLOAD = JSON.stringify({
  operations: [
    { type: 'insert_node', id: 'n1', component: 'Container', parentId: 'root' },
    { type: 'update_props', id: 'n1', props: { className: 'p-4 flex gap-2' } },
    { type: 'insert_node', id: 'n2', component: 'Text', parentId: 'n1' },
    { type: 'update_props', id: 'n2', props: { text: 'Hello KumiCraft' } },
  ],
});

const pickPort = () => 49152 + Math.floor(Math.random() * 10000);

/** Measure server startup time against PB-10 budget (<= 2,000 ms). */
async function testStartupLatency() {
  console.log('\n[Part 1] Startup Latency & Interface Binding (PB-10)');
  const port = pickPort();
  const start = performance.now();
  const serverRes = await startServer({
    version: '0.0.0',
    port,
    workspaceDir: '.',
    logLevel: 'silent',
  });
  const duration = performance.now() - start;

  if (!serverRes.ok) throw new Error('Server failed to start');

  const server = serverRes.value;
  const isLoopbackOnly = server.url.startsWith(`http://${HOST}:${String(port)}`);
  const isBudgetMet = duration <= 2000;

  console.log(`  - Bound to 127.0.0.1 loopback only: ${isLoopbackOnly}`);
  console.log(`  - Startup duration: ${duration.toFixed(2)} ms (PB-10 <= 2,000 ms)`);
  console.log(`  - Meets PB-10: ${isBudgetMet}`);

  await server.close();
  return { ok: isLoopbackOnly && isBudgetMet, duration };
}

function sendHttpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 500,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function runSecurityProbes(baseUrl, sessionToken) {
  const p = baseUrl.port;
  const resNoToken = await sendHttpRequest({
    ...baseUrl,
    path: '/api/v1/session',
    method: 'GET',
    headers: { Host: `127.0.0.1:${String(p)}` },
  });
  const resWrongToken = await sendHttpRequest({
    ...baseUrl,
    path: '/api/v1/session',
    method: 'GET',
    headers: { Host: `127.0.0.1:${String(p)}`, Authorization: 'Bearer invalid-token' },
  });
  const resBadOrigin = await sendHttpRequest({
    ...baseUrl,
    path: '/api/v1/session',
    method: 'GET',
    headers: {
      Host: `127.0.0.1:${String(p)}`,
      Authorization: `Bearer ${sessionToken}`,
      Origin: 'http://malicious-site.com',
    },
  });
  const resBadHost = await sendHttpRequest({
    ...baseUrl,
    path: '/api/v1/session',
    method: 'GET',
    headers: { Host: 'attacker.evil.com', Authorization: `Bearer ${sessionToken}` },
  });
  const resValid = await sendHttpRequest({
    ...baseUrl,
    path: '/api/v1/session',
    method: 'GET',
    headers: {
      Host: `127.0.0.1:${String(p)}`,
      Origin: `http://127.0.0.1:${String(p)}`,
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  return {
    missingTokenBlocked: resNoToken.statusCode === 401,
    wrongTokenBlocked: resWrongToken.statusCode === 401,
    badOriginBlocked: resBadOrigin.statusCode === 401,
    badHostBlocked: resBadHost.statusCode === 421,
    validPassed: resValid.statusCode === 200,
  };
}

/** Verify network security rejections: token, Origin, Host (SPEC-05 S-01 to S-12). */
async function testNetworkSecurity() {
  console.log('\n[Part 2] Network Security & Request Filtering (SPEC-05 S-01 to S-12)');
  const port = pickPort();
  const serverRes = await startServer({
    version: '0.0.0',
    port,
    workspaceDir: '.',
    logLevel: 'silent',
  });
  if (!serverRes.ok) throw new Error('Cannot start server for security testing');

  const { sessionToken, close } = serverRes.value;
  try {
    const probes = await runSecurityProbes({ host: '127.0.0.1', port }, sessionToken);
    console.log(`  - Missing token rejected (HTTP 401): ${probes.missingTokenBlocked}`);
    console.log(`  - Wrong token rejected (HTTP 401): ${probes.wrongTokenBlocked}`);
    console.log(`  - Disallowed Origin rejected (HTTP 401): ${probes.badOriginBlocked}`);
    console.log(`  - Spoofed Host rejected (HTTP 421): ${probes.badHostBlocked}`);
    console.log(`  - Legitimate request accepted (HTTP 200): ${probes.validPassed}`);
    const ok = Object.values(probes).every(Boolean);
    return { ok };
  } finally {
    await close();
  }
}

/** Run worker pool for throughput measurement. */
function runBenchmarkPool(port, token, totalRequests, concurrency) {
  return new Promise((resolve) => {
    const latencies = [];
    const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });
    let sent = 0;
    let completed = 0;
    const startTime = performance.now();

    function dispatch() {
      if (sent >= totalRequests) return;
      sent += 1;
      const t0 = performance.now();

      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path: '/api/v1/operations',
          method: 'POST',
          agent,
          headers: {
            Host: `127.0.0.1:${String(port)}`,
            Origin: `http://127.0.0.1:${String(port)}`,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(BATCH_PAYLOAD),
          },
        },
        (res) => {
          res.resume();
          res.on('end', () => {
            latencies.push(performance.now() - t0);
            completed += 1;
            if (completed === totalRequests) {
              const elapsedSeconds = (performance.now() - startTime) / 1000;
              agent.destroy();
              resolve({ latencies, elapsedSeconds });
            } else {
              dispatch();
            }
          });
        },
      );
      req.write(BATCH_PAYLOAD);
      req.end();
    }

    for (let i = 0; i < concurrency; i += 1) dispatch();
  });
}

function calculateBenchmarkMetrics(latencies, totalRequests, elapsedSeconds) {
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p90 = latencies[Math.floor(latencies.length * 0.9)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const max = latencies[latencies.length - 1];
  const opsPerSec = Math.round(totalRequests / elapsedSeconds);

  return { opsPerSec, p50, p90, p95, max };
}

/** Benchmark batch operations throughput (>= 1,000 ops/s) and P95 latency (PB-02 <= 20 ms). */
async function testBatchOperationsThroughput() {
  console.log('\n[Part 3] REST Throughput & PB-02 Latency Benchmark');
  const token = 'benchmark-session-token-secret-key';
  const testPort = pickPort();

  const app = await createHttpApp({
    logLevel: 'silent',
    security: { port: testPort, sessionToken: token, trustedOrigins: [] },
    getSessionInfo: () => ({
      version: '0.0.0',
      platform: 'windows',
      features: {},
      workspace: { state: 'none', directory: '.' },
    }),
  });

  app.post('/api/v1/operations', (req, reply) => {
    const body = req.body;
    if (!Array.isArray(body?.operations)) {
      void reply.code(400).send({ error: 'invalid payload' });
      return;
    }
    void reply.send({ ok: true, count: body.operations.length });
  });

  await app.listen({ host: HOST, port: testPort });

  try {
    const totalRequests = 2000;
    const { latencies, elapsedSeconds } = await runBenchmarkPool(
      testPort,
      token,
      totalRequests,
      20,
    );
    const m = calculateBenchmarkMetrics(latencies, totalRequests, elapsedSeconds);
    const meetsThroughput = m.opsPerSec >= 1000;
    const meetsPb02 = m.p95 <= 20;

    console.log(`  - Total requests: ${totalRequests} in ${elapsedSeconds.toFixed(3)} s`);
    console.log(`  - Throughput: ${m.opsPerSec.toLocaleString()} ops/s (Target >= 1,000 ops/s)`);
    console.log(`  - Latencies: p50 = ${m.p50.toFixed(2)} ms, p90 = ${m.p90.toFixed(2)} ms`);
    console.log(
      `  - Latencies: p95 = ${m.p95.toFixed(2)} ms (PB-02 target <= 20 ms), max = ${m.max.toFixed(2)} ms`,
    );
    console.log(`  - Meets throughput: ${meetsThroughput}, Meets PB-02: ${meetsPb02}`);

    return { ok: meetsThroughput && meetsPb02, ...m };
  } finally {
    await app.close();
  }
}

async function main() {
  console.log('=== Spike VG-07: Local Server & Performance Verification ===');
  const results = {};

  results.startup = await testStartupLatency();
  results.security = await testNetworkSecurity();
  results.benchmark = await testBatchOperationsThroughput();

  const allPassed = Object.values(results).every((r) => r.ok);
  console.log(`\n=== Overall Result: ${allPassed ? 'PASSED (ĐẠT)' : 'FAILED (KHÔNG ĐẠT)'} ===`);

  if (!allPassed) process.exitCode = 1;
}

await main();
