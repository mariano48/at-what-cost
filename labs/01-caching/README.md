# Lab 01 — Caching (Redis cache-aside)

> **Status:** Phase 1b done — Redis cache-aside sits in front of the hot read path, with a `CACHE_ENABLED` toggle and benchmark numbers below.

## Problem

A product catalog read (`GET /products/:id`) hits Postgres on every request. Under load, hot reads hammer the database even though the same handful of products are requested over and over.

## What's here

- NestJS + Prisma product API — `Product { id, sku, name, price, updatedAt }`, seeded with 10,000 synthetic rows
- `LAB01_DB_LATENCY_MS` (default `50`) adds artificial latency to every DB read, so the cost of a cache miss is visible even on localhost Postgres. This flag is a flat constant, not a function of query complexity — it stands in for the network round-trip and connection-pool contention of a database reached over a network under concurrent load, not for a computationally expensive query. It amplifies a real effect rather than manufacturing one: even with `LAB01_DB_LATENCY_MS=0`, 50 concurrent connections contending for Postgres's connection pool still produce a measurable, if smaller, gap between cache off and on — see "How much of this is the injected latency?" in the benchmark section below.
- Cache-aside in front of `GET /products/:id` only — `@nestjs/cache-manager` + Redis via `@keyv/redis`, gated by `CACHE_ENABLED`
- `PATCH /products/:id` invalidates the cached entry for that id
- `GET /metrics` exposes `dbQueryCount`, `cacheHitCount`, `cacheMissCount`, `cacheHitRate`
- `scripts/benchmark.ts` — autocannon load test against a single hot key, printing latency/throughput plus the `/metrics` delta

## Why only `findOne` is cached

`findAll` returns a paginated, orderable result set — caching it correctly means keying by `page`+`pageSize` (or worse, caching the whole table) and invalidating every affected page on every write. That's a second, harder caching problem, not an extension of this one. The lab's problem statement is a single hot key (`GET /products/:id`), so that's the only path with a cache in front of it — see "Keep labs intentionally focused" in [docs/documentation-philosophy.md](../../docs/documentation-philosophy.md).

## Run it

```bash
# From the repo root
pnpm run infra:up          # Postgres + Redis via Docker Compose
pnpm run lab:01:migrate     # create the products table
pnpm run lab:01:seed        # seed 10,000 products
pnpm run lab:01             # start the API on :3001 (or LAB01_PORT)
```

`CACHE_ENABLED` is read once at boot (see `.env` / `.env.example`), so toggling it requires a restart — that's intentional, it mirrors a config flag flipped in a deploy rather than a runtime feature switch.

## Endpoints

| Method  | Path            | Notes                                  |
| ------- | --------------- | --------------------------------------- |
| `GET`   | `/health`       | Liveness check                          |
| `GET`   | `/metrics`      | `{ dbQueryCount, cacheHitCount, cacheMissCount, cacheHitRate }` |
| `GET`   | `/products`     | Paginated list — `?page=&pageSize=`, not cached |
| `GET`   | `/products/:id` | Single product, cache-aside, 404 if missing |
| `PATCH` | `/products/:id` | Update `name` and/or `price`, invalidates the cache entry |

```bash
curl localhost:3001/products/1
curl "localhost:3001/products?page=1&pageSize=10"
curl -X PATCH localhost:3001/products/1 -H "Content-Type: application/json" -d '{"price": 19.99}'
```

## NestJS vs plain Express

Cache-aside hangs off an injected `CACHE_MANAGER` provider (`@nestjs/cache-manager`) rather than a Redis client instantiated and threaded through route handlers by hand — same idea, but DI keeps `ProductsService` testable without spinning up real Redis (swap the provider for a fake in a test module).

## Benchmark: cache off vs on

`scripts/benchmark.ts` runs autocannon against `GET /products/1` — 50 connections, 10 seconds — and reports the `/metrics` delta alongside latency/throughput. Each row below is a separate run: the server was restarted with the given `CACHE_ENABLED` value, since the toggle is read once at boot. Each configuration was run 3 times; the table reports the range across those runs, not a single sample.

```bash
# cache off
CACHE_ENABLED=false pnpm run lab:01     # separate terminal
pnpm run lab:01:benchmark

# cache on
CACHE_ENABLED=true pnpm run lab:01      # separate terminal
pnpm run lab:01:benchmark
```

| Cache | req/sec (avg, range across 3 runs) | p50 latency | p99 latency | DB queries (10s, ~8k req) |
| ----- | ----------------------------------: | ----------: | ----------: | ------------------------- |
| Off   | 799 – 805                            | 61 – 62 ms  | 74 – 80 ms  | ~8,000 (every request)    |
| On    | 5,622 – 5,841                        | 8 ms        | 12 – 13 ms  | 0 – 50 (cache misses only) |

~7.2–7.3× more throughput and ~5.7–6.5× lower p99 latency, with 99.9–100% of reads served from Redis instead of Postgres. Measured locally (Docker Desktop, Postgres 16 + Redis 7 containers, `LAB01_DB_LATENCY_MS=50`, `CACHE_TTL_SECONDS=60`) — the ratio matters more than the absolute numbers, which will vary by machine.

This benchmark hits a single hot key on purpose: it's the best case for cache-aside (high reuse, one key) and the worst case for Postgres-per-request. A workload with 10,000 distinct keys and low reuse would show a much smaller gap — see "When this would NOT be worth it" below.

### How much of this is the injected latency?

`LAB01_DB_LATENCY_MS` (default `50`) is doing real work in the table above — it's what makes the "hot read" problem visible on a local Postgres instance that would otherwise respond quickly. Running the same benchmark once each with `LAB01_DB_LATENCY_MS=0` isolates how much of the gap is that injected flag versus a real, measurable cost of hitting Postgres under load:

| Cache (LAB01_DB_LATENCY_MS=0) | req/sec (avg) | p50 latency | p99 latency |
| ------------------------------ | ------------: | ----------: | ----------: |
| Off                             | 2,389         | 19 ms       | 39 ms       |
| On                              | 7,611         | 6 ms        | 13 ms       |

Even with the artificial delay removed entirely, cache-off is still ~3.2× slower than cache-on, and p99 is ~3× higher. That gap isn't the injected flag — it's 50 concurrent connections contending for Postgres's (and Prisma's) finite connection pool, plus the real, if small, cost of a network round trip to the Postgres container and back. In other words: `LAB01_DB_LATENCY_MS=50` amplifies a real effect to make it visible on a quiet localhost database, it doesn't manufacture one from nothing — but the amplified 7.7× figure above shouldn't be read as "caching always gets you 7.7×"; the more conservative, real number for this exact workload without the injected flag is ~3×.

## Cache stampede and TTL

- **TTL:** `CACHE_TTL_SECONDS` (default `60`) bounds the staleness window. Shorter TTLs mean fresher-but-more-often-missed reads; longer TTLs mean fewer DB hits but longer windows where a missed invalidation path would go unnoticed. There's no TTL that's "correct" independent of how often the underlying data actually changes — this lab's 60s is a starting point, not a recommendation.
- **Stampede risk:** if a hot key's TTL expires under sustained load, every concurrent request that misses the cache in that window calls Postgres — for one key, at n_concurrent requests instead of 1. This lab doesn't reproduce that under the current benchmark (autocannon's 50 connections all converge on cache hits well within the 60s TTL, so the miss count stays at 50 — one per connection's first request — not a repeated stampede). Demonstrating a stampede reliably would need either a much shorter TTL relative to request rate, or a deliberate cache-clear mid-run; neither is wired up here, so treat the 99.9% hit rate above as the happy path, not proof the stampede risk doesn't exist.
- **What production would add:** request coalescing (a single in-flight DB read shared by concurrent misses for the same key, e.g. via a mutex or `dataloader`-style batching) or probabilistic early expiry (refreshing slightly before TTL rather than exactly at it) are the standard mitigations. Both add code paths this lab intentionally leaves out to keep the cache-aside logic in `ProductsService` readable.

## At what cost

Caching isn't a free win — it trades one problem (slow reads) for a different set of problems:

- **Staleness.** Between a write and the next cache expiry/invalidation, readers can see an outdated product. `PATCH` invalidating the key on write narrows this window but doesn't remove it — a crashed process between the Postgres write and the Redis delete, or a write path that bypasses `ProductsService.update`, leaves stale data served with no error to signal it.
- **Cache stampede.** If a hot key expires under load, many concurrent requests can miss the cache at once and hit Postgres simultaneously — the exact spike caching was meant to prevent. See "Cache stampede and TTL" above for why this benchmark doesn't reproduce it.
- **One more moving part.** Redis is now something to run, monitor, and reason about failure for. `CACHE_ENABLED=false` exists specifically so the "what if Redis is down or misconfigured" case has an answer — the app degrades to Phase 1a behavior rather than throwing on every request.
- **Debuggability.** "The API returned the wrong price" now has two possible causes — a DB bug or a stale cache entry — and telling them apart requires checking the cache, not just the database.

## When this would NOT be worth it

- Read volume is low enough that Postgres already responds well within budget — `LAB01_DB_LATENCY_MS` exists here specifically to make the "hot read" problem visible; without it, adding Redis would be solving a problem that doesn't exist yet.
- The data changes on every read (e.g. real-time counters) — the cache would almost always be stale, so the hit rate that justifies the added complexity never materializes.
- Reads are spread across a large key space with low reuse per key (unlike this benchmark's single hot key) — cache misses would dominate, and the lookup itself becomes pure overhead on top of the Postgres query it didn't save.
- The team can't yet reason about invalidation correctness — a wrong cache is often worse than a slow one, because it fails silently instead of loudly.
