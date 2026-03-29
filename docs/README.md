# AniCards documentation

The root [`README.md`](../README.md) is your way in. Everything here goes deeper — the kind of detail that would've buried the front page if it lived there.

## Product and usage

- [`CARD_REFERENCE.md`](./CARD_REFERENCE.md) — the full card catalog: supported types, variation options, embed parameters, and real URL examples.

## Development and maintenance

- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — getting set up locally, which environment variables you actually need, validation commands, Husky hooks, and how to contribute without stepping on anything.
- [`API.md`](./API.md) — public route ownership, which paths are canonical vs aliases, and how `openapi.yaml` stays current.

## Architecture and policy

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — how the app is structured at runtime: request flow, storage shape, and the core boundaries that hold things together.
- [`SECURITY.md`](./SECURITY.md) — CSP nonce flow, static headers, route protections, and why the logging is designed the way it is.
- [`PRIVACY.md`](./PRIVACY.md) — what data exists, how telemetry consent works, retention notes, and what deletion and export actually look like in practice.
