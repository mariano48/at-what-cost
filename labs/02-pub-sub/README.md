# Lab 02 — Pub/Sub (checkout god-service → events)

> **Status:** Phase 2a done — the coupled monolith baseline runs (`ARCHITECTURE=monolith`). In-process events (`ARCHITECTURE=events`) and the `demo-flow` comparison land in Phase 2b.

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

`ARCHITECTURE=monolith|events` is read once at boot (like Lab 01's `CACHE_ENABLED`). Phase 2a implements `monolith`; `events` returns 501 until Phase 2b.

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

The customer was charged and the order is paid, but checkout reported failure and no audit trail exists. That gap is what the events split in Phase 2b addresses.

## Endpoints

| Method | Path            | Notes                                                  |
| ------ | --------------- | ------------------------------------------------------ |
| `GET`  | `/health`       | Liveness + current `architecture`                      |
| `POST` | `/checkout`     | `{ customerEmail, amount }` → runs the checkout flow   |
| `GET`  | `/orders/:id`   | Order + payment + audit logs (read side for the test)  |

## What it costs (Phase 2b will measure this)

Decoupling the side effects into events buys failure isolation and independent scaling of consumers, but the bill is real:

- No single place to read the full flow — tracing spans handlers
- Eventual consistency: side effects finish after the response returns
- Failures surface downstream, not at the caller — needs a retry / dead-letter strategy
- At-least-once delivery pushes idempotency onto consumers (future Lab 05)
- In-process events die with the process — durability (outbox / queue) is Lab 03's boundary, named here, not built here

## When NOT to do this

- All side effects must commit atomically and the caller needs immediate confirmation of each
- The flow is simple and end-to-end readability matters more than failure isolation

## Related labs

- [Lab 01 — Caching](../01-caching) — when reads, not side effects, are the bottleneck
- Lab 03 — Background workers — when heavy work must leave the HTTP path with durability (not yet built)

See [docs/public-contract.md](../../docs/public-contract.md) for why the labs stay separate.
