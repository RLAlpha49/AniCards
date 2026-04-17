# AniCards API guide

Pull this up whenever you're touching public routes, adjusting how requests or responses behave, or just trying to figure out which path is actually canonical. It won't answer everything — that's what the spec is for — but it'll orient you quickly.

## Supporting diagrams

- [`public-api-surface.drawio`](./diagrams/public-api-surface.drawio) — the route-family map from consumers to canonical handlers, aliases, shared controls, and backing services.
- [`runtime-architecture.drawio`](./diagrams/runtime-architecture.drawio) — where the public routes sit relative to middleware, shared API protections, storage, and upstream services.
- [`user-page-editor-flow.drawio`](./diagrams/user-page-editor-flow.drawio) — the main user-facing path that drives `/api/get-user`, `/api/get-cards`, `/api/store-users`, `/api/store-cards`, `/api/anilist`, and `/api/card`.
- [`card-generation-pipeline.drawio`](./diagrams/card-generation-pipeline.drawio) — the end-to-end SVG render path for `/api/card`, including cache layers, data resolution, and template dispatch.

## Contract source of truth

The public API contract lives in [`openapi.yaml`](../openapi.yaml).

Worth being explicit here: this file is hand-maintained. Nothing auto-generates it from the route handlers. So when the spec and a summary doc contradict each other — and eventually they will — `openapi.yaml` wins. Fix the docs in the same pull request, not later.

## Route families in the contract

At the moment, the contract covers these public route families:

- `anilist` — allowlisted AniList GraphQL proxying
- `card` — SVG rendering through the canonical `/api/card` handler, the public SVG aliases, the public `/card.png` raster route, and the migration-only legacy notice endpoint for retired StatCards URLs
- `cards` — stored card configuration reads
- `convert` — SVG-to-PNG or WebP conversion
- `cron` — operator-facing refresh and reporting jobs
- `store` — stored user and card mutation routes
- `telemetry` — structured client error-report ingestion via `/api/error-reports`
- `user` — stored user lookup routes

## Browser-only stored-write gate

The two `store` mutations are intentionally **not** generic public write APIs.

- `/api/store-users`
- `/api/store-cards`

In production, both routes expect the full browser-only chain to be present:

- same-origin request validation
- verified client IP resolution
- the shared request-proof cookie
- a short-lived **per-user protected write grant** minted by a trusted AniCards response for that same user

Those grants are intentionally route-specific:

- `/api/store-users` needs the stronger stats-bound grant minted by `/api/anilist` when it returns `GetUserStats` for the same user. The lighter `stored_user` grant refreshed by `/api/get-user`, `/api/store-users`, or `/api/store-cards` is not enough on its own because `/api/store-users` verifies the submitted `stats` payload against the grant's stats hash.
- `/api/store-cards` accepts either that strong `GetUserStats` grant or the lighter `stored_user` grant for the same user.

Successful `/api/get-user`, `/api/store-users`, and `/api/store-cards` responses refresh the lighter `stored_user` grant. Successful `/api/anilist` `GetUserStats` responses refresh the stronger stats-bound grant.

One extra gotcha for `/api/store-users`: the server only persists the bound AniList snapshot that was just approved for that browser/user flow. A client can still send `username` in the JSON body for compatibility, but the authoritative username comes from the bound snapshot/write grant, not from whatever the browser claims in that field.

## Editor contract quick map

- `/api/get-user?view=bootstrap` confirms the canonical profile target and refreshes the lighter `stored_user` grant used by the card-save path.
- `/api/get-cards` returns a **sparse** persisted cards record: explicit `cards`, optional compact `cardOrder`, the cards record `updatedAt`, and optional `version`, `schemaVersion`, and `userSnapshot` metadata. The `cards` array is **not** the full ordering source; preserve `cardOrder` on round-trip.
- Once a stored record already exists, both write routes expect the latest `ifMatchUpdatedAt`. `/api/store-users` can also take `ifMatchRevision` and `ifMatchSnapshotToken`; `/api/store-cards` can use the same tokens to pin the save to a specific stored user snapshot.
- `/api/store-users` validates the submitted AniList `stats` payload against the current `GetUserStats` grant and returns a new `updatedAt`, `revision`, and `snapshotToken` for the stored user snapshot.
- `/api/store-cards` merges partial per-card/global settings into the existing sparse record, keeps omitted settings intact, strips unsupported legacy entries on write, and persists only explicit configs plus the minimal `cardOrder` signal needed to reconstruct untouched supported cards later. The success response returns the cards record `updatedAt` and the linked `userSnapshot`.

## Canonical, alias, and legacy compatibility entrypoints

Five paths matter here. Keep them straight — especially in docs and code reviews where inconsistency tends to quietly accumulate:

- **Canonical SVG route:** `/api/card`
- **Pretty public alias:** `/card.svg`
- **Compatibility alias (fallback only):** `/api/card.svg`
- **Public PNG companion:** `/card.png`
- **Legacy StatCards compatibility notice:** `/StatCards/{username}/{key}.svg`

For implementation discussions and contract work, stick to the canonical handler path. For user-facing SVG embeds, `/card.svg` is perfectly fine and honestly a bit cleaner to read. `/api/card.svg` remains a compatibility fallback and should not be the default example for new integrations. `/card.png` shares the same card query contract, but rasterizes the SVG response and defaults omitted `animate` to static before conversion. The legacy `/StatCards/{username}/{key}.svg` route is migration-only output: it returns a cacheable static SVG notice plus explicit `noindex, noimageindex, noarchive` crawl directives so old embeds still resolve without becoming a preferred public media surface.

## Card contract notes

- `username` is the canonical name query parameter. `userName` remains accepted only as a deprecated backward-compatible alias.
- On SVG routes, animations stay enabled unless `animate` is set to one of `0`, `false`, `no`, or `off`. `/card.png` injects `animate=false` when the parameter is omitted.
- `colorPreset=custom` means “use stored custom colors” unless all four core URL colors (`titleColor`, `backgroundColor`, `textColor`, and `circleColor`) are present, in which case the URL colors are used directly.
- `/card.png` keeps the same query surface as the SVG routes and preserves the underlying card status and cache semantics while returning `image/png`.
- Successful card responses have three cache modes: canonical renders get the long cache policy, explicit visual override requests get the shorter preview policy, and `_t` bypasses cache reads and returns no-store headers for that render.
- `_t` is a card-render cache-busting token only. It does not refresh AniList data by itself.

## When to update `openapi.yaml`

Here's the short version: if the public surface changes, the spec changes with it — same PR, not a follow-up. That includes:

- any public route path or alias
- accepted query or body fields
- response shapes, status codes, or headers
- canonical parameter names versus deprecated aliases
- storage or privacy behavior that shows up through the public contract

## Recommended maintenance flow

1. Change the route handler or tests first, or in parallel.
2. Update [`openapi.yaml`](../openapi.yaml) in the same PR — not after merge.
3. Keep top-level docs high-level; push request/response detail into the spec where it belongs.
4. Run the normal validation commands from [`DEVELOPMENT.md`](./DEVELOPMENT.md).
5. Manually skim changed examples so canonical paths and aliases haven't drifted.

## Related docs

- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — local setup and validation workflow
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — app structure and storage boundaries
- [`SECURITY.md`](./SECURITY.md) — route protections, CSP, and logging posture
- [`PRIVACY.md`](./PRIVACY.md) — current data categories and retention caveats
- [`CARD_REFERENCE.md`](./CARD_REFERENCE.md) — public card types and embed parameters
