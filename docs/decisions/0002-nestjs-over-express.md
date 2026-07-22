# ADR 0002: NestJS instead of plain Express

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

My day-to-day work stack is Express + JS. I could build these labs the same way, which would be faster to write, or use this as a deliberate opportunity to work in a framework with more structure and see how it changes the shape of the same problems.

The three patterns being demonstrated — caching, pub/sub, background workers — all have first-class, documented modules in NestJS (`@nestjs/cache-manager`, `@nestjs/event-emitter`, `@nestjs/bullmq`). That's directly relevant: Lab 02 in particular decouples a checkout flow into independent side-effect handlers (`orders`, `notifications`, `audit`) within one app, which is exactly the kind of thing Nest's module/DI system and event emitter are built for. (The labs stay as a modular monolith on purpose — splitting into separate processes is an operational, load-profile decision, not what these labs measure.)

## Decision

Build all labs in NestJS 11 + TypeScript, and call out the "NestJS vs plain Express" trade-off explicitly in each lab's README rather than leaving it implicit.

## Alternatives considered

- **Plain Express, matching the work stack.** Faster to write, but would mean re-deriving DI, module boundaries, and validation from scratch instead of demonstrating them, and would blur the actual point of the repo (patterns, not framework plumbing).

## Consequences

- More upfront framework learning curve, offset by first-class integrations for exactly the three patterns being demoed.
- Each lab README needs a short explicit callout on what Nest is buying versus Express, so the choice reads as deliberate rather than default.
