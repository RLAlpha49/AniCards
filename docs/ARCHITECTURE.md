# AniCards architecture

A high-level map of how the application fits together. This document is the durable reference — it won't track every in-flight change, but it should give you a reliable orientation to the core structure.

## Diagrams

- [`runtime-architecture.drawio`](./diagrams/runtime-architecture.drawio) — the top-level runtime map from request entrypoints to shared services.
- [`public-api-surface.drawio`](./diagrams/public-api-surface.drawio) — the public route families, canonical vs alias entrypoints, and the shared controls around them.
- [`security-request-flow.drawio`](./diagrams/security-request-flow.drawio) — the HTML CSP/nonce path plus the API protection branches for public reads, browser writes, SVG renders, and cron jobs.
- [`user-page-editor-flow.drawio`](./diagrams/user-page-editor-flow.drawio) — the user-facing editor flow, including first-time bootstrap and autosave.
- [`redis-persistence.drawio`](./diagrams/redis-persistence.drawio) — the Redis key layout behind split user storage and saved card configs.
- [`card-generation-pipeline.drawio`](./diagrams/card-generation-pipeline.drawio) — the end-to-end SVG render path from request through cache, data resolution, and template dispatch.
- [`data-lifecycle.drawio`](./diagrams/data-lifecycle.drawio) — the privacy-relevant data path from AniList ingestion through pruning to Redis storage and deletion.
- [`development-workflow.drawio`](./diagrams/development-workflow.drawio) — the local setup, validation gate, and contributor flow.
- [`analytics-consent-flow.drawio`](./diagrams/analytics-consent-flow.drawio) — the consent state management, Google Analytics bootstrap, and event tracking pipeline.
- [`card-type-taxonomy.drawio`](./diagrams/card-type-taxonomy.drawio) — every card family, its card types, supported variations, and the SVG template directory that renders each.
- [`component-hierarchy.drawio`](./diagrams/component-hierarchy.drawio) — the component nesting structure from root layout through providers and shells into route children.
- [`error-handling-flow.drawio`](./diagrams/error-handling-flow.drawio) — error capture from component throw through boundaries, structured reporting, and durable storage.

## Directory layout

AniCards runs on the Next.js App Router. For the visual component nesting, see [`component-hierarchy.drawio`](./diagrams/component-hierarchy.drawio). The main directories:

- `app/` — routes, layouts, route handlers, middleware, and metadata
- `components/` — reusable UI, shells, analytics wrappers, and page-specific building blocks
- `hooks/` — client hooks for analytics pageview tracking and editor helpers
- `lib/` — shared runtime logic: card generation, API utilities, persistence, CSP, SEO, and server-side data handling
- `tests/` — regression coverage

## How requests flow through the app

If you want the visual version first, start with [`runtime-architecture.drawio`](./diagrams/runtime-architecture.drawio). For the API-focused route map, jump to [`public-api-surface.drawio`](./diagrams/public-api-surface.drawio). For the hardening-specific view, jump to [`security-request-flow.drawio`](./diagrams/security-request-flow.drawio). For the user/editor-heavy path, jump to [`user-page-editor-flow.drawio`](./diagrams/user-page-editor-flow.drawio).

### HTML routes

Non-API page requests follow this path:

1. `proxy.ts` is the Next.js 16 interception entrypoint and delegates matched requests to `app/middleware.ts`.
2. The shared middleware logic creates a per-request request ID for all matched routes, and a CSP nonce for non-API HTML routes.
3. The middleware forwards the nonce through the `x-nonce` request header and sets the `Content-Security-Policy` response header.
4. `app/layout.tsx` reads that nonce via `getRequestNonce()` and passes it to nonce-aware inline scripts, including structured data and analytics bootstrap code.
5. Client-side analytics and consent UI live in `components/AnalyticsProvider.tsx`. That boundary keeps Google Analytics opt-in while leaving Vercel runtime telemetry on a separate deployment-controlled path. See [`analytics-consent-flow.drawio`](./diagrams/analytics-consent-flow.drawio) for the full consent → bootstrap → tracking pipeline.

### API requests

Most route handlers call `initializeApiRequest()` from `lib/api-utils.ts` — that's the centralized point for shared protections. It covers:

- request ID setup
- privacy-safe request logging
- shared rate limiting
- same-origin validation for browser-facing mutation routes
- shared JSON/text response helpers

Public read routes like `/api/get-user` and `/api/get-cards` deliberately skip same-origin checks so they function as open public APIs. They still apply bounded DTOs, CORS policy, and rate limiting.

Browser-facing write routes keep same-origin enforcement on by default. Cron routes deliberately skip browser-origin checks and layer `authorizeCronRequest()` on top. `/api/card` is the notable exception to the shared initializer path: it uses `ensureRequestContext()`, `checkRateLimit()`, and SVG-specific response headers directly because it serves cacheable SVG rather than JSON.

## Persistence model

The storage relationships in this section are also mapped in [`redis-persistence.drawio`](./diagrams/redis-persistence.drawio).

### User snapshots

User data goes to Upstash Redis through `lib/server/user-data.ts` as a split record keyed by stable per-part keys, with a `split-user-v2` commit pointer carrying commit metadata.

Rather than writing a single large JSON blob, AniCards stores broader sections separately:

- `meta`
- `activity`
- `favourites`
- `statistics`
- `pages`
- `planning`
- `current`
- `rewatched`
- `completed`
- `aggregates`

That split lets card rendering and API handlers load only what they actually need, while still allowing the app to reconstruct a bounded public user DTO when needed. The live `user:{id}:{part}` keys are stable; historical state lives in the commit metadata instead.

### Card configuration

Saved editor state is stored separately in `cards:{userId}` records:

- `userId`
- `cards`
- optional `globalSettings`
- `updatedAt`

Both user snapshot and card settings writes support optimistic concurrency through `ifMatchUpdatedAt`.

## External services

- **AniList GraphQL** — upstream source for profile and stats data
- **Upstash Redis / Ratelimit** — persistence, analytics counters, and rate limiting
- **Google Analytics** — consent-gated pageview tracking and bounded event telemetry when `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` is configured
- **Vercel Analytics / Speed Insights** — deployment-controlled runtime telemetry on Vercel deployments, separate from the Google Analytics consent state

## Public API boundaries

The public API contract is documented in `openapi.yaml`.

The current route families:

- public reads and compatibility routes: `/api/get-user`, `/api/get-cards`, `/api/card`, `/card.svg`, `/api/card.svg`, `/StatCards/{username}/{key}.svg`
- browser-facing writes and telemetry ingestion: `/api/store-users`, `/api/store-cards`, `/api/anilist`, `/api/error-reports`
- operator-only cron routes guarded by `x-cron-secret`

## Related docs

- [`SECURITY.md`](./SECURITY.md)
- [`PRIVACY.md`](./PRIVACY.md)
- [`../openapi.yaml`](../openapi.yaml)
