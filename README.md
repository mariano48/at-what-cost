# at-what-cost

Hands-on NestJS labs showing **when and why** — and **at what cost** — to add cache, pub/sub, and background workers, with Docker, benchmarks, and synthetic domains safe for public GitHub.

> **Status:** Lab 01 done — Redis cache-aside on the hot product read, with before/after benchmarks. [Public contract](docs/public-contract.md) · [PLAN](docs/PLAN.md)

Every lab and doc here follows [docs/documentation-philosophy.md](docs/documentation-philosophy.md): the point isn't to show a pattern works, it's to show what it costs to adopt one — and when that cost isn't worth paying.

## Why synthetic, why separate labs

These labs recreate **scaling pressures from production experience** using a generic shop domain. Each lab runs alone and measures **one trade-off** — the only honest way to show cost without publishing employer code. In a real system, cache, events, and workers often compose; here they're split so each gain and loss stays visible. Full contract: [docs/public-contract.md](docs/public-contract.md).

## Labs

| Lab | Question | Cost (one line) | Status |
| --- | --- | --- | --- |
| [01 — Caching](labs/01-caching) | Fewer DB hits worth staleness? | Staleness, invalidation, one more thing to run | **Done** — [benchmark](labs/01-caching#benchmark-cache-off-vs-on) |
| [02 — Pub/Sub](labs/02-pub-sub) | Decouple side effects worth losing one readable flow? | Harder tracing, downstream failures | Not started |
| [03 — Workers](labs/03-background-workers) | Async worth losing immediate feedback? | Job state, retries, backlog | Not started |

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
├── AGENTS.md              # Agent instructions (public)
├── .cursor/rules/         # Cursor rules (public)
├── docker-compose.yml     # Postgres + Redis
├── labs/                  # One folder per lab, runnable independently
├── shared/                # @shared/core — config, logger, shared types
└── docs/
    ├── public-contract.md           # What the repo commits to (read this first)
    ├── documentation-philosophy.md
    ├── PLAN.md
    └── decisions/                   # ADRs
```

## Architecture & decisions

The overall design rationale and diagrams: **[docs/PLAN.md](docs/PLAN.md)**

Individual decisions with fuller context and trade-offs: **[docs/decisions/](docs/decisions/)**

Public contract (synthetic domain, separate labs, minimum bar): **[docs/public-contract.md](docs/public-contract.md)**

The writing standard behind both: **[docs/documentation-philosophy.md](docs/documentation-philosophy.md)**

## Related repos (future)

- **Private sandbox** — practice refactoring familiar problems safely (not public)
- **`ddd-node-playground`** (public, separate) — bounded contexts and domain events before infra

See the learning path in [docs/PLAN.md](docs/PLAN.md).
