# AniCards privacy notes

A maintainer-facing technical summary of the privacy posture baked into the repository. Not a legal document — not a substitute for a real privacy policy review. Just a plain account of what data the code handles and how.

The app also exposes a public-facing summary at `/privacy`. That page is likewise a product disclosure, not a legal privacy policy.

## Storage map

- [`redis-persistence.drawio`](./diagrams/redis-persistence.drawio) — the server-side Redis keys, lookup indexes, saved card records, and lifecycle audit list discussed below.
- [`data-lifecycle.drawio`](./diagrams/data-lifecycle.drawio) — the full data lifecycle from AniList ingestion through validation and pruning to Redis storage, plus the deletion and cleanup flow.
- [`user-page-editor-flow.drawio`](./diagrams/user-page-editor-flow.drawio) — the higher-level client/editor flow that shows where autosave and local draft backup fit around the server-side records.
- [`analytics-consent-flow.drawio`](./diagrams/analytics-consent-flow.drawio) — the consent state management, Google Analytics bootstrap, and tracking pipeline including where consent gates sit.

## Data currently handled by the repo

### Persisted AniList-derived user snapshots

`/api/store-users` persists a minimized server-side record built from AniList data.

The stored shape currently looks like this:

- `userId`
- optional `username`
- `stats` — AniList-derived user, list, favourites, and related page data
- optional derived `aggregates`
- `createdAt`
- `updatedAt`
- optional `requestMetadata.lastSeenIpBucket`

The write path does not intentionally persist raw IP addresses. The only active request-level field is an optional coarse IP bucket such as `203.0.x.x`, `ipv6`, or `loopback`.

### Persisted card editor configuration

`/api/store-cards` stores:

- `userId`
- per-card settings
- optional global settings
- `updatedAt`

### Browser-stored consent state

Analytics consent lives client-side in local storage under:

- `anicards:analytics-consent:v1`

Values are `granted` or `denied`. The `unset` state is the default before a user makes a choice — Google Analytics stays off until they actively grant it.

### Google Analytics telemetry

When Google Analytics is configured and the user has granted consent, the app may send:

- pageview events with normalized route patterns
- bounded custom event labels
- bounded error categories

Route and label values that look sensitive are intentionally redacted or normalized before transmission.

### Runtime telemetry

When AniCards is deployed on Vercel with runtime telemetry enabled, the app also renders:

- **Vercel Analytics**
- **Vercel Speed Insights**

These runtime signals are not gated behind the Google Analytics consent toggle.

### Structured error reports

The app supports structured error reporting through `/api/error-reports`.

Those reports can include sanitized versions of:

- error message
- error name
- route
- stack / component stack
- bounded metadata

Client-supplied `userId` and `username` fields are ignored by this route and are not persisted as part of the structured error report payload.

## Third-party and infrastructure services

The codebase touches these external services:

- **AniList GraphQL** — upstream source for profile and statistics data
- **Upstash Redis / Ratelimit** — persistence, analytics counters, and retention-limited reports
- **Google Analytics / Google Tag Manager** — consent-gated analytics when `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` is configured
- **Vercel Analytics / Speed Insights** — runtime telemetry enabled on Vercel deployments when the app turns on runtime telemetry

## Analytics consent model

The Google Analytics consent model is opt-in. No gray area here.

How it works:

- Google Analytics is disabled by default
- the consent banner only appears when a tracking ID is actually configured
- granting consent enables Google Analytics pageviews and events
- Vercel Analytics and Speed Insights render whenever runtime telemetry is enabled and the app is running on Vercel
- revoking consent stops future Google Analytics events immediately

Google Analytics is initialized with:

- `anonymize_ip: true`
- `allow_google_signals: false`
- `allow_ad_personalization_signals: false`
- consent mode defaults with ad-related storage denied

## Retention and lifecycle

### User snapshots and saved cards

There is currently no general TTL applied to saved user snapshots or card settings.

Records stick around until one of the following occurs:

- a newer save overwrites them
- maintainers invoke the delete path directly
- the scheduled stale-user refresh flow removes a user after repeated AniList 404s

That cron flow deletes a stored user after **three consecutive** scheduled 404 refresh failures. The deletion also clears:

- saved cards
- username aliases
- failure tracking keys
- user snapshots

### Analytics reports

`/api/cron/analytics-reporting` stores generated analytics reports in a bounded Redis list.

Cap:

- maximum stored reports: **50**

### Structured error report retention

Error reports are stored in a bounded Redis list.

Cap:

- maximum stored error reports: **250**

### User lifecycle audit trail

Server-side lifecycle audit entries are stored in a bounded Redis list.

Cap:

- maximum stored lifecycle audit entries: **250**

### Aggregate counters

Analytics counters are stored as monthly bucket keys under `analytics:*:month:YYYY-MM`.

Retention posture:

- each monthly counter bucket receives a **400-day TTL** when updated
- raw analytics counters are therefore retained for roughly **13 months**, not indefinitely
- `/api/cron/analytics-reporting` still reads the bounded monthly buckets when generating reports

### Failed update counters

The scheduled stale-user refresh flow keeps repeated AniList 404 counters under `failed_updates:{userId}`.

Retention posture:

- each failure counter receives a **14-day TTL** when updated
- a stored user is removed after **three consecutive** scheduled 404 refresh failures inside that window

## Public access and data minimization

The public `/api/get-user` response is deliberately designed to omit internal persistence metadata — things like request IP buckets and internal record timestamps. It returns a bounded public DTO rather than the full internal storage shape.

## Export and deletion

There is currently no public self-serve API for exporting or deleting server-side stored data.

What actually exists today:

- maintainers have a server-side delete primitive in `lib/server/user-data.ts`
- the UI includes local settings export/import helpers for editor settings JSON
- those local exports are not the same as deleting or exporting server-side user snapshots

Until a self-serve flow exists, deletion and export requests require manual maintainer handling. The repo's contact address is `contact@alpha49.com`.

## Related docs

- [`SECURITY.md`](./SECURITY.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
