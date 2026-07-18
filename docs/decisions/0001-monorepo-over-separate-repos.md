# ADR 0001: One monorepo instead of three separate repos

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

Each lab (caching, pub/sub, background workers) is independently runnable and could live in its own GitHub repo. The alternative is one repo with a `labs/*` folder per pattern.

This repo is meant to be browsed by someone evaluating my work, not just run by me. That changes the calculus versus a typical multi-package split: discoverability and narrative continuity matter as much as isolation.

## Decision

Use a single pnpm-workspace monorepo (`shared/` + `labs/*`), each lab runnable independently via its own `pnpm run lab:0N`, sharing one `docker-compose.yml` and one `shared/` package for config/logging/types.

## Alternatives considered

- **Separate repo per lab.** True isolation, and each lab could have its own CI/release cadence. Rejected for now because a reviewer would have to hop across three sparse-looking repos instead of landing on one README with a clear index, and I'd be duplicating the Postgres/Redis Docker setup and lint/typecheck config three times for no real benefit at this scale.

## Consequences

- One README is the front door; the lab table there is the primary navigation.
- Shared infra (`docker-compose.yml`, `shared/lib`) has to stay generic enough that no lab depends on another lab's internals.
- If a lab outgrows "demo you can run in 5 minutes" and becomes a tutorial people fork on its own, it should be split out at that point — this isn't a permanent structural bet, just the right one for the current scope.
