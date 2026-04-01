# AniCards documentation

The root [`README.md`](../README.md) is your way in. Everything here goes deeper — the kind of detail that would've buried the front page if it lived there.

## Diagrams

- [`diagrams/runtime-architecture.drawio`](./diagrams/runtime-architecture.drawio) — runtime map from middleware and layouts through API handlers, Redis, AniList, caching, and telemetry.
- [`diagrams/public-api-surface.drawio`](./diagrams/public-api-surface.drawio) — public route families, canonical handlers, aliases, shared controls, and backing services.
- [`diagrams/security-request-flow.drawio`](./diagrams/security-request-flow.drawio) — HTML CSP/nonce flow plus the API protection branches for public reads, browser writes, SVG renders, and cron jobs.
- [`diagrams/user-page-editor-flow.drawio`](./diagrams/user-page-editor-flow.drawio) — multi-page editor flow covering returning-user load, first-time bootstrap, and the edit/autosave/export loop.
- [`diagrams/redis-persistence.drawio`](./diagrams/redis-persistence.drawio) — split user storage, saved card configs, lookup indexes, refresh keys, and lifecycle audit data.
- [`diagrams/card-generation-pipeline.drawio`](./diagrams/card-generation-pipeline.drawio) — end-to-end SVG render path from `/api/card` through cache layers, data resolution, and template dispatch.
- [`diagrams/data-lifecycle.drawio`](./diagrams/data-lifecycle.drawio) — privacy-relevant data path from AniList ingestion through pruning to Redis storage and deletion.
- [`diagrams/development-workflow.drawio`](./diagrams/development-workflow.drawio) — local setup, validation gate, and contributor flow.

## Product and usage

- [`CARD_REFERENCE.md`](./CARD_REFERENCE.md) — the full card catalog: supported types, variation options, embed parameters, and real URL examples.

## Development and maintenance

- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — getting set up locally, which environment variables you actually need, validation commands, Husky hooks, and how to contribute without stepping on anything.
- [`API.md`](./API.md) — public route ownership, which paths are canonical vs aliases, and how `openapi.yaml` stays current.

## Architecture and policy

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — how the app is structured at runtime: request flow, storage shape, and the core boundaries that hold things together.
- [`SECURITY.md`](./SECURITY.md) — CSP nonce flow, static headers, route protections, and why the logging is designed the way it is.
- [`PRIVACY.md`](./PRIVACY.md) — what data exists, how telemetry consent works, retention notes, and what deletion and export actually look like in practice.
