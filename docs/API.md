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

One tooling caveat: `openapi.yaml` is authored in OpenAPI `3.2.0`. Older generators, validators, or hosted doc viewers that only partially support `3.2` may misparse it or silently drop details, so verify tool support before assuming the contract is wrong.

## Route ownership matrix

Use this as the scan-friendly index near the top of the guide: every published path from [`openapi.yaml`](../openapi.yaml), the method surface, who it is for, whether it is canonical or compatibility-only, and which section owns the narrative summary.

- **`/api/anilist`** — methods: `POST`, `OPTIONS`; audience: browser/editor flow; canonicality: canonical route; owning surface: [`Browser-only stored-write gate`](#browser-only-stored-write-gate), [`Common editor save flow`](#common-editor-save-flow), tag `anilist`.
- **`/api/card`** — methods: `GET`, `OPTIONS`; audience: public embeds and previews; canonicality: **canonical** SVG route; owning surface: [`Canonical, alias, and legacy compatibility entrypoints`](#canonical-alias-and-legacy-compatibility-entrypoints), [`Card contract notes`](#card-contract-notes), tag `card`.
- **`/card.svg`** — methods: `GET`; audience: public embeds; canonicality: pretty public alias; owning surface: [`Canonical, alias, and legacy compatibility entrypoints`](#canonical-alias-and-legacy-compatibility-entrypoints), tag `card`.
- **`/api/card.svg`** — methods: `GET`; audience: compatibility consumers; canonicality: fallback alias only; owning surface: [`Canonical, alias, and legacy compatibility entrypoints`](#canonical-alias-and-legacy-compatibility-entrypoints), tag `card`.
- **`/card.png`** — methods: `GET`; audience: public raster previews; canonicality: public companion route; owning surface: [`Canonical, alias, and legacy compatibility entrypoints`](#canonical-alias-and-legacy-compatibility-entrypoints), [`Card contract notes`](#card-contract-notes), tag `card`.
- **`/StatCards/{username}/{key}.svg`** — methods: `GET`; audience: legacy embeds; canonicality: migration-only compatibility path; owning surface: [`Canonical, alias, and legacy compatibility entrypoints`](#canonical-alias-and-legacy-compatibility-entrypoints), tag `card`.
- **`/api/get-cards`** — methods: `GET`, `OPTIONS`; audience: public readers / editor bootstrap; canonicality: canonical public read; owning surface: [`Common editor save flow`](#common-editor-save-flow), [`Editor contract quick map`](#editor-contract-quick-map), tag `cards`.
- **`/api/get-user`** — methods: `GET`, `OPTIONS`; audience: public readers / editor bootstrap; canonicality: canonical public read; owning surface: [`Common editor save flow`](#common-editor-save-flow), [`Editor contract quick map`](#editor-contract-quick-map), tag `user`.
- **`/api/store-cards`** — methods: `POST`, `OPTIONS`; audience: browser editor only; canonicality: canonical browser-only write; owning surface: [`Browser-only stored-write gate`](#browser-only-stored-write-gate), [`Common editor save flow`](#common-editor-save-flow), tag `store`.
- **`/api/store-users`** — methods: `POST`, `OPTIONS`; audience: browser editor only; canonicality: canonical browser-only write; owning surface: [`Browser-only stored-write gate`](#browser-only-stored-write-gate), [`Common editor save flow`](#common-editor-save-flow), [`Editor contract quick map`](#editor-contract-quick-map), tag `store`.
- **`/api/error-reports`** — methods: `POST`, `OPTIONS`; audience: same-site client telemetry; canonicality: canonical telemetry ingest route; owning surface: [`Route families in the contract`](#route-families-in-the-contract), tag `telemetry`.
- **`/api/convert`** — methods: `POST`, `OPTIONS`; audience: browser/API consumers converting safe SVG input; canonicality: canonical conversion route; owning surface: [`Route families in the contract`](#route-families-in-the-contract), tag `convert`.
- **`/api/cron`** — methods: `POST`; audience: operators / scheduled jobs; canonicality: canonical operator route; owning surface: [`Route families in the contract`](#route-families-in-the-contract), tag `cron`.
- **`/api/cron/analytics-reporting`** — methods: `GET`, `POST`; audience: operators / scheduled jobs; canonicality: canonical operator route; owning surface: [`Route families in the contract`](#route-families-in-the-contract), tag `cron`.

## Supported OpenAPI 3.2 validation and preview workflow

The supported repo workflow is deliberately plain:

1. Edit [`openapi.yaml`](../openapi.yaml) directly and update this guide in the same PR when the summary narrative changes.
2. Preview the contract in raw YAML, diff view, or an editor/plugin that **explicitly** supports OpenAPI `3.2.0`.
3. Treat older generators and hosted viewers as optional spot-checks only. If they disagree with the YAML, verify tool support before calling the contract broken.
4. Use the matching validation lane from [`DEVELOPMENT.md`](./DEVELOPMENT.md#change-type-validation-matrix). Docs/spec-only changes usually stop at formatting plus human review; runtime changes add the usual `typecheck` / `build` regression checks.

There is no repo-blessed auto-generated preview portal for this contract today. That is intentional: the supported preview is the YAML itself plus review in-context, because flashy stale previews are how contract drift sneaks in wearing a fake mustache.

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

- `/api/store-users` needs the stronger stats-bound grant minted by `/api/anilist` when it returns `GetUserStats` for the same user. The lighter `stored_user` grant refreshed by successful `/api/store-users` or `/api/store-cards` responses is not enough on its own because `/api/store-users` verifies the submitted `stats` payload against the grant's stats hash.
- `/api/store-cards` accepts either that strong `GetUserStats` grant or the lighter `stored_user` grant for the same user.

Successful `/api/store-users` and `/api/store-cards` responses refresh the lighter `stored_user` grant. Successful `/api/anilist` `GetUserStats` responses refresh the stronger stats-bound grant. Public `/api/get-user` reads stay account-free and **do not** mint write authority on their own.

One extra gotcha for `/api/store-users`: the server only persists the bound AniList snapshot that was just approved for that browser/user flow. A client can still send `username` in the JSON body for compatibility, but the authoritative username comes from the bound snapshot/write grant, not from whatever the browser claims in that field.

## Common editor save flow

Before any protected API save, a same-origin document navigation to the `/user` editor must already have let middleware refresh the shared request-proof cookie. After that, the common browser flow is:

1. **Optional username resolution** — `POST /api/anilist` (`proxyAniList`) with `operation=GetUserId` resolves a numeric AniList `userId` when the browser only has a username. It does **not** mint a write grant.
2. **Bootstrap identity lookup** — `GET /api/get-user?view=bootstrap` (`getStoredUser`) confirms the canonical profile target. It stays a public read and does **not** mint a write grant.
3. **Existing cards lookup** — `GET /api/get-cards` (`getStoredCards`) returns the sparse cards record plus cards `updatedAt` and optional `userSnapshot` metadata. Preserve `cardOrder`; later `/api/store-cards` writes must echo the latest cards `ifMatchUpdatedAt` when the record already exists.
4. **Fresh stats approval** — `POST /api/anilist` (`proxyAniList`) with `operation=GetUserStats` returns the approved AniList stats payload and refreshes the stronger stats-bound protected-write grant cookie for that user.
5. **Persist the user snapshot** — `POST /api/store-users` (`storeUser`) consumes the request-proof cookie, same-origin and verified-IP checks, and the stats-bound grant. When a stored user already exists, send the latest user `ifMatchUpdatedAt`; optionally add `ifMatchRevision` and `ifMatchSnapshotToken` for a stronger snapshot-bound compare. Success returns new user `updatedAt`, `revision`, and `snapshotToken`, then refreshes the lighter `stored_user` grant.
6. **Persist the cards patch** — `POST /api/store-cards` (`storeCards`) consumes the request-proof cookie plus either the stats-bound grant or the refreshed `stored_user` grant. The `cards` array is a sparse patch set: clients can send only the per-card fields they are changing, and omitted settings (including `variation`) are inherited from the existing stored record when present. When the cards record already exists, send the latest cards `ifMatchUpdatedAt`. If you need to pin the save to the user snapshot from step 5, also send `ifMatchRevision` and `ifMatchSnapshotToken`. Success returns cards `updatedAt` plus the linked `userSnapshot` and refreshes the `stored_user` grant again.
7. **Later autosaves and conflict recovery** — subsequent `storeCards` autosaves keep using the latest cards `ifMatchUpdatedAt`. A `409` means one of the compare tokens or snapshot bindings is stale; reload `getStoredUser` / `getStoredCards` before retrying.

## Editor contract quick map

- `/api/get-user?view=bootstrap` confirms the canonical profile target, but it stays a public read and does not refresh protected-write grants by itself.
- `/api/get-cards` returns a **sparse** persisted cards record: explicit `cards`, optional compact `cardOrder`, the cards record `updatedAt`, and optional `version`, `schemaVersion`, and `userSnapshot` metadata. The `cards` array is **not** the full ordering source; preserve `cardOrder` on round-trip.
- Once a stored record already exists, both write routes expect the latest `ifMatchUpdatedAt`. `/api/store-users` can also take `ifMatchRevision` and `ifMatchSnapshotToken`; `/api/store-cards` can use the same tokens to pin the save to a specific stored user snapshot.
- `/api/store-users` validates the submitted AniList `stats` payload against the current `GetUserStats` grant and returns a new `updatedAt`, `revision`, and `snapshotToken` for the stored user snapshot.
- `/api/store-cards` merges partial per-card/global settings into the existing sparse record, keeps omitted settings intact, strips unsupported legacy entries on write, and persists only explicit configs plus the minimal `cardOrder` signal needed to reconstruct untouched supported cards later. Sparse patch entries may omit `variation` when an existing stored config already supplies it, but enabled cards still need an effective variation after merge. The success response returns the cards record `updatedAt` and the linked `userSnapshot`.

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
