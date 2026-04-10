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
- `card` — SVG rendering through the canonical `/api/card` handler, its public aliases, and the legacy notice endpoint for retired StatCards URLs
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

Right now those grants are refreshed by successful stored-user reads (`/api/get-user`) and by the trusted AniList proxy when it returns `GetUserStats` data (`/api/anilist`).

One extra gotcha for `/api/store-users`: the server only persists the bound AniList snapshot that was just approved for that browser/user flow. A client can still send `username` in the JSON body for compatibility, but the authoritative username comes from the bound snapshot/write grant, not from whatever the browser claims in that field.

## Canonical, alias, and legacy compatibility entrypoints

Four paths matter here. Keep them straight — especially in docs and code reviews where inconsistency tends to quietly accumulate:

- **Canonical SVG route:** `/api/card`
- **Pretty public alias:** `/card.svg`
- **Compatibility alias:** `/api/card.svg`
- **Legacy StatCards compatibility notice:** `/StatCards/{username}/{key}.svg`

For implementation discussions and contract work, stick to the canonical handler path. For user-facing embeds, `/card.svg` is perfectly fine and honestly a bit cleaner to read. The legacy `/StatCards/{username}/{key}.svg` route is still public, but it returns a cacheable static SVG that tells older consumers to regenerate their cards on AniCards instead of rendering live stats.

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
