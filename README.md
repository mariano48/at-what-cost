# at-what-cost

Hands-on NestJS labs showing **when and why** — and **at what cost** — to add cache, pub/sub, and background workers, with Docker, benchmarks, and synthetic domains safe for public GitHub.

> **Status:** Phase 1a in progress — Lab 01's core product API is up (no cache yet). See [docs/PLAN.md](docs/PLAN.md) for the phased build order.

Every lab and doc here follows [docs/documentation-philosophy.md](docs/documentation-philosophy.md): the point isn't to show a pattern works, it's to show what it costs to adopt one — and when that cost isn't worth paying.

## What this repo will be

Modular labs demonstrating scaling and reliability patterns you can't show from enterprise code — each one paired with the cost it introduces, not just the problem it solves:

| Lab                                                   | Pattern           | Problem                                                               | Cost it introduces                                                          | Status      |
| ----------------------------------------------------- | ----------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------- |
| [01 — Caching](labs/01-caching)                       | Redis cache-aside | Hot reads hammer the database                                         | Staleness window, invalidation bugs, cache-stampede risk, one more thing to run | Core API done, cache pending (Phase 1b) |
| [02 — Pub/Sub](labs/02-pub-sub)                       | Domain events     | God service does payment, mail, audit, and entity updates in one flow | Eventual consistency, harder-to-trace failures across services, broker to operate | Not started |
| [03 — Background workers](labs/03-background-workers) | BullMQ queues     | Slow work blocks HTTP                                                 | Delayed feedback to the caller, retry/idempotency handling, queue backlog to monitor | Not started |

Stack: **NestJS 11**, **TypeScript**, **Prisma**, **Redis**, **BullMQ**, **Docker Compose**.

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file
cp .env.example .env

# 3. Start shared infra (Postgres + Redis)
pnpm run infra:up

# 4. Migrate + seed Lab 01's database (first run only)
pnpm run lab:01:migrate
pnpm run lab:01:seed

# 5. Run Lab 01
pnpm run lab:01
```

## Repository structure

```
at-what-cost/
├── docker-compose.yml     # Postgres + Redis
├── labs/                  # One folder per lab, runnable independently
│   ├── 01-caching/
│   ├── 02-pub-sub/
│   └── 03-background-workers/
├── shared/                # @shared/core — config, logger, shared types
└── docs/
    ├── documentation-philosophy.md  # The standard every doc here is held to
    ├── PLAN.md            # Architecture and design rationale
    └── decisions/         # ADRs — why, not just what
```

## Architecture & decisions

The overall design rationale and diagrams: **[docs/PLAN.md](docs/PLAN.md)**

Individual decisions with fuller context and trade-offs: **[docs/decisions/](docs/decisions/)**

The writing standard behind both: **[docs/documentation-philosophy.md](docs/documentation-philosophy.md)**

## Related repos (future)

- **Private sandbox** — practice refactoring familiar problems safely (not public)
- **`ddd-node-playground`** (public, separate) — bounded contexts and domain events before infra

See the learning path in [docs/PLAN.md](docs/PLAN.md).
