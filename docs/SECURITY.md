# AniCards security notes

This document is the long-lived reference for the security-sensitive behavior that existing code comments point to.

## Content Security Policy (CSP)

AniCards applies a nonce-based CSP on HTML routes.

### How the nonce flow works

1. `app/middleware.ts` creates a new 128-bit nonce for each matching request.
2. The middleware calls `buildCSPHeader()` from `lib/csp-config.ts` and adds that nonce to `script-src`.
3. The nonce is passed into the app through the `x-nonce` request header.
4. `app/layout.tsx` reads the header with `getRequestNonce()` and passes the nonce to components that render inline scripts.

This allows inline scripts to work under a strict CSP without relying on `unsafe-inline` for scripts.

### Development-only `unsafe-eval`

`app/middleware.ts` passes `allowUnsafeEval: process.env.NODE_ENV !== "production"` into `buildCSPHeader(...)`.

In practice, that means:

- production keeps the stricter nonce-based policy
- development allows `unsafe-eval` only so Next.js/Turbopack debugging tooling can run

### Allowed CSP sources

The shared directive list is defined in `lib/csp-config.ts`.

Notable allowlists include:

- AniCards same-origin assets
- AniList GraphQL
- Upstash
- Google Analytics / Google Tag Manager
- Vercel Analytics / Speed Insights
- Google Fonts

### Nonce-bearing inline scripts during hydration

Browsers redact nonce attributes during hydration. Any inline script component that renders nonce-bearing markup should follow the existing hydration-safe pattern already used in the app, including `suppressHydrationWarning` where needed.

## Static response hardening

`next.config.ts` defines the static security headers that do not rely on a per-request nonce:

- `X-DNS-Prefetch-Control: on`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

CSP is not duplicated there because middleware generates it dynamically.

## Route protections

### Shared API protections

`lib/api-utils.ts` is the shared home for common API protections:

- shared rate limiting
- request ID creation and propagation
- privacy-safe logs
- structured JSON/text helpers
- same-origin enforcement for browser-facing mutation routes

Most browser-facing `POST` routes call `initializeApiRequest()`, so they pick up rate limiting and same-origin checks by default.

### Public read routes

Some routes are intentionally public and skip same-origin validation so consumers can read stored or rendered public data:

- `/api/get-user`
- `/api/get-cards`
- `/api/card` and its aliases

Those routes still enforce bounded DTOs, CORS policy, and rate limiting.

### Operator-only cron routes

Cron endpoints use `authorizeCronRequest()` and require `x-cron-secret` when `CRON_SECRET` is configured.

In development only, unsecured cron access can be enabled with `ALLOW_UNSECURED_CRON_IN_DEV=true`. That is a local-development escape hatch, not a production posture.

## Abuse controls

The repository already uses shared Upstash rate limiting.

Examples:

- default shared limiter: `10 / 5s`
- public card rendering route: `150 / 10s`
- public stored-user and stored-card reads: `60 / 10s`

## Data minimization and logging

Security and privacy intentionally overlap here.

Implemented guardrails include:

- request logs are emitted through `logPrivacySafe(...)`
- IP addresses are redacted before persistence/logging
- persisted user records only retain `requestMetadata.lastSeenIpBucket`, not raw IP values
- `/api/get-user` returns a bounded public DTO that omits internal request metadata and record timestamps

## Related docs

- [`PRIVACY.md`](./PRIVACY.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
