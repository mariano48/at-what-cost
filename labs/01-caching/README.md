# Lab 01 — Caching (Redis cache-aside)

> **Status:** Phase 1a done — core product API on Postgres, no cache yet. Phase 1b adds the Redis cache-aside layer and benchmark numbers below.

## Problem

A product catalog read (`GET /products/:id`) hits Postgres on every request. Under load, hot reads hammer the database even though the same handful of products are requested over and over.

## What's here now (Phase 1a)

- NestJS + Prisma product API, no caching — this is the "before" baseline
- `Product { id, sku, name, price, updatedAt }`, seeded with 10,000 synthetic rows
- `LAB01_DB_LATENCY_MS` (default `50`) adds artificial latency to every DB read, so the cost of skipping the cache is visible even before Phase 1b lands
- `GET /metrics` exposes a running `dbQueryCount` counter

## Run it

```bash
# From the repo root
pnpm run infra:up          # Postgres + Redis via Docker Compose
pnpm run lab:01:migrate     # create the products table
pnpm run lab:01:seed        # seed 10,000 products
pnpm run lab:01             # start the API on :3001 (or LAB01_PORT)
```

## Endpoints

| Method  | Path            | Notes                                  |
| ------- | --------------- | --------------------------------------- |
| `GET`   | `/health`       | Liveness check                          |
| `GET`   | `/metrics`      | `{ dbQueryCount }`                      |
| `GET`   | `/products`     | Paginated list — `?page=&pageSize=`     |
| `GET`   | `/products/:id` | Single product, 404 if missing          |
| `PATCH` | `/products/:id` | Update `name` and/or `price`            |

```bash
curl localhost:3001/products/1
curl "localhost:3001/products?page=1&pageSize=10"
```

## NestJS vs plain Express

Cache-aside will hang off an injected `CACHE_MANAGER` provider (Phase 1b) rather than a Redis client instantiated and threaded through route handlers by hand — same idea, but DI keeps `ProductsService` testable without spinning up real Redis.

## Coming in Phase 1b

- `@nestjs/cache-manager` + Redis, `CACHE_ENABLED` toggle, cache-aside in `ProductsService`
- `PATCH` invalidates the cache key on write
- `scripts/benchmark.ts` (autocannon) — p50/p99 and req/sec, cache off vs on, pasted into this README
- Short note on cache stampede + TTL strategy
