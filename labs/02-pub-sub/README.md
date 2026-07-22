# Lab 02 — Pub/Sub (checkout god-service → events)

> **Status:** Done — both modes run. `ARCHITECTURE=monolith` is the coupled baseline; `ARCHITECTURE=events` decouples the side effects into in-process domain events. `pnpm run lab:02:demo` prints the failure-isolation table below.

## Pitch

Is decoupling side effects worth losing a single readable end-to-end flow? Checkout charges a card, updates an order, emails a receipt, and writes an audit log — this lab asks what it costs when one of those side effects fails.

## The problem

In the monolith, `POST /checkout` runs every step sequentially in the request. The steps are not atomic — a charge is real money, an email is a network call. So a failing email doesn't just fail the email: it returns an error to the caller and skips the audit step, even though the order is already **PAID** and the card was **CHARGED**. Partial completion with an error response is the coupling this lab makes visible.

## Run it

```bash
# From the repo root
pnpm run infra:up            # Postgres + Redis via Docker Compose
pnpm run lab:02:migrate      # create the lab02 schema (orders, payments, audit_logs)
pnpm run lab:02              # start the API on :3002 (or LAB02_PORT)
```

`ARCHITECTURE=monolith|events` is read once at boot (like Lab 01's `CACHE_ENABLED`):

- `monolith` — every side effect runs inline and sequentially in the request.
- `events` — checkout charges the card + persists the order, emits a `PaymentCompleted` in-process domain event ([`@nestjs/event-emitter`](https://docs.nestjs.com/techniques/events)), and returns immediately. Three independent handlers (`OrdersHandler`, `NotificationsHandler`, `AuditHandler`) react. Still one Nest app, one process — a modular monolith, **not** microservices.

Lab 02's tables live in their own Postgres schema (`lab02`) on the shared `labs` database, so they never collide with Lab 01.

## Reproduce the coupling pain (manual smoke test)

```bash
# Happy path — everything succeeds
curl -X POST localhost:3002/checkout \
  -H "Content-Type: application/json" \
  -d '{"customerEmail":"a@b.com","amount":42}'
# → { orderId, reference, status: "PAID" }

# Now make the email step fail, and retry checkout
SIMULATE_EMAIL_FAILURE=true pnpm run lab:02   # restart with the flag
curl -X POST localhost:3002/checkout \
  -H "Content-Type: application/json" \
  -d '{"customerEmail":"a@b.com","amount":42}'
# → 500 Internal Server Error

# Inspect the partial state the failed checkout left behind
curl localhost:3002/orders/<orderId>
# → order.status = "PAID", payment.status = "CHARGED", auditLogs = []
```

The customer was charged and the order is paid, but checkout reported failure and no audit trail exists. That gap is what the events split closes.

## The number — failure isolation

`scripts/demo-flow.ts` boots the app once per architecture with `SIMULATE_EMAIL_FAILURE=true`, sends one identical `POST /checkout`, waits for the side effects to settle, and reads the committed state straight from the `lab02` schema:

```bash
pnpm run infra:up            # Postgres + Redis
pnpm run lab:02:migrate      # once, to create the lab02 schema
pnpm run lab:02:demo         # boots both modes on :3102 and prints the table
```

Observed output (same request, same failing email, one process each):

| Mode     | HTTP | Payment | Order | Email                    | Audit   |
| -------- | ---- | ------- | ----- | ------------------------ | ------- |
| monolith | 500  | CHARGED | PAID  | throws → aborts checkout | skipped |
| events   | 201  | CHARGED | PAID  | fails in isolation       | written |

Both modes charge the card and end with the order **PAID** — the difference is the blast radius of the failing email:

- **monolith** couples the email into the request. It throws mid-flow, so the caller gets a **500** and the audit step never runs, even though the money already moved. Partial completion reported as total failure.
- **events** has already returned by the time the email handler runs. The failure lands in `NotificationsHandler`, is logged, and stays there — HTTP is **2xx** (201 Created) and `AuditHandler` still commits. Only the email is lost.

(`events` returns **201** — Nest's default for a successful `POST` — not 200; the point is a 2xx success versus the monolith's 5xx.)

## Endpoints

| Method | Path            | Notes                                                  |
| ------ | --------------- | ------------------------------------------------------ |
| `GET`  | `/health`       | Liveness + current `architecture`                      |
| `POST` | `/checkout`     | `{ customerEmail, amount }` → runs the checkout flow   |
| `GET`  | `/orders/:id`   | Order + payment + audit logs (read side for the test)  |

## What it costs

The 500-vs-201 above is the upside: failure isolation, plus consumers you could scale or retry independently. The bill is real, and the same demo makes it visible:

- **No single readable flow** — the four steps are now spread across `CheckoutService` and three handlers; tracing means following the event, not reading one method.
- **Eventual consistency** — checkout returns `201` with the order still `PENDING`; `OrdersHandler` flips it to `PAID` a beat later. The demo has to *wait for settle* before reading state precisely because the response no longer means "all done".
- **Failures surface downstream, not at the caller** — the lost email is a log line in `NotificationsHandler`, not a 500. Someone has to watch for it (retry / dead-letter), or it is silently gone.
- **At-least-once delivery pushes idempotency onto consumers** (the cost Lab 05 will isolate).
- **In-process events die with the process.** `@nestjs/event-emitter` is DI wiring, not a broker: if the app crashes between the `201` and the handlers finishing, those side effects are simply lost — no queue, no replay. Durability (outbox / durable queue) is **Lab 03's boundary**, named here, deliberately not built here.

## When NOT to do this

- All side effects must commit atomically and the caller needs immediate confirmation of each
- The flow is simple and end-to-end readability matters more than failure isolation

## Related labs

- [Lab 01 — Caching](../01-caching) — when reads, not side effects, are the bottleneck
- Lab 03 — Background workers — when heavy work must leave the HTTP path with durability (not yet built)

See [docs/public-contract.md](../../docs/public-contract.md) for why the labs stay separate.
