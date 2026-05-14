# AniCards documentation

The root [`README.md`](../README.md) is your way in. Everything here goes deeper — the kind of detail that would've buried the front page if it lived there.

## Diagrams

Open and edit the checked-in `.drawio` sources locally in VS Code with the Draw.io Integration extension (`hediet.vscode-drawio`). `docs/diagrams/*.drawio` is the source of truth; update the diagram in the same PR as the code or doc change it explains.

- [`diagrams/runtime-architecture.drawio`](./diagrams/runtime-architecture.drawio) — runtime map from middleware and layouts through API handlers, Redis, AniList, caching, and telemetry.
- [`diagrams/public-api-surface.drawio`](./diagrams/public-api-surface.drawio) — public route families, canonical handlers, aliases, shared controls, and backing services.
- [`diagrams/security-request-flow.drawio`](./diagrams/security-request-flow.drawio) — HTML CSP/nonce flow plus the API protection branches for public reads, browser writes, SVG renders, and cron jobs.
- [`diagrams/user-page-editor-flow.drawio`](./diagrams/user-page-editor-flow.drawio) — multi-page editor flow covering returning-user load, first-time bootstrap, and the edit/autosave/export loop.
- [`diagrams/redis-persistence.drawio`](./diagrams/redis-persistence.drawio) — split user storage, saved card configs, lookup indexes, refresh keys, and lifecycle audit data.
- [`diagrams/card-generation-pipeline.drawio`](./diagrams/card-generation-pipeline.drawio) — end-to-end SVG render path from `/api/card` through cache layers, data resolution, and template dispatch.
- [`diagrams/data-lifecycle.drawio`](./diagrams/data-lifecycle.drawio) — privacy-relevant data path from AniList ingestion through pruning to Redis storage and deletion.
- [`diagrams/development-workflow.drawio`](./diagrams/development-workflow.drawio) — local setup, validation gate, and contributor flow.
- [`diagrams/analytics-consent-flow.drawio`](./diagrams/analytics-consent-flow.drawio) — consent state management, Google Analytics bootstrap, and event tracking pipeline.
- [`diagrams/card-type-taxonomy.drawio`](./diagrams/card-type-taxonomy.drawio) — every card family, its card types, supported variations, and the SVG template directory that renders each.
- [`diagrams/component-hierarchy.drawio`](./diagrams/component-hierarchy.drawio) — component nesting from root layout through providers and shells into route children.
- [`diagrams/error-handling-flow.drawio`](./diagrams/error-handling-flow.drawio) — error capture from component throws through boundaries, structured reporting, and durable storage.

## Product and usage

- [`CARD_REFERENCE.md`](./CARD_REFERENCE.md) — the full card catalog: supported types, variation options, embed parameters, and real URL examples.

## Contributor quickstart

- [`../README.md#getting-started`](../README.md#getting-started) — the fast clone/install/run entrypoint when you just need the repo up locally.
- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — Bun-first local setup, copy-paste `.env.local` examples, validation commands, the canonical instruction-discovery map, the current shared alias map, and the supported `.drawio` workflow.
- [`../AGENTS.md`](../AGENTS.md) — repo-specific execution rules plus the pointer to roadmap guardrails.

## Editor and tooling contracts

- [`DEVELOPMENT.md → Contributor guardrails and instruction discovery`](./DEVELOPMENT.md#contributor-guardrails-and-instruction-discovery) — canonical map for repo instructions, guardrails, and where to look before changing framework-specific files.
- [`DEVELOPMENT.md → Shared UI scaffolding source of truth`](./DEVELOPMENT.md#shared-ui-scaffolding-source-of-truth) — the authoritative `components.json` alias and `shadcn/ui` scaffolding contract.
- [`DEVELOPMENT.md → Diagram workflow`](./DEVELOPMENT.md#diagram-workflow) — the checked-in `.drawio` editing workflow and source-of-truth rule.
- [`DEVELOPMENT.md → Supported OpenAPI 3.2 validation and preview workflow`](./DEVELOPMENT.md#supported-openapi-32-validation-and-preview-workflow) — how this repo expects contributors to author, sanity-check, and preview `openapi.yaml` without depending on stale generators.
- [`API.md → Contract source of truth`](./API.md#contract-source-of-truth), [`Route ownership matrix`](./API.md#route-ownership-matrix), and [`Supported OpenAPI 3.2 validation and preview workflow`](./API.md#supported-openapi-32-validation-and-preview-workflow) — the contract ownership jump points for public-route work.

## Development and maintenance

- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — getting set up locally, which environment variables you actually need, validation commands, Husky hooks, and how to contribute without stepping on anything.
- [`API.md`](./API.md) — public route ownership, which paths are canonical vs aliases, and how `openapi.yaml` stays current.

## Architecture and policy

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — how the app is structured at runtime: request flow, storage shape, and the core boundaries that hold things together.
- [`SECURITY.md`](./SECURITY.md) — CSP nonce flow, static headers, route protections, and why the logging is designed the way it is.
- [`PRIVACY.md`](./PRIVACY.md) — what data exists, how telemetry consent works, retention notes, and what deletion and export actually look like in practice.

## Stable contract index

Use these links when a change affects public behavior and you want the durable contract surface rather than an implementation-specific detail:

- **OpenAPI source of truth** — [`../openapi.yaml`](../openapi.yaml) and [`API.md → Contract source of truth`](./API.md#contract-source-of-truth)
- **Supported OpenAPI authoring / preview workflow** — [`API.md → Supported OpenAPI 3.2 validation and preview workflow`](./API.md#supported-openapi-32-validation-and-preview-workflow) and [`DEVELOPMENT.md → Supported OpenAPI 3.2 validation and preview workflow`](./DEVELOPMENT.md#supported-openapi-32-validation-and-preview-workflow)
- **Public route families and canonical entrypoints** — [`API.md → Route families in the contract`](./API.md#route-families-in-the-contract) and [`API.md → Canonical, alias, and legacy compatibility entrypoints`](./API.md#canonical-alias-and-legacy-compatibility-entrypoints)
- **Route ownership matrix** — [`API.md → Route ownership matrix`](./API.md#route-ownership-matrix)
- **Runtime boundaries and directory ownership** — [`ARCHITECTURE.md → Directory layout`](./ARCHITECTURE.md#directory-layout) and [`ARCHITECTURE.md → Public API boundaries`](./ARCHITECTURE.md#public-api-boundaries)
- **Security envelope for public routes** — [`SECURITY.md → Content Security Policy`](./SECURITY.md#content-security-policy) and [`SECURITY.md → Route protections`](./SECURITY.md#route-protections)
- **Privacy, retention, and minimized public data** — [`PRIVACY.md → Data currently handled by the repo`](./PRIVACY.md#data-currently-handled-by-the-repo), [`PRIVACY.md → Retention and lifecycle`](./PRIVACY.md#retention-and-lifecycle), and [`PRIVACY.md → Public access and data minimization`](./PRIVACY.md#public-access-and-data-minimization)
