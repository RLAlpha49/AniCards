# AniCards architecture

This document gives a durable, high-level view of how the current AniCards application is put together.

## Top-level layout

AniCards is built on the Next.js App Router, and the repository is organized around a few core directories:

- `app/` — routes, layouts, route handlers, middleware, and metadata.
- `components/` — reusable UI, shells, analytics wrappers, and page-specific building blocks.
- `hooks/` — client hooks such as analytics pageview tracking and editor helpers.
- `lib/` — shared runtime logic for card generation, API utilities, persistence, CSP, SEO, and server-side data handling.
- `tests/` — regression coverage.

## Request and rendering flow

### Web app requests

For non-API HTML routes, request handling follows this path:

1. `app/middleware.ts` runs first.
2. It creates a per-request CSP nonce and request ID.
3. The middleware forwards the nonce through the `x-nonce` request header and also sets the `Content-Security-Policy` response header.
4. `app/layout.tsx` reads that nonce with `getRequestNonce()` and passes it to nonce-aware inline scripts, including structured data and analytics bootstrap code.
5. Client-only analytics and consent UI live in `components/AnalyticsProvider.tsx`.

### API requests

Most route handlers call `initializeApiRequest()` from `lib/api-utils.ts` so shared protections stay centralized. That includes:

- request ID setup
- privacy-safe request logging
- shared rate limiting
- same-origin validation for browser-facing mutation routes
- shared JSON/text response helpers

Public read routes such as `/api/get-user` and `/api/get-cards` deliberately do not enforce same-origin checks so they can function as public APIs. They still rely on bounded DTOs, CORS policy, and rate limiting.

## Persistence model

### User snapshots

User data is stored in Upstash Redis through `lib/server/user-data.ts` as a versioned split record named `split-user-v2`.

Rather than writing a single large JSON blob, AniCards stores broader sections separately, including:

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

That split approach allows card rendering and API handlers to load only the parts they need, while still letting the app reconstruct a bounded public user DTO.

### Card configuration

Saved editor state is stored separately in `cards:{userId}` records. Those records include:

- `userId`
- `cards`
- optional `globalSettings`
- `updatedAt`

The current server implementation supports optimistic concurrency through `ifMatchUpdatedAt` when writing both user snapshots and card settings.

## External boundaries

### Upstream services

- **AniList GraphQL** — the upstream source for profile and stats data.
- **Upstash Redis / Ratelimit** — used for persistence, analytics counters, and rate limiting.
- **Google Analytics** — consent-gated pageview tracking and bounded event telemetry when `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` is configured.
- **Vercel Analytics / Speed Insights** — consent-gated runtime telemetry on Vercel deployments.

## Public API boundaries

The public API contract is documented in `openapi.yaml`.

The current route families are broadly grouped as:

- public reads: `/api/get-user`, `/api/get-cards`, `/api/card`
- browser-facing writes: `/api/store-users`, `/api/store-cards`, `/api/anilist`, `/api/error-reports`
- operator-only cron routes guarded by `x-cron-secret`

## Related docs

- [`SECURITY.md`](./SECURITY.md)
- [`PRIVACY.md`](./PRIVACY.md)
- [`../openapi.yaml`](../openapi.yaml)
