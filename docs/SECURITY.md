# AniCards security notes

The long-lived reference for security-sensitive behavior in the codebase. Code comments throughout the app point here — that's intentional.

## Supporting diagrams

- [`security-request-flow.drawio`](./diagrams/security-request-flow.drawio) — the HTML CSP/nonce path plus the API protection branches for public reads, browser writes, SVG renders, and cron jobs.
- [`runtime-architecture.drawio`](./diagrams/runtime-architecture.drawio) — the broader runtime map showing where middleware, layouts, API routes, Redis, and telemetry sit relative to each other.
- [`card-generation-pipeline.drawio`](./diagrams/card-generation-pipeline.drawio) — the card render pipeline showing where rate limiting, cache layers, and data validation sit in the SVG path.
- [`error-handling-flow.drawio`](./diagrams/error-handling-flow.drawio) — the error handling chain from component throw through boundaries, structured reporting, and the `/api/error-reports` ingestion endpoint.

## Content Security Policy

AniCards applies a nonce-based CSP on all HTML routes. No `unsafe-inline` for scripts.

### The nonce flow

1. `proxy.ts` receives the matched request under the Next.js 16 convention and delegates into `app/middleware.ts`.
2. `app/middleware.ts` creates a fresh request ID for matched routes, and a fresh 128-bit nonce for non-API HTML routes.
3. The middleware calls `buildCSPHeader()` from `lib/csp-config.ts` and includes that nonce in `script-src`.
4. The nonce travels into the app via the `x-nonce` request header.
5. `app/layout.tsx` reads it with `getRequestNonce()` and passes it to any component that renders inline scripts.

### Development `unsafe-eval`

`app/middleware.ts` passes `allowUnsafeEval: process.env.NODE_ENV !== "production"` into `buildCSPHeader(...)`.

What that actually means:

- production retains the strict nonce-based policy
- development allows `unsafe-eval` so Next.js/Turbopack debugging tools can run

### Allowed CSP sources

The directive list is defined in `lib/csp-config.ts`. Notable allowlists cover:

- AniCards same-origin assets
- AniList GraphQL
- Upstash
- Google Analytics / Google Tag Manager
- Vercel Analytics / Speed Insights
- Google Fonts

### Nonce and hydration

Browsers strip nonce attributes during hydration. Inline script components carrying nonce-bearing markup should follow the established pattern already used in the app — including `suppressHydrationWarning` where it applies. Look at existing implementations before adding new nonce-bearing scripts.

## Static response hardening

`next.config.ts` defines security headers that don't need a per-request nonce:

- `X-DNS-Prefetch-Control: on`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

CSP is excluded here — middleware generates it dynamically.

## Route protections

### Shared API protections

`lib/api-utils.ts` centralizes the common API protections:

- shared rate limiting
- request ID creation and propagation
- privacy-safe logging
- structured JSON/text response helpers
- same-origin enforcement for browser-facing mutation routes

Calling `initializeApiRequest()` gives a route handler all of that automatically.

The main exception is `/api/card`, which serves SVG and therefore uses `ensureRequestContext()`, `checkRateLimit()`, and `svgHeaders()` directly instead of the shared JSON initializer path.

### Public read routes

Some routes intentionally skip same-origin validation — they're designed to work as public endpoints:

- `/api/get-user`
- `/api/get-cards`
- `/api/card` and its aliases

These still enforce bounded DTOs, CORS policy, and rate limiting.

### Operator cron routes

Cron endpoints use `authorizeCronRequest()` and require an `x-cron-secret` header whenever `CRON_SECRET` is configured.

There's a local-dev escape hatch: `ALLOW_UNSECURED_CRON_IN_DEV=true` bypasses that check in development. That's a local-development escape hatch only — not a production posture.

## Abuse controls

Shared Upstash rate limiting is applied throughout the repository.

Current limits:

- default shared limiter: `10 / 5s`
- public card rendering route: `150 / 10s`
- public stored-user and stored-card reads: `60 / 10s`

## Data minimization and logging

Security and privacy overlap here in ways worth calling out explicitly.

The implemented guardrails:

- request logs go through `logPrivacySafe(...)`
- IP addresses are redacted before persistence or logging
- persisted user records retain only `requestMetadata.lastSeenIpBucket`, never raw IPs
- `/api/get-user` returns a bounded public DTO that strips internal request metadata and record timestamps

## Related docs

- [`PRIVACY.md`](./PRIVACY.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
