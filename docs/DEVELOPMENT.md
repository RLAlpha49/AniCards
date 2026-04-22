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

## Contributor guardrails

Use this guide plus `../AGENTS.md` as the onboarding baseline for repo work.

- `AGENTS.md` covers the repo-specific execution rules and links to roadmap guardrails.
- The main instruction anchors live in `../.github/instructions/nextjs.instructions.md`, `../.github/instructions/reactjs.instructions.md`, `../.github/instructions/security-and-owasp.instructions.md`, and `../.github/instructions/performance-optimization.instructions.md`.
- `../components.json` is the UI scaffolding source of truth for shared `shadcn/ui` work: aliases, `rsc` mode, and the Tailwind stylesheet entrypoint (`app/globals.css`).

## Copy the env template

Before starting the dev server, create a local env file:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

## Minimal `.env.local` examples

Start with one of these copy-paste snippets, then layer on any extra toggles from [`.env.example`](../.env.example) only when your task actually needs them.

### UI-only starter snippet

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Full app/API starter snippet

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

ANILIST_TOKEN=replace-with-anilist-token
UPSTASH_REDIS_REST_URL=https://your-upstash-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=replace-with-upstash-rest-token

# Use a real secret to mirror production protected-write behavior locally.
API_SECRET_TOKEN=replace-with-long-random-secret
# Or, for explicit localhost-only fallback testing instead:
# ALLOW_INSECURE_LOCALHOST_SECRETS=true
```

Add `CRON_SECRET=changeme` only when you're exercising `/api/cron*` endpoints.

## Fill in what you actually need

The template in [`.env.example`](../.env.example) is grouped by concern. Match the setup to your work — no reason to fill in everything.

| Concern                                | Variables                                                            | Required for                                                                      |
| -------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Local app URLs                         | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL` | All local runs                                                                    |
| AniList upstream access                | `ANILIST_TOKEN`                                                      | Full API work that calls AniList-backed routes                                    |
| Redis-backed storage and rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                 | Stored user or card flows, shared rate limiting, cron, and reporting paths        |
| Redis latency diagnostics              | `UPSTASH_REDIS_LATENCY_LOGGING=true`                                 | Optional local-only Upstash latency logging while debugging Redis behavior        |
| Analytics                              | `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`                                    | Optional local analytics wiring                                                   |
| SVG and CORS tuning                    | `NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN`                                | Optional local card or embed testing                                              |
| Cron protection                        | `CRON_SECRET`                                                        | Operator or cron endpoint testing; required outside local dev                     |
| Protected route request proof          | `API_SECRET_TOKEN`, `ALLOW_INSECURE_LOCALHOST_SECRETS=true`          | Prod deploys and localhost-only fallback testing for protected proxy/write routes |
| Trusted proxy/client IP headers        | `TRUSTED_CLIENT_IP_HEADERS`, `TRUSTED_CLIENT_IP_HEADER_PROVENANCE`   | Non-default proxy/CDN setups                                                      |
| Local cron escape hatch                | `ALLOW_UNSECURED_CRON_IN_DEV=true`                                   | Optional local-only testing without cron auth                                     |
| Upstream degradation toggle            | `ANILIST_UPSTREAM_DEGRADED_MODE=true`                                | Optional local resilience testing                                                 |

Boolean env toggles in this repository use literal `true` / `false` values. `1` / `0` are ignored by the shared env parser.

### UI-only mode

The local URL variables are usually all you need here. Pages dependent on AniList, Redis, or cron secrets will degrade or stay offline — that's expected and completely fine.

### Full app/API mode

Fill in the AniList token, Upstash Redis credentials, and whichever cron settings your test path calls for. If you opt into local-only booleans such as `ALLOW_UNSECURED_CRON_IN_DEV`, `ANILIST_UPSTREAM_DEGRADED_MODE`, or `UPSTASH_REDIS_LATENCY_LOGGING`, use `true` to enable them. Leave `VERCEL` unset locally — the platform injects it in hosted environments on its own.

### Protected routes and proxy-aware flows

- `API_SECRET_TOKEN` is the root signing secret for the short-lived request-proof cookie and protected-write grants used by `/api/anilist`, `/api/store-users`, `/api/store-cards`, and `/api/convert`. Production must set it. Local development only falls back to the built-in insecure localhost secret when `ALLOW_INSECURE_LOCALHOST_SECRETS=true` **and** the configured public AniCards URLs stay on loopback hosts such as `http://localhost:3000`.
- `TRUSTED_CLIENT_IP_HEADERS` is only needed when your proxy/CDN adds custom client-IP headers beyond the built-in trusted defaults (`x-vercel-forwarded-for` on Vercel and `cf-connecting-ip` on Cloudflare). Custom headers must also declare header-specific provenance via `TRUSTED_CLIENT_IP_HEADER_PROVENANCE`, for example `x-real-ip=x-proxy-signature|x-proxy-id`.

## Start the dev server

```bash
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Validation commands

The full command surface lives in [`package.json`](../package.json). Use those Bun-first entrypoints verbatim in docs, PR notes, and examples rather than translating them to npm, yarn, or pnpm variants. Here's what each one actually does:

| Command                      | What it does                                                       | When to use it                                                                                    |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `bun run format:write`       | Writes Prettier fixes, then runs ESLint autofix                    | Best all-in-one cleanup pass before pushing                                                       |
| `bun run lint`               | ESLint with `--fix`                                                | Local autofix lint run                                                                            |
| `bun run lint:check`         | ESLint check-only                                                  | CI parity or read-only validation                                                                 |
| `bun run typecheck`          | TypeScript no-emit check                                           | Required before push                                                                              |
| `bun run build`              | Production Next.js build via Turbopack                             | First-class regression check for routing, metadata, headers, config, and production-only bundling |
| `bun run test:unit`          | Bun unit test suite only                                           | Fast check for most logic changes                                                                 |
| `bun run test:unit:coverage` | Unit tests with coverage artifacts plus line-threshold enforcement | Coverage gate or coverage artifact generation                                                     |
| `bun run test`               | Unit coverage gate plus matrix-lite Playwright                     | High-signal local regression when browser, mobile, or cross-browser behavior shifts               |
| `bun run check:unused`       | Knip unused-code analysis                                          | CI-enforced merge gate; run locally for PR parity after refactors or file removals                |
| `bun run check:licenses`     | License policy check plus JSON policy report                       | CI-enforced merge gate; run locally for PR parity, especially after dependency changes            |
| `bun run generate:sbom`      | CycloneDX JSON SBOM for production dependencies                    | Security-audit parity, vendor review prep, or any dependency inventory handoff                    |

There is no separate `bun run format` script in this repository — `bun run format:write` is the formatter entrypoint.

Treat `bun run build` as a first-class local regression check, not just a release chore. It's often the fastest way to catch App Router, metadata, header, and production-bundling regressions that won't show up in unit tests.

Use `bun run test:unit` for the fast logic-only loop, and reach for `bun run test:unit:coverage` or `bun run test` when you want a real unit-coverage gate locally. The coverage checker honors `COVERAGE_LINES_THRESHOLD` when you need a stricter floor for a specific lane.

### Playwright entrypoints beyond `bun run test:e2e`

Treat `bun run test:e2e` as the default Playwright path. Reach for the specialized wrappers only when you specifically need a local production build or a deployed smoke target.

- `bun run test:e2e` — default fast Playwright path. Start here for normal browser validation; it stays Chromium-first locally and boots the dev server unless `PLAYWRIGHT_BASE_URL` is already set.
- `bun run test:e2e:matrix-lite` — first-class local mobile/cross-browser lane. Use when browser behavior changed and you want a stronger regression pass without opting into the full matrix.
- `bun run test:e2e:local-prod` — same suite against a local production build (`bun run build && bun run start`). Use when build output, headers, caching, or other production-only behavior matters.
- `bun run test:e2e:deployed-smoke` — minimal smoke for the deployed app shell and `robots.txt`. Use after deploys or against preview/staging targets only; set `PLAYWRIGHT_BASE_URL` and `VERCEL_AUTOMATION_BYPASS_SECRET` when needed.

If you need a non-default browser project locally, pass the Playwright selector directly, for example `bun run test:e2e -- --project=mobile-chrome`. The launcher expands to the matrix-lite project set for the standard mobile/firefox projects, while `PLAYWRIGHT_FULL_MATRIX=1` or a full-only selector such as `--project=mobile-safari` exposes the full set.

Playwright reads `.env` and `.env.local`, so reusable values such as `PLAYWRIGHT_BASE_URL` or `VERCEL_AUTOMATION_BYPASS_SECRET` can live there when that fits your workflow.

For most changes, this sequence covers the common local pass:

1. `bun run format:write`
2. `bun run test:unit` for logic changes — or `bun run test` when browser behavior might shift or you want coverage-gate parity
3. `bun run typecheck`
4. `bun run build`
5. `bun run lint:check`

CI also runs `bun run check:unused` and `bun run check:licenses` as dedicated jobs on pushes and pull requests. CI keeps lint read-only via `bun run lint:check` and only spins up the heavier lint/typecheck/build/Playwright lanes when code-bearing, config, or dependency files change. `bun run check:licenses` still runs as a dedicated policy gate, and its `.artifacts/licenses/license-policy-report.json` output is now summarized in the workflow run and uploaded as an artifact in CI, dependency-review, security-audit, and validated dependency-refresh lanes. Scheduled security audits still run the full baseline and publish a CycloneDX SBOM artifact from `bun run generate:sbom`.

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
