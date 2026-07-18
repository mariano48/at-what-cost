# ADR 0003: Synthetic domain data, no real employer code

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The god-service problem Lab 02 is built around — a single service doing charge, entity update, email, and audit in one sequential flow — is a real pattern I've seen and worked with. That original code and domain can't be published: it belongs to an employer.

The learning path this repo sits in (private sandbox → public DDD repo → this repo) exists precisely to bridge that gap: the earlier, optional private step is where real-problem-shaped refactoring can happen without public exposure.

## Decision

Rebuild the same *shape* of problem — payment processing coupled to notification and audit side effects — using a synthetic products/orders/checkout domain with fake payment providers and simulated (not real) mail/audit delays. No employer-specific naming, data, or business logic.

## Consequences

- The repo is safe to make public and link from a resume/portfolio without review risk.
- The domain has to be realistic enough that the god-service problem and its fix are still legible and convincing to a reviewer, even though the entities (`Product`, `Order`, `Payment`) are generic.
- Any future lab added to this repo follows the same constraint by default.
