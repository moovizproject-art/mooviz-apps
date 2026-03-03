# ADR-001: Monorepo Structure

## Status
Accepted

## Context
MOOVIZ consists of multiple applications (mobile app, admin panel) and shared backend
services (Cloud Functions). These components share types, validation logic, and
configuration. We need a repository structure that supports code sharing, consistent
tooling, and efficient CI/CD.

## Decision
Use a monorepo managed by Turborepo with pnpm workspaces.

### Structure
```
mooviz/
  apps/
    admin/     — React admin panel (Vite + TypeScript)
    mobile/    — React Native mobile app (Expo)
  functions/   — Firebase Cloud Functions
  shared/      — Shared types, utils, validation
```

### Why Turborepo
- Parallel task execution across workspaces
- Intelligent caching (local and remote)
- Dependency-aware build ordering
- Minimal configuration overhead

## Consequences
- All team members work in a single repository
- Shared code changes are immediately available to all consumers
- CI builds all workspaces together, catching cross-workspace issues early
- Requires pnpm for workspace management (npm/yarn workspaces are an alternative)
