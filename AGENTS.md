# Agent instructions

Public standard: [docs/public-contract.md](docs/public-contract.md).

Author session notes live in `.cursor/docs/` (gitignored, local only). @-mention `.cursor/docs/status.md` for current focus and phase checklist.

## Commands

```bash
# Setup
pnpm install
cp .env.example .env
pnpm run infra:up               # Postgres + Redis (Docker Compose)

# Lab 01 — caching
pnpm run lab:01:migrate && pnpm run lab:01:seed
pnpm run lab:01
pnpm run lab:01:benchmark       # separate terminal, cache on/off

# Lab 02 — pub/sub (ARCHITECTURE=monolith|events toggle)
pnpm run lab:02:migrate         # first run only, creates the lab02 schema
pnpm run lab:02
pnpm run lab:02:demo            # monolith-vs-events failure-isolation table

# Quality gates (run before committing; all must pass)
pnpm run typecheck
pnpm run build
pnpm run lint
pnpm run test
```

Lab 03 is not implemented yet (`pnpm run lab:03` exits with a message).

## Conventions

- Lab-specific learnings → lab READMEs. Repo-wide decisions → `docs/decisions/`.
- Do not commit secrets (`.env`). Synthetic data only — see ADR 0003.
- Match existing code style; minimal diffs.
