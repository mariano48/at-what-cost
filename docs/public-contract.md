# Public contract

What this repo commits to publicly. Author planning notes live in `.cursor/docs/` (local, gitignored).

## What this repo is

Hands-on labs that show **one scaling decision at a time**: symptom → baseline toggle → pattern toggle → measured cost → when NOT.

Patterns reflect **symptoms from production experience**, rebuilt with a **synthetic domain** ([ADR 0003](decisions/0003-synthetic-data-no-proprietary-code.md)). No employer code, naming, or infra.

## What it is not

- A copy of a work codebase or its architecture
- A claim that any pattern is always correct
- One combined demo where every pattern runs at once

## Synthetic but grounded

Authenticity means **transferable judgment**, not identical artifacts:

| Publishable | Not publishable |
| --- | --- |
| Generic symptoms (hot reads, coupled checkout, slow HTTP) | Work domain, code, or topology |
| Before/after toggles and benchmarks you ran locally | Prod metrics or employer context |
| Named costs (staleness, tracing, idempotency) | "At my company we…" |

Lab 01 (Redis cache-aside on a hot read) matches how that pattern was applied in practice. Later labs follow the same shape — not a stack pivot for its own sake.

## Separate labs, related reality

In production, cache, events, and job queues often **compose**. This repo **isolates** each decision so one cost stays visible and one toggle stays measurable.

| Lab | Question | Baseline | With pattern |
| --- | --- | --- | --- |
| **01 — Caching** | Fewer DB hits worth staleness? | No cache | Redis cache-aside |
| **02 — Pub/Sub** | Decouple side effects worth losing one flow? | Monolith / inline | Domain events |
| **03 — Workers** | Async worth losing immediate feedback? | Sync in request | Queue + worker |

"Aren't 02 and 03 both async?" — yes at the architecture level. The split is **intentional for teaching**, not a claim they're unrelated. Lab 02: *who reacts when something happens*. Lab 03: *when heavy work leaves the HTTP path*.

## Every lab README (minimum)

Each lab must include:

1. **Pitch** — one question, two sentences
2. **Run it** — toggle + commands
3. **The number** — benchmark you ran
4. **What it costs** + **when NOT**
5. **Related labs** — links only, no re-explanations

## Non-goals (frozen)

- No merge of labs into one workflow
- No Lab 01 technology swap — it is the template
- No work-case detail in public docs

## Where detail lives

| Doc | Role |
| --- | --- |
| [documentation-philosophy.md](documentation-philosophy.md) | Standard — costs, when-not, no evangelism |
| [PLAN.md](PLAN.md) | Build order and lab designs |
| [decisions/](decisions/) | ADRs for repo-level choices |
