# AniCards development guide

Local setup, environment variables worth knowing about, validation commands, and the contributor process — all in one place.

## Supporting diagram

- [`development-workflow.drawio`](./diagrams/development-workflow.drawio) — the local setup, validation gate, and contributor flow at a glance.

## Quickstart

1. Clone and install with Bun.
2. Copy `.env.example` to `.env.local`.
3. Choose **UI-only mode** for docs/visual work or **full app/API mode** for AniList, Redis, cron, and protected-write flows.
4. Start the app with `bun run dev`, then use the [change-type validation matrix](#change-type-validation-matrix) before you open a PR.

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

## Contributor guardrails and instruction discovery

Use this guide plus `../AGENTS.md` as the onboarding baseline for repo work. Treat this section as the canonical instruction-discovery map so the front page, docs index, and agent guidance can link here instead of carrying their own drift-prone partial lists.

- `../AGENTS.md` covers repo-specific execution rules and points to `../.github/instructions/roadmap-guardrails.instructions.md` when roadmap/theme guardrails matter.
- [`README.md`](./README.md#stable-contract-index) is the jump table for durable API, architecture, security, and privacy contract sections when public behavior changes.
- `../components.json` stays authoritative for shared `shadcn/ui` scaffolding; the alias map below is copied from it for quick reference, not ownership.

| Instruction file                                                   | Reach for it when...                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `../.github/instructions/nextjs.instructions.md`                   | App Router files, route handlers, metadata, caching, or server/client boundary work          |
| `../.github/instructions/reactjs.instructions.md`                  | React components, hooks, interaction behavior, and CSS/SCSS authoring                        |
| `../.github/instructions/typescript.instructions.md`               | TypeScript source, shared types, configs, and module-boundary work                           |
| `../.github/instructions/security-and-owasp.instructions.md`       | External input, auth, secrets, headers, network access, or security review                   |
| `../.github/instructions/performance-optimization.instructions.md` | Performance-sensitive TypeScript/JavaScript/CSS/HTML changes                                 |
| `../.github/instructions/roadmap-guardrails.instructions.md`       | Docs/app/tests work that could accidentally reintroduce intentionally dropped roadmap themes |

### Shared UI scaffolding source of truth

`components.json` currently sets `style: "new-york"`, `rsc: true`, `tsx: true`, and the Tailwind stylesheet entrypoint `app/globals.css`.

| Alias key    | Resolves to       |
| ------------ | ----------------- |
| `components` | `@/components`    |
| `ui`         | `@/components/ui` |
| `hooks`      | `@/hooks`         |
| `lib`        | `@/lib`           |
| `utils`      | `@/lib/utils`     |

If those values ever change, update `../components.json` first and then refresh any docs that quote it.

### Diagram workflow

The checked-in diagram sources live in `docs/diagrams/*.drawio`.

- Supported local workflow: open and edit those files directly in VS Code with the Draw.io Integration extension (`hediet.vscode-drawio`).
- Commit the `.drawio` source file in the same PR as the code or doc change it explains.
- Use `docs/README.md` as the navigation hub for the current diagram inventory.

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

### Change-type validation matrix

Use this as the minimum local pass selector. You can always run more, but this keeps docs-only and contract-only work from pretending it needed the full kitchen sink.

- **Docs-only Markdown changes** — minimum pass: `bun run format:write`
  Good default for `README.md` / `docs/*` edits with no code or contract drift.
- **Public contract docs + `openapi.yaml`** — minimum pass: `bun run format:write` plus a manual skim of [`API.md`](./API.md) and `openapi.yaml` together
  There is no separate repo-scripted OpenAPI validator today; contract review is pairing the spec with the owning guide.
- **Route handler, request/response contract, or shared server utility** — minimum pass: `bun run format:write` → `bun run test:unit` → `bun run typecheck` → `bun run build` → `bun run lint:check`
  Use `bun run test` instead of `test:unit` when browser-observable behavior changed.
- **App Router page, metadata, headers, or config** — minimum pass: `bun run format:write` → `bun run typecheck` → `bun run build` → `bun run lint:check`
  `bun run build` is the first-class regression check here.
- **Browser UI or interaction behavior** — minimum pass: `bun run format:write` → `bun run test` → `bun run typecheck` → `bun run build` → `bun run lint:check`
  `bun run test:e2e:matrix-lite` is the focused lane when you want browser coverage without the full `bun run test` stack.
- **Dependency or policy changes** — add `bun run check:licenses` and, when refactors/files moved, `bun run check:unused`
  These are CI-facing parity checks rather than everyday defaults.

### Supported OpenAPI 3.2 validation and preview workflow

`openapi.yaml` is hand-maintained and authored in OpenAPI `3.2.0`, so the supported repo workflow is intentionally conservative:

1. Edit [`../openapi.yaml`](../openapi.yaml) directly and update the owning summary docs in the same PR.
2. Use the raw YAML, diff view, or an editor preview that **explicitly** supports OpenAPI `3.2.0` to sanity-check the contract shape.
3. Treat older generators, hosted doc viewers, and codegen tools as optional spot-checks only. If they lag on `3.2`, assume tool drift before assuming the contract is wrong.
4. Run the change-type validation lane above. For docs/spec-only work, that usually means `bun run format:write` plus a manual skim of [`API.md`](./API.md); for runtime changes, add the normal `typecheck` / `build` path.

The repo does **not** currently bless a codegen-first or auto-generated preview pipeline for this file. The supported preview is "authoritative YAML plus human review," which is a little less glamorous than a shiny portal but a lot more honest.

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

### CI parity and repository internals

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
