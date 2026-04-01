# AniCards development guide

Local setup, environment variables worth knowing about, validation commands, and the contributor process — all in one place.

## Supporting diagram

- [`development-workflow.drawio`](./diagrams/development-workflow.drawio) — the local setup, validation gate, and contributor flow at a glance.

## Two ways to work locally

There's no single "right" setup. It depends on what you're actually building:

- **UI-only mode** — docs, marketing pages, visual polish, and frontend shell work that doesn't reach AniList or Redis at all. Lighter setup, gets you moving fast.
- **Full app/API mode** — route handlers, stored data, cron flows, or anything that calls AniList or Upstash Redis. You'll need real credentials for this one.

## Clone and install

```bash
git clone https://github.com/RLAlpha49/AniCards.git
cd AniCards
bun install
```

`bun install` automatically runs the `prepare` script, which wires up the Husky git hooks. Nothing extra needed.

## Copy the env template

Before starting the dev server, create a local env file:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

## Fill in what you actually need

The template in [`.env.example`](../.env.example) is grouped by concern. Match the setup to your work — no reason to fill in everything.

| Concern                                | Variables                                                            | Required for                                                               |
| -------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Local app URLs                         | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL` | All local runs                                                             |
| AniList upstream access                | `ANILIST_TOKEN`                                                      | Full API work that calls AniList-backed routes                             |
| Redis-backed storage and rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                 | Stored user or card flows, shared rate limiting, cron, and reporting paths |
| Analytics                              | `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`                                    | Optional local analytics wiring                                            |
| SVG and CORS tuning                    | `NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN`                                | Optional local card or embed testing                                       |
| Cron protection                        | `CRON_SECRET`                                                        | Operator or cron endpoint testing; required outside local dev              |
| Local cron escape hatch                | `ALLOW_UNSECURED_CRON_IN_DEV=1`                                      | Optional local-only testing without cron auth                              |
| Upstream degradation toggle            | `ANILIST_UPSTREAM_DEGRADED_MODE=1`                                   | Optional local resilience testing                                          |

### UI-only mode

The local URL variables are usually all you need here. Pages dependent on AniList, Redis, or cron secrets will degrade or stay offline — that's expected and completely fine.

### Full app/API mode

Fill in the AniList token, Upstash Redis credentials, and whichever cron settings your test path calls for. Leave `VERCEL` unset locally — the platform injects it in hosted environments on its own.

## Start the dev server

```bash
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Validation commands

The full command surface lives in [`package.json`](../package.json). Here's what each one actually does:

| Command                      | What it does                                    | When to use it                                          |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| `bun run format`             | Prettier check-only pass                        | Read-only formatting check                              |
| `bun run format:write`       | Writes Prettier fixes, then runs ESLint autofix | Best all-in-one cleanup pass before pushing             |
| `bun run lint`               | ESLint with `--fix`                             | Local autofix lint run                                  |
| `bun run lint:check`         | ESLint check-only                               | CI parity or read-only validation                       |
| `bun run typecheck`          | TypeScript no-emit check                        | Required before push                                    |
| `bun run test:unit`          | Bun unit test suite only                        | Fast check for most logic changes                       |
| `bun run test:unit:coverage` | Unit tests with coverage artifacts              | Coverage or CI parity                                   |
| `bun run test`               | `test:unit` plus Playwright E2E                 | Full regression when browser behavior might be affected |
| `bun run test:e2e`           | Playwright E2E only                             | Focused browser validation                              |
| `bun run check:unused`       | Knip unused-code analysis                       | Optional hygiene pass                                   |
| `bun run check:licenses`     | License policy check                            | Optional dependency and compliance check                |

For most changes, this sequence covers it:

1. `bun run format:write`
2. `bun run test:unit` for logic changes — or `bun run test` when browser behavior might shift
3. `bun run typecheck`
4. `bun run lint:check`

## Husky hooks

Two hooks run automatically and catch the obvious stuff before it ever leaves your machine:

- **pre-commit** → `bun run lint-staged` — staged source and doc files are auto-formatted on every commit
- **pre-push** → `bun run typecheck` — pushes fail if TypeScript isn't clean

## Contributor workflow

Pull requests are welcome. The path is pretty straightforward:

1. Fork the repo.
2. Cut a feature branch.
3. Make your change and run the relevant validation commands above.
4. Let Husky do its checks.
5. Open a PR — describe what changed, how you tested it, and whether any API contract or doc updates were needed.

Touching the public API? Update [`openapi.yaml`](../openapi.yaml) in the same PR and read through [`API.md`](./API.md) before you submit.
