# ADR 0004: Events are not microservices (modular monolith first)

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

Lab 02 decouples a checkout flow: instead of running order update, receipt email, and audit inline, `CheckoutService` emits a `PaymentCompleted` domain event and independent handlers react. A common reading of "decoupled with events" is that each side effect should become its own deployable service (a payments API, an orders service, a notifications service, an audit service) talking over a message broker. The real-world system this lab is shaped after did lean that way.

But those are two different decisions wearing the same word:

- **Decoupling** — _who reacts when something happens_, and whether one side effect's failure takes down the others. This lives at the code / module boundary.
- **Distribution** — _which process (and host) each piece runs in_. This lives at the deployment boundary and is driven by load profile, independent scaling, and team ownership.

Lab 02 exists to make the first cost visible (see its failure-isolation table: monolith returns 500 with the audit skipped; events returns 2xx with the audit still committed). Splitting into separate processes to show that would add a broker, network hops, serialization, partial-failure handling, and deployment topology — none of which are required to demonstrate the decoupling, and all of which would bury the single cost the lab is trying to measure.

NestJS supports both paths: `@nestjs/event-emitter` (in-process) and `@nestjs/microservices` (transport-backed). The choice here is deliberate, not a limitation we backed into.

## Decision

Lab 02 stays a single Nest app — a modular monolith. Decoupling is expressed with **in-process domain events** via `@nestjs/event-emitter` and `@OnEvent` handlers, behind the `ARCHITECTURE=monolith|events` toggle. No message broker, no separate services.

Process splitting is treated as a separate, later decision driven by load profile and independent scaling (roadmap Lab 04), not a prerequisite for demonstrating decoupling. The public README and `PLAN.md` state "events, not microservices" explicitly so the two decisions are not conflated.

## Alternatives considered

- **Separate services per side effect + a broker (Redis / NATS / RabbitMQ).** Mirrors one real topology, but conflates decoupling with distribution and drowns the lab's one measurable cost under transport and infra plumbing. It also duplicates the operational concerns (broker, delivery guarantees, cross-service tracing) that later labs isolate on purpose. Rejected for this lab's scope, not rejected in general.
- **Stay inline forever (no events).** That is the monolith baseline — the problem the lab starts from, not an alternative to it.

## Consequences

- Failure isolation is demonstrated with one process, one repo, one deploy — cheap to run and to read end-to-end.
- **The cost this trades for that simplicity:** in-process events share the process's fate. They are synchronous DI wiring, not durable messaging — if the app crashes between the response and the handlers finishing, those side effects are lost, with no queue and no replay. Durability (outbox / durable queue) is deliberately **Lab 03's boundary**, named in Lab 02's README but not built there.
- Because there is no broker, at-least-once delivery, consumer idempotency, and cross-service tracing do not appear yet. When a later lab distributes processes, those costs arrive and have to be addressed then (idempotency is the intended subject of a future Lab 05).
- "Events" in this repo must not be read as "microservices." Keeping that explicit is itself a maintenance cost: new labs and docs have to hold the line so the modular-monolith framing stays consistent.
