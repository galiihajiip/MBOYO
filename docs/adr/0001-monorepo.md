# ADR 0001 — pnpm + Turborepo Monorepo

## Status

Accepted

## Context

MBOYO consists of three deployable applications (`apps/web`, `apps/ml-api`, `apps/worker`) and several shared packages (`packages/ui`, `packages/domain`, `packages/api-client`, shared lint/TS configs) that must stay in lockstep — e.g., a change to the report schema in `packages/domain` affects both the Next.js form validation and the FastAPI/worker payload contract. Polyrepo would require versioning and publishing internal packages, adding release overhead disproportionate to a single-team capstone project, and increasing the risk of drift between `apps/web`'s expectations and `apps/ml-api`'s actual contract.

## Decision

Use a single repository with pnpm workspaces for dependency management and Turborepo for build/task orchestration and caching. TypeScript packages (`apps/web`, `packages/*`) are linked via workspace protocol; Python apps (`apps/ml-api`, `apps/worker`) live in the same repo but are managed with their own Python tooling (not pnpm), sharing only documentation and CI orchestration with the JS/TS side.

## Consequences

- Shared types/schemas in `packages/domain` are a single source of truth consumed directly by `apps/web`, eliminating an entire class of contract-drift bugs between BFF and its consumers.
- Turborepo caching keeps CI/build times manageable as the repo grows, and allows running only the affected apps' checks on a given change.
- A single PR can span `apps/web` and `packages/domain` atomically, matching the "runnable and independently reviewable" per-block discipline in [WORKING_CONTRACT.md](../product/WORKING_CONTRACT.md).
- Python and TypeScript coexist in one repo without a unified package manager across languages — CI must orchestrate both toolchains (pnpm for TS, pip/poetry-equivalent for Python) rather than relying on one tool for everything.
- The architecture boundaries in [AGENTS.md](../../AGENTS.md) (e.g., `apps/web` never importing directly from `ml/`) must be enforced by convention and lint rules, since a monorepo makes it *technically* easy to reach across boundaries that should stay separated by trust domain.

## Alternatives Considered

- **Polyrepo (separate repos per app):** rejected — adds release/versioning overhead and contract-drift risk disproportionate to team size and project stage.
- **Nx instead of Turborepo:** viable alternative with similar caching benefits; Turborepo chosen for its lighter configuration surface and tight fit with the Next.js-centric stack, without a strong reason to prefer Nx's additional features for this project's scale.
