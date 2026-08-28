#!/usr/bin/env node
/**
 * Lightweight load test for core verification endpoint.
 * Usage: node scripts/load-test-verify.mjs
 * Env: API_URL, LOAD_CONCURRENCY (default 20), LOAD_DURATION_SEC (default 15), LOAD_P95_MS_MAX (default 500)
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 20);
const DURATION_SEC = Number(process.env.LOAD_DURATION_SEC ?? 15);
const P95_MS_MAX = Number(process.env.LOAD_P95_MS_MAX ?? 500);

const payload = {
  url: 'https://verify.localhost/v/e2eFixedQrToken0001',
  hostname: 'verify.localhost',
};

async function verifyOnce() {
  const start = performance.now();
  const res = await fetch(`${API_URL}/api/v1/public/verify/qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const elapsed = performance.now() - start;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body.result) {
    throw new Error('Missing result field');
  }
  return elapsed;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runWorker(endAt, latencies, errors) {
  while (Date.now() < endAt) {
    try {
      latencies.push(await verifyOnce());
    } catch (err) {
      errors.push(String(err));
    }
  }
}

const endAt = Date.now() + DURATION_SEC * 1000;
const latencies = [];
const errors = [];

console.log(
  `Load test: ${CONCURRENCY} workers for ${DURATION_SEC}s against ${API_URL}/api/v1/public/verify/qr`,
);

await Promise.all(Array.from({ length: CONCURRENCY }, () => runWorker(endAt, latencies, errors)));

const total = latencies.length;
const p50 = percentile(latencies, 50);
const p95 = percentile(latencies, 95);
const p99 = percentile(latencies, 99);
const rps = total / DURATION_SEC;

console.log(JSON.stringify({ total, errors: errors.length, rps: rps.toFixed(1), p50, p95, p99 }, null, 2));

if (errors.length > 0) {
  console.error('Sample errors:', errors.slice(0, 3));
  process.exit(1);
}

if (p95 > P95_MS_MAX) {
  console.error(`p95 ${p95.toFixed(1)}ms exceeds threshold ${P95_MS_MAX}ms`);
  process.exit(1);
}

console.log(`PASS: p95 ${p95.toFixed(1)}ms <= ${P95_MS_MAX}ms`);
