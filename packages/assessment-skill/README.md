# `@ailiangbiao/assessment-skill`

This package is the extraction target for the platform's skill core.

## Current Scope

- Agent session auth/token helpers
- Skill route contracts and path builders
- Server-side skill adapters for:
  - scale catalog
  - scale evaluation
  - member context
  - memory summary / writeback

## Current Constraints

- Still depends on the host app's Prisma client and scale catalog via app aliases
- Still assumes the host app provides runtime env, auth headers, and API wrappers
- Is not yet published as a standalone npm package

## Goal

This package exists so the current monorepo can stabilize imports and boundaries before:

1. moving the package into its own repository
2. replacing app-specific adapters with injectable ports
3. exposing a standalone service for Web/UI and OpenClaw to consume

## Stable Public Surface

- `@ailiangbiao/assessment-skill`
- `@ailiangbiao/assessment-skill/routes`
- `@ailiangbiao/assessment-skill/server`
- `@ailiangbiao/assessment-skill/contracts`
