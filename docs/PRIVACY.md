# AniCards privacy notes

This document summarizes the privacy posture currently implemented in the repository. It is intended as a maintainer-facing technical note, not a legal commitment and not a replacement for review of any public-facing privacy policy.

## Data categories currently handled by the repo

### Persisted AniList-derived user snapshots

`/api/store-users` persists a minimized server-side record derived from AniList data.

The persisted shape currently includes:

- `userId`
- optional `username`
- `stats` (AniList-derived user, list, favourites, and related page data)
- optional derived `aggregates`
- `createdAt`
- `updatedAt`
- optional `requestMetadata.lastSeenIpBucket`

The current write path does not intentionally persist raw IP addresses.

### Persisted card editor configuration

`/api/store-cards` stores:

- `userId`
- per-card settings
- optional global settings
- `updatedAt`

### Browser-stored consent state

Analytics consent is stored client-side in local storage under:

- `anicards:analytics-consent:v1`

Allowed values are `granted` and `denied`, while `unset` is treated as the default state before a user makes a choice.

### Consented telemetry

When analytics is enabled and the user has granted consent, the app can send:

- pageview events with normalized route patterns
- bounded custom event labels
- bounded error categories

Before sending, the code intentionally redacts or normalizes route and label values that look sensitive.

### Structured error reports

The app also supports structured error reporting through `/api/error-reports`.

Those reports can include sanitized versions of:

- error message
- error name
- route
- stack / component stack
- bounded metadata
- optionally redacted user identifiers

## Third-party and infrastructure services currently in use

The codebase currently integrates with these external services:

- **AniList GraphQL** — upstream source for profile and statistics data
- **Upstash Redis / Ratelimit** — persistence, analytics counters, and retention-limited reports
- **Google Analytics / Google Tag Manager** — consent-gated analytics when `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` is configured
- **Vercel Analytics / Speed Insights** — consent-gated runtime telemetry when deployed on Vercel

## Analytics consent model

The implemented consent model is opt-in.

Current behavior:

- analytics is disabled by default
- the consent banner appears only when a tracking ID is configured
- granting consent enables Google Analytics pageviews and events
- Vercel Analytics and Speed Insights render only when consent is granted and the app is running on Vercel
- denying or revoking consent stops future analytics events from being sent

Google Analytics is configured with:

- `anonymize_ip: true`
- `allow_google_signals: false`
- `allow_ad_personalization_signals: false`
- consent mode defaults with ad-related storage denied

## Retention and lifecycle notes

### User snapshots and saved cards

The current code does **not** apply a general TTL to saved user snapshots or card settings.

At present, those records remain until one of the following occurs:

- they are overwritten by a newer save
- maintainers invoke the delete path
- the scheduled stale-user refresh flow removes a user after repeated AniList 404s

The cron refresh route deletes a stored user after **three consecutive** scheduled 404 refresh failures. That delete path also removes:

- saved cards
- username aliases
- failure tracking keys
- versioned user snapshots

### Analytics reports

`/api/cron/analytics-reporting` stores generated analytics reports in a bounded Redis list.

Current cap:

- maximum stored reports: **50**

### Structured error report retention

Structured error reports are stored in a bounded Redis list.

Current cap:

- maximum stored error reports: **250**

### Aggregate counters

The repository increments analytics counters under `analytics:*` Redis keys.

Those counters are currently limited by operational cleanup and reporting patterns, but the code shown here does **not** assign a per-key TTL to the underlying raw counters.

## Public access and data minimization

The public `/api/get-user` response is intentionally designed to omit internal persistence metadata such as:

- request IP buckets
- internal record timestamps

That route returns a bounded public DTO instead of the full internal storage shape.

## Export and deletion path today

The repository currently does **not** provide a public self-serve API for exporting or deleting saved AniCards user/card data on the server side.

What exists today:

- maintainers have a server-side delete primitive in `lib/server/user-data.ts`
- the UI includes local settings export/import helpers for editor settings JSON
- those local exports are not equivalent to deleting or exporting server-side stored user snapshots

Until a self-serve flow exists, deletion and export requests require manual maintainer handling. The repository's current contact channel is `contact@alpha49.com`.

## Related docs

- [`SECURITY.md`](./SECURITY.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
