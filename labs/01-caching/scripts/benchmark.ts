import 'dotenv/config';
import autocannon from 'autocannon';

interface MetricsSnapshot {
  dbQueryCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  cacheHitRate: number;
}

const PORT = process.env.LAB01_PORT ?? '3001';
const BASE_URL = `http://localhost:${PORT}`;
const PRODUCT_ID = Number(process.env.BENCHMARK_PRODUCT_ID ?? 1);
const DURATION_SECONDS = Number(process.env.BENCHMARK_DURATION ?? 10);
const CONNECTIONS = Number(process.env.BENCHMARK_CONNECTIONS ?? 50);

async function getMetrics(): Promise<MetricsSnapshot> {
  const res = await fetch(`${BASE_URL}/metrics`);
  if (!res.ok) {
    throw new Error(`GET /metrics failed with status ${res.status}`);
  }
  return (await res.json()) as MetricsSnapshot;
}

/**
 * Hammers a single hot key (GET /products/:id) — the exact "hot read" this
 * lab's cache-aside layer targets. Run this once against a server started
 * with CACHE_ENABLED=false and once with CACHE_ENABLED=true (restart the
 * server between runs; the toggle is read once at boot) and paste both
 * results into the lab README.
 */
async function run(): Promise<void> {
  console.log(`Target:      GET ${BASE_URL}/products/${PRODUCT_ID}`);
  console.log(`Duration:    ${DURATION_SECONDS}s`);
  console.log(`Connections: ${CONNECTIONS}\n`);

  const before = await getMetrics();

  const result = await autocannon({
    url: `${BASE_URL}/products/${PRODUCT_ID}`,
    connections: CONNECTIONS,
    duration: DURATION_SECONDS,
  });

  const after = await getMetrics();

  console.log(autocannon.printResult(result));

  console.log('--- /metrics delta ---');
  console.log(`dbQueryCount:   +${after.dbQueryCount - before.dbQueryCount}`);
  console.log(`cacheHitCount:  +${after.cacheHitCount - before.cacheHitCount}`);
  console.log(`cacheMissCount: +${after.cacheMissCount - before.cacheMissCount}`);
  console.log(`cacheHitRate:   ${(after.cacheHitRate * 100).toFixed(1)}%\n`);

  console.log('--- Summary ---');
  console.log(`req/sec (avg): ${result.requests.average}`);
  console.log(`latency p50:   ${result.latency.p50} ms`);
  console.log(`latency p99:   ${result.latency.p99} ms`);
}

run().catch((error: unknown) => {
  console.error('Benchmark failed:', error);
  process.exitCode = 1;
});
