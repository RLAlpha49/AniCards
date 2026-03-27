# AniCards privacy notes

A maintainer-facing technical summary of the privacy posture baked into the repository. Not a legal document — not a substitute for a real privacy policy review. Just a plain account of what data the code handles and how.

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

The write path does not intentionally persist raw IP addresses.

### Persisted card editor configuration

`/api/store-cards` stores:

- `userId`
- per-card settings
- optional global settings
- `updatedAt`

### Browser-stored consent state

Analytics consent lives client-side in local storage under:

- `anicards:analytics-consent:v1`

Values are `granted` or `denied`. The `unset` state is the default before a user makes a choice — analytics stays off until they actively grant it.

### Consented telemetry

When analytics is enabled and the user has granted consent, the app may send:

- pageview events with normalized route patterns
- bounded custom event labels
- bounded error categories

Route and label values that look sensitive are intentionally redacted or normalized before transmission.

### Structured error reports

The app supports structured error reporting through `/api/error-reports`.

Those reports can include sanitized versions of:

- error message
- error name
- route
- stack / component stack
- bounded metadata
- optionally redacted user identifiers

## Third-party and infrastructure services

The codebase touches these external services:

- **AniList GraphQL** — upstream source for profile and statistics data
- **Upstash Redis / Ratelimit** — persistence, analytics counters, and retention-limited reports
- **Google Analytics / Google Tag Manager** — consent-gated analytics when `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` is configured
- **Vercel Analytics / Speed Insights** — consent-gated runtime telemetry on Vercel deployments

## Analytics consent model

The consent model is opt-in. No gray area here.

How it works:

- analytics is disabled by default
- the consent banner only appears when a tracking ID is actually configured
- granting consent enables Google Analytics pageviews and events
- Vercel Analytics and Speed Insights only render when consent is granted and the app is running on Vercel
- revoking consent stops future events immediately

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

### Aggregate counters

Analytics counters accumulate under `analytics:*` Redis keys. These are bounded by operational cleanup and reporting patterns, but the current code does not assign per-key TTLs to the underlying raw counters.

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
