import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { config as loadEnv } from 'dotenv';

const LAB_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(LAB_ROOT, '../..');

// Load env the same way src/main.ts does (root .env first, then this package's),
// so DATABASE_URL — with ?schema=lab02 — resolves before @shared/core is read.
loadEnv({ path: [path.resolve(REPO_ROOT, '.env'), path.resolve(LAB_ROOT, '.env')] });

import { config } from '@shared/core';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';

type Architecture = 'monolith' | 'events';

interface Outcome {
  mode: Architecture;
  httpStatus: number | string;
  payment: string;
  order: string;
  email: string;
  audit: string;
}

// A dedicated port so the demo never collides with a dev server on LAB02_PORT.
const DEMO_PORT = Number(process.env.DEMO_PORT ?? 3102);
const BASE_URL = `http://localhost:${DEMO_PORT}`;
const HEALTH_TIMEOUT_MS = 30_000;
const SETTLE_TIMEOUT_MS = 3_000;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.databaseUrl }, { schema: 'lab02' }),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Boot the Nest app in a child process with the given architecture + email failure. */
function startServer(mode: Architecture): ChildProcess {
  const child = spawn(
    process.execPath,
    ['-r', 'ts-node/register/transpile-only', 'src/main.ts'],
    {
      cwd: LAB_ROOT,
      env: {
        ...process.env,
        ARCHITECTURE: mode,
        SIMULATE_EMAIL_FAILURE: 'true',
        SIMULATE_CHARGE_FAILURE: 'false',
        LAB02_PORT: String(DEMO_PORT),
        TS_NODE_TRANSPILE_ONLY: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  // Keep the app's JSON logs out of the demo output, but retain them for a
  // failure report if the server never becomes healthy.
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});
  return child;
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 2_000);
  });
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // server not up yet — retry
    }
    await sleep(300);
  }
  throw new Error(`Server did not become healthy on ${BASE_URL} within ${HEALTH_TIMEOUT_MS}ms`);
}

async function postCheckout(): Promise<number> {
  const res = await fetch(`${BASE_URL}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerEmail: 'demo@example.com', amount: 42 }),
  });
  // Drain the body so the socket is released before we read DB state.
  await res.text();
  return res.status;
}

/** The most recent order in schema lab02 — the one this run just created. */
async function latestOrderState() {
  const order = await prisma.order.findFirst({
    orderBy: { id: 'desc' },
    include: { payment: true },
  });
  if (!order) throw new Error('No order found after checkout — is Postgres migrated (lab:02:migrate)?');
  const auditCount = await prisma.auditLog.count({ where: { orderId: order.id } });
  return { order, auditCount };
}

/**
 * In events mode the side effects finish after the response. Poll until the
 * order is PAID and the audit row exists (or give up) so the table reflects the
 * settled state, not the racey instant right after the 200.
 */
async function waitForSettle(): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { order, auditCount } = await latestOrderState();
    if (order.status === 'PAID' && auditCount > 0) return;
    await sleep(100);
  }
}

async function runMode(mode: Architecture): Promise<Outcome> {
  const server = startServer(mode);
  try {
    await waitForHealth();
    const httpStatus = await postCheckout();
    if (mode === 'events') await waitForSettle();

    const { order, auditCount } = await latestOrderState();
    const succeeded = httpStatus >= 200 && httpStatus < 300;
    return {
      mode,
      httpStatus,
      payment: order.payment?.status ?? 'none',
      order: order.status,
      email: succeeded ? 'fails in isolation' : 'throws → aborts checkout',
      audit: auditCount > 0 ? 'written' : 'skipped',
    };
  } finally {
    await stopServer(server);
  }
}

function printTable(rows: Outcome[]): void {
  const headers = ['Mode', 'HTTP', 'Payment', 'Order', 'Email', 'Audit'];
  const data = rows.map((r) => [
    r.mode,
    String(r.httpStatus),
    r.payment,
    r.order,
    r.email,
    r.audit,
  ]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...data.map((row) => row[i].length)),
  );
  const line = (cells: string[]) => '| ' + cells.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |';

  console.log('\nSIMULATE_EMAIL_FAILURE=true — checkout outcome by architecture\n');
  console.log(line(headers));
  console.log('| ' + widths.map((w) => '-'.repeat(w)).join(' | ') + ' |');
  data.forEach((row) => console.log(line(row)));
  console.log(
    '\nSame request, same failing email. monolith couples it into the response ' +
      '(5xx, audit skipped); events isolates it (200, audit written).\n',
  );
}

async function main(): Promise<void> {
  console.log(`Demo: POST /checkout on :${DEMO_PORT}, both architectures, email set to fail.`);
  const rows: Outcome[] = [];
  for (const mode of ['monolith', 'events'] as const) {
    console.log(`\n▶ ${mode}: booting server, running one checkout...`);
    rows.push(await runMode(mode));
  }
  printTable(rows);
}

main()
  .catch((error: unknown) => {
    console.error('\nDemo failed:', error instanceof Error ? error.message : error);
    console.error('Is Postgres up (pnpm run infra:up) and migrated (pnpm run lab:02:migrate)?');
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
