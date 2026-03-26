# AniCards - AniList Statistics Cards

AniCards is a dynamic and customizable tool designed to generate beautiful statistic cards from your AniList profile data. Effortlessly display your anime and manga stats with vibrant, animated SVGs that you can share on any platform!

## 📚 Durable Project Docs

- [`docs/README.md`](docs/README.md) — index of the maintained project docs
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — app/runtime, data, and storage overview
- [`docs/SECURITY.md`](docs/SECURITY.md) — CSP, security headers, route protections, and logging posture
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — current data categories, telemetry consent model, retention notes, and deletion/export caveats

## 🚀 Live Demo

Experience AniCards live at [anicards.alpha49.com](https://anicards.alpha49.com)

## 🎨 Card Style Requests

**I especially encourage design submissions!** If you have an idea for:

- New color schemes or themes 🎨
- Creative layout concepts 🖼️
- Animated elements to enhance the card's appeal ✨
- New card types for additional statistics or different variants 📊

Submit your design concepts (sketches, Figma files, or detailed descriptions) and I'll work on implementing them!

## 📊 Available Card Types

Each card has a `cardType` ID and supports one or more `variation` values.

### Core Stats

- **Anime Statistics** (`animeStats`) — Variations: Default, Vertical, Compact, Minimal
- **Manga Statistics** (`mangaStats`) — Variations: Default, Vertical, Compact, Minimal
- **Social Statistics** (`socialStats`) — Variations: Default, Compact, Minimal, Badges
- **Profile Overview** (`profileOverview`) — Variations: Default
- **Anime vs Manga Overview** (`animeMangaOverview`) — Variations: Default

### Anime Deep Dive

- **Anime Genres** (`animeGenres`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Anime Tags** (`animeTags`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Voice Actors** (`animeVoiceActors`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `showFavorites`
- **Animation Studios** (`animeStudios`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `showFavorites`
- **Studio Collaboration** (`studioCollaboration`) — Variations: Default
- **Anime Staff** (`animeStaff`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `showFavorites`
- **Anime Status Distribution** (`animeStatusDistribution`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `statusColors`
- **Anime Format Distribution** (`animeFormatDistribution`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Anime Source Material Distribution** (`animeSourceMaterialDistribution`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Anime Seasonal Preference** (`animeSeasonalPreference`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Episode Length Preferences** (`animeEpisodeLengthPreferences`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Anime Country Distribution** (`animeCountry`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Anime Score Distribution** (`animeScoreDistribution`) — Variations: Default, Horizontal, Cumulative
- **Anime Year Distribution** (`animeYearDistribution`) — Variations: Default, Horizontal
- **Anime Genre Synergy** (`animeGenreSynergy`) — Variations: Default

### Manga Deep Dive

- **Manga Genres** (`mangaGenres`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Manga Tags** (`mangaTags`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart, Radar Chart
- **Manga Staff** (`mangaStaff`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `showFavorites`
- **Manga Status Distribution** (`mangaStatusDistribution`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
  - Optional flag: `statusColors`
- **Manga Format Distribution** (`mangaFormatDistribution`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Manga Country Distribution** (`mangaCountry`) — Variations: Default, Pie Chart, Donut Chart, Bar Chart
- **Manga Score Distribution** (`mangaScoreDistribution`) — Variations: Default, Horizontal, Cumulative
- **Manga Year Distribution** (`mangaYearDistribution`) — Variations: Default, Horizontal

### Activity & Engagement

- **Recent Activity Summary** (`recentActivitySummary`) — Variations: Default
- **Activity Streaks** (`activityStreaks`) — Variations: Default
- **Top Activity Days** (`topActivityDays`) — Variations: Default
- **Social Milestones** (`socialMilestones`) — Variations: Default
- **Review Statistics** (`reviewStats`) — Variations: Default
- **Seasonal Viewing Patterns** (`seasonalViewingPatterns`) — Variations: Default

### Library & Progress

- **Favourites Summary** (`favoritesSummary`) — Variations: Default
- **Favourites Grid** (`favoritesGrid`) — Variations: Anime, Manga, Characters, Staff, Studios, Mixed
  - Optional layout params: `gridCols` (1–5), `gridRows` (1–5)
- **Status Completion Overview** (`statusCompletionOverview`) — Variations: Combined, Split
- **Consumption Milestones** (`milestones`) — Variations: Default
- **Personal Records** (`personalRecords`) — Variations: Default
- **Planning Backlog** (`planningBacklog`) — Variations: Default
- **Most Rewatched/Reread** (`mostRewatched`) — Variations: Default, Anime, Manga
- **Currently Watching / Reading** (`currentlyWatchingReading`) — Variations: Default, Anime, Manga
- **Dropped Media** (`droppedMedia`) — Variations: Default

### Advanced Analytics

- **Anime vs Manga Score Comparison** (`scoreCompareAnimeManga`) — Variations: Default
- **Country Diversity** (`countryDiversity`) — Variations: Default
- **Genre Diversity** (`genreDiversity`) — Variations: Default
- **Format Preference Overview** (`formatPreferenceOverview`) — Variations: Default
- **Release Era Preference** (`releaseEraPreference`) — Variations: Default
- **Start-Year Momentum** (`startYearMomentum`) — Variations: Default
- **Length Preference** (`lengthPreference`) — Variations: Default
- **Tag Category Distribution** (`tagCategoryDistribution`) — Variations: Default
- **Tag Diversity** (`tagDiversity`) — Variations: Default

## 🛠️ Customization

You can easily generate your cards using the [Live Generator](https://anicards.alpha49.com).

Alternatively, construct the URL manually:

```text
https://api.anicards.alpha49.com/card.svg?cardType={CARD_TYPE}&userId={USER_ID}&variation={VARIATION}&colorPreset={PRESET_NAME}
```

### Parameters

- `cardType` (required): The ID of the card (e.g., `animeStats`, `mangaGenres`). See the "Available Card Types" above for all supported values.
- `userId` or `userName` (required): Pass either the numeric AniList user ID via `userId`, or a username via `userName`. If both are provided the numeric `userId` is used.
- `variation` (optional): Visual variation to use for the card. Valid values depend on the `cardType`, but commonly supported values include: `default`, `vertical`, `compact`, `minimal`, `pie`, `bar`, `horizontal`. The generator will fall back to the appropriate `default` value for unsupported/invalid variants.
- `colorPreset` (optional): Named color preset to use (e.g., `anilistDark`, `sunset`, `default`). Use `colorPreset=custom` to tell the server to use colors stored in stored on the server (this will ignore per-color URL overrides).
- `titleColor`, `backgroundColor`, `textColor`, `circleColor` (optional): Individual color overrides to apply to the card (hex values like `#ff0000` or valid CSS color strings). Note: `#` must be URL encoded (e.g., `titleColor=%23ff0000`).
- `borderColor` (optional): Stroke color for the card border (like `#ff00ff`).
- `borderRadius` (optional): Numeric value (pixels) to override the card corner radius.
- `showFavorites` (optional): `true` or `false` — applicable only to certain category cards (voice actors, studios, staff) to visualize favorites.
- `statusColors` (optional): `true` or `false` — tells status distribution cards to use fixed status colors.
- `piePercentages` (optional): `true` or `false` — show percentage labels on pie charts (only meaningful for `pie`/`donut` variants).
- `_t` (optional): Any value used to bust caches (commonly a timestamp).

### Notes

- When `colorPreset=custom`, the server will load color data from the card stored in the database and ignore any `titleColor` / `backgroundColor` / `textColor` / `circleColor` URL overrides.
- Certain flags (like `showFavorites`, `statusColors`, and `piePercentages`) are only relevant to specific card types. If omitted, the API will use the stored card configuration if present, otherwise fall back to sensible defaults.

Example (URL-encoded colors):

```text
https://api.anicards.alpha49.com/card.svg?cardType=animeGenres&userId=542244&variation=pie&colorPreset=anilistDark&titleColor=%23ff0000&backgroundColor=%230b1622&piePercentages=true
```

> Here it uses the color preset `anilistDark` as a base, but overrides the title and background colors.

Example using username:

```text
https://api.anicards.alpha49.com/card.svg?cardType=animeStats&userName=Alpha49&variation=compact&colorPreset=sunset&titleColor=%23ff77aa
```

**For a full list of supported card types, color presets, and variations, visit the [Live Generator](https://anicards.alpha49.com).**

## 🏗️ Local Development

AniCards supports two useful local modes:

- **UI-only/local shell work** — good for README/docs updates, marketing pages, styling, and other changes that do not need AniList or Redis-backed API flows.
- **Full app/API work** — needed when you are touching route handlers, stored user/card data, cron flows, or anything that depends on AniList and Upstash Redis.

### 1. Clone and install

```bash
git clone https://github.com/RLAlpha49/AniCards.git
cd AniCards
bun install
```

`bun install` also runs the repository `prepare` script, which installs the Husky git hooks used during local contribution.

### 2. Copy the env template

Create a local env file before starting the app:

```bash
cp .env.example .env.local
```

On Windows PowerShell, the equivalent is:

```powershell
Copy-Item .env.example .env.local
```

### 3. Fill in the variables you actually need

The template in [`.env.example`](.env.example) is grouped by concern. Use the lightest setup that matches your work.

| Concern | Variables | Required for |
| --- | --- | --- |
| Local app URLs | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL` | All local runs |
| AniList upstream access | `ANILIST_TOKEN` | Full API work that calls AniList-backed routes |
| Redis-backed storage/rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Stored user/card flows, shared rate limiting, cron/reporting paths |
| Analytics | `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` | Optional local analytics wiring |
| SVG/CORS tuning | `NEXT_PUBLIC_CARD_SVG_ALLOWED_ORIGIN` | Optional local card/embed testing |
| Cron protection | `CRON_SECRET` | Operator/cron endpoint testing; required outside local dev |
| Local cron escape hatch | `ALLOW_UNSECURED_CRON_IN_DEV=1` | Optional local-only testing when you intentionally want unsecured cron access |
| Upstream degradation toggle | `ANILIST_UPSTREAM_DEGRADED_MODE=1` | Optional local resilience testing |

#### UI-only mode

For docs, frontend shell, or styling work, keeping the local URL variables set is usually enough. In this mode, pages that depend on AniList, Redis, or cron secrets may stay unavailable or degraded locally — that is expected.

#### Full app/API mode

For API/storage work, populate the AniList token, Upstash Redis credentials, and any cron-related settings you need to exercise. Keep `VERCEL` empty in local `.env.local`; the platform sets that in hosted environments.

### 4. Start the dev server

```bash
bun run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## ✅ Validation and contributor workflow

Use the script surface from [`package.json`](package.json) when validating changes:

| Command | What it does | When to use it |
| --- | --- | --- |
| `bun run format` | Prettier check-only pass | Read-only formatting verification |
| `bun run format:write` | Writes Prettier fixes, then runs ESLint autofix | Best local cleanup pass before pushing |
| `bun run lint` | ESLint with `--fix` | Local autofix lint run |
| `bun run lint:check` | ESLint check-only | CI parity / read-only lint validation |
| `bun run typecheck` | TypeScript no-emit check | Required before push (also enforced by Husky) |
| `bun run test:unit` | Bun unit test suite only | Fast test pass for most code/docs changes touching logic |
| `bun run test:unit:coverage` | Unit tests with coverage artifacts | CI/unit coverage parity |
| `bun run test` | `test:unit` **plus** Playwright E2E | Full local regression when your change can affect browser flows |
| `bun run test:e2e` | Playwright E2E only | Focused browser validation |
| `bun run check:unused` | Knip unused-code analysis | Optional hygiene pass |
| `bun run check:licenses` | License policy check | Optional dependency/compliance pass |

Recommended local contributor path for most changes:

1. Run `bun run format:write`
2. Run `bun run test:unit` for logic-affecting changes, or `bun run test` when browser behavior may have changed
3. Run `bun run typecheck`
4. Run `bun run lint:check`

### Husky hooks

This repository uses Husky to catch common issues before they leave your machine:

- **pre-commit** → `bun run lint-staged`
- **pre-push** → `bun run typecheck`

That means staged source/docs files get auto-formatted before commit, and pushes are blocked if the TypeScript check fails.

## 🔌 API contract and OpenAPI maintenance

AniCards keeps its public API contract in [`openapi.yaml`](openapi.yaml). The README is a contributor guide; the OpenAPI file is the canonical contract for request/response shape, path aliases, and endpoint-level behavior.

### What lives in the contract

The current spec covers the main public route families:

- `anilist` — allowlisted AniList GraphQL proxying
- `card` — SVG rendering via the canonical `/api/card` handler plus public aliases
- `cards` — stored card configuration reads
- `convert` — SVG-to-PNG/WebP conversion
- `cron` — operator-facing refresh/reporting jobs
- `store` — stored user/card mutation routes
- `user` — stored user lookup routes

### Canonical vs alias entrypoints

- **Canonical SVG route:** `/api/card`
- **Pretty public alias:** `/card.svg`
- **Compatibility alias:** `/api/card.svg`

When you update docs or examples, prefer the canonical handler language and call out aliases only where they matter for compatibility or public URLs.

### How contributors should maintain `openapi.yaml`

AniCards does **not** currently generate `openapi.yaml` from route code. The file is hand-maintained and should be updated in the same pull request as any public API change.

Update the contract whenever you change:

- a public route path or alias
- accepted query/body fields
- response shapes, status codes, or headers
- canonical parameter names vs deprecated aliases
- documented storage/privacy behavior that is surfaced directly in the contract

Recommended maintenance workflow:

1. Change the route handler/tests first or in parallel
2. Update [`openapi.yaml`](openapi.yaml) in the same PR so the contract matches runtime behavior
3. Keep the README API section high-level and push detailed behavior into the spec
4. Run the normal validation commands for the touched surface (`bun run format:write`, relevant tests, `bun run typecheck`, `bun run lint:check`)
5. Manually review any examples you changed so canonical paths and aliases stay truthful

For broader system context beyond the API contract, start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SECURITY.md`](docs/SECURITY.md), and [`docs/PRIVACY.md`](docs/PRIVACY.md).

## 🤝 Contributing

Contributions are very welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your change and run the relevant validation commands above.
4. Let the Husky hooks do their thing.
5. Open a Pull Request that explains what changed, how you validated it, and whether any API contract/docs updates were required.

## 🐛 Issues & Feature Requests

Found a bug or have an idea for improvement? Let me know!

1. Check the existing [issues](https://github.com/RLAlpha49/AniCards/issues).
2. If your issue or idea isn't listed, [open a new issue](https://github.com/RLAlpha49/AniCards/issues/new).

## 📄 License

Distributed under the MIT License. See the [LICENSE](LICENSE) file for more information.

---

**Disclaimer**: AniCards is not affiliated with AniList.co. Use of AniList's API is subject to their terms of service.
