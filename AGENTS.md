# Agent instructions

Public standard: [docs/public-contract.md](docs/public-contract.md).

Author session notes live in `.cursor/docs/` (gitignored, local only). @-mention `.cursor/docs/status.md` for current focus and phase checklist.

## Commands

```bash
pnpm install
cp .env.example .env
pnpm run infra:up
pnpm run lab:01:migrate && pnpm run lab:01:seed
pnpm run lab:01
pnpm run lab:01:benchmark   # separate terminal, cache on/off
```

## Conventions

- Lab-specific learnings → lab READMEs. Repo-wide decisions → `docs/decisions/`.
- Do not commit secrets (`.env`). Synthetic data only — see ADR 0003.
- Match existing code style; minimal diffs.
