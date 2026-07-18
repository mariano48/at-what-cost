# at-what-cost — Architecture & Design Rationale

**Repo:** at-what-cost
**Stack:** NestJS 11 + TypeScript + Prisma + Redis + BullMQ + Docker Compose

**One-line pitch:** _Hands-on NestJS labs showing when and why to add cache, pub/sub, and background workers — with Docker, benchmarks, and no proprietary baggage._

Individual decisions with fuller context and trade-offs live in [docs/decisions/](decisions/). This file covers the overall shape of the repo.

---

## One repo or many? (Recommendation: one monorepo)

For portfolio visibility, modular labs, shared Docker infra, and learning NestJS — **one repository is the better choice**.

|                  | **Monorepo (recommended)**                                       | **Separate repos per lab**                              |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| GitHub profile   | One strong pinned project with clear narrative                   | 3 small repos that can look sparse or fragmented        |
| Discovery        | Reviewer lands on README, picks a lab                            | Must hunt across repos                                  |
| Shared infra     | Single `docker-compose.yml`, one `shared/` package               | Duplicate Redis/Postgres setup 3×                       |
| CI / maintenance | One pipeline, workspace scripts                                  | 3× lint, typecheck, Actions config                      |
| Modularity       | Achieved via `labs/01-*` folders + independent `pnpm run lab:01` | True isolation, but modular _labs_, not modular _repos_ |
| Learning NestJS  | Consistent patterns across labs (modules, DI, decorators)        | Same, but more boilerplate duplication                  |

**When separate repos would make sense later:** if a single lab grows into a full standalone tutorial people fork independently.

See [ADR 0001](decisions/0001-monorepo-over-separate-repos.md) for the full reasoning.

---

## Learning path: work code → intermediate step → this repo

```mermaid
flowchart LR
  Work["Work_Express_monolith"] --> Private["Private_sandbox_optional"]
  Work --> DDD["Public_DDD_repo"]
  DDD --> Scaling["Public_at-what-cost"]
  Private --> DDD
```

### 1. Private sandbox (optional)

Practice refactoring familiar problems without public exposure. Can stay Express + JS initially.

### 2. Public DDD repo (separate)

e.g. `ddd-node-playground` — bounded contexts, aggregates, domain events **in-process** (no Redis yet).

|          | DDD repo                        | at-what-cost                                  |
| -------- | ------------------------------- | --------------------------------------------- |
| Question | _What_ belongs together?        | _How_ do you wire decoupled parts at runtime? |
| Focus    | Bounded contexts, domain events | Cache, pub/sub, workers, benchmarks           |

### 3. This repo (at-what-cost)

Assumes you understand _why_ payment shouldn't send mail. Lab 02's monolith → events toggle shows the **operational payoff**.

**Suggested order:** Private sandbox (optional) → DDD repo → this repo.

---

## Why NestJS (vs plain Express at work)

- **Modules + DI** — testable, explicit boundaries
- **First-class integrations** — `@nestjs/cache-manager`, `@nestjs/microservices`, `@nestjs/bullmq`
- **TypeScript by default** — DTOs, validation, typed event payloads
- **Multiple apps in one lab** — Lab 02 uses separate Nest microservice entrypoints

Each lab README includes a **"NestJS vs plain Express"** callout.

See [ADR 0002](decisions/0002-nestjs-over-express.md) for the full reasoning.

---

## What you're demonstrating

| Pattern     | Primary benefit              | Scaling dimension                   |
| ----------- | ---------------------------- | ----------------------------------- |
| **Caching** | Fewer DB hits, lower latency | Read scalability, cost reduction    |
| **Pub/Sub** | Loose coupling, fan-out      | Horizontal scaling of consumers     |
| **Workers** | Offload slow work from HTTP  | Throughput, resilience under spikes |

These patterns also improve **reliability** and **operational decoupling**, not just raw QPS.

---

## God-service problem — in this repo

**Keep it in Lab 02.** Payment + entity updates + mail + audit in one class is the **motivation** for pub/sub.

Lab 02 uses **`ARCHITECTURE=monolith|events`** toggle (same API, two implementations).

```mermaid
flowchart TB
  subgraph monolith [MonolithMode_Bad]
    Pay1[PaymentsService] --> Charge1[Charge card]
    Pay1 --> Update1[Update order entity]
    Pay1 --> Mail1[Send receipt email]
    Pay1 --> Audit1[Persist audit log]
  end
  subgraph events [EventDriven_Good]
    Pay2[PaymentsService] --> Charge2[Charge card]
    Pay2 -->|PaymentCompleted| Broker[(Redis)]
    Broker --> Orders[OrdersService]
    Broker --> Notify[NotificationService]
    Broker --> Audit[AuditService]
  end
```

This mirrors a real problem, rebuilt with a synthetic domain so it's safe to publish — see [ADR 0003](decisions/0003-synthetic-data-no-proprietary-code.md).

---

## Repository structure

```
at-what-cost/
├── README.md
├── docker-compose.yml           # Postgres + Redis
├── package.json
├── pnpm-workspace.yaml          # pnpm workspaces
├── labs/
│   ├── 01-caching/
│   ├── 02-pub-sub/
│   │   └── apps/
│   │       ├── payments-api/
│   │       ├── orders/
│   │       ├── notifications/
│   │       └── audit/
│   └── 03-background-workers/
├── shared/
│   ├── types/
│   └── lib/
└── docs/
    ├── PLAN.md                  # this file
    ├── decisions/                # ADRs — why, not just what
    ├── when-to-use-what.md
    └── enterprise-analogies.md
```

---

## Lab designs

### Lab 01 — Caching (Redis cache-aside)

- `CACHE_ENABLED=false|true` toggle
- Postgres ~10k products, cache-aside in `ProductsService`
- `PATCH /products/:id` invalidates cache
- `scripts/benchmark.ts` — autocannon before/after

### Lab 02 — Pub/Sub + god-service decomposition

**Act 1 — Monolith:** `POST /checkout` — charge → update order → email → audit (sequential, coupled failures)

**Act 2 — Events:** `payments-api` emits `PaymentCompleted`; `orders`, `notifications`, `audit` subscribe via Redis

- `scripts/demo-flow.ts` — latency + failure isolation comparison
- Env: `SIMULATE_EMAIL_FAILURE=true` shows monolith vs events difference

### Lab 03 — Background workers (BullMQ)

- `POST /reports` → 202 + jobId; worker processes async
- `SYNC_MODE=true` for before/after comparison
- `scripts/spike-test.ts` — 100 enqueued jobs

---

## Benchmark scripts

| Lab | Script          | Compares                                   |
| --- | --------------- | ------------------------------------------ |
| 01  | `benchmark.ts`  | p50/p99, req/sec cache off vs on           |
| 02  | `demo-flow.ts`  | Monolith vs events latency + email failure |
| 03  | `spike-test.ts` | Async vs sync API p99                      |

---

## Tech choices

| Concern    | Choice                                    |
| ---------- | ----------------------------------------- |
| Framework  | NestJS 11                                 |
| ORM        | Prisma                                    |
| Caching    | `@nestjs/cache-manager` + Redis           |
| Pub/Sub    | `@nestjs/microservices` (Redis transport) |
| Jobs       | `@nestjs/bullmq`                          |
| Monorepo   | pnpm workspaces                           |
| Benchmarks | autocannon + custom scripts               |
| Node       | 20 LTS                                    |

---

## Out of scope for v1 (roadmap)

- **Lab 04:** Rate limiting + horizontal API scaling
- **Lab 05:** Idempotency keys for webhook consumers
- **Lab 06:** CQRS read model (event projection)

---

## Success criteria

1. Clone → run Lab 01 in under 5 minutes
2. Each lab README explains **why**, not just **how**
3. Numeric before/after proof in every lab
4. Safe to share publicly — no employer details
5. Lab 02 shows god-service decomposition without real payment systems
