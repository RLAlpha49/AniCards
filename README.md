<!-- markdownlint-disable MD033 -->
# AniCards

<p align="center">
  <img src="./public/icon.svg" alt="AniCards icon" width="256" height="256" />
</p>

Turn your AniList history into embeddable SVG cards and PNG previews. Paste an image link anywhere and your anime and manga stats show up.

## Why AniCards exists

AniList tracks everything: how many episodes you've watched, which genres dominate your list, your activity streaks, score distributions, seasonal patterns. None of that is easy to share outside AniList itself. AniCards pulls that data from the AniList GraphQL API and renders it as SVG cards you can embed with a single URL — no hosting required on your end.

## What you can do with it

Go to [anicards.alpha49.com](https://anicards.alpha49.com), enter your AniList username, choose a card type, adjust the look, and copy the embed URL. AniCards refreshes stored AniList data on a best-effort, capacity-bound schedule, so embeds stay current without promising an exact daily cutoff.

If you prefer to build the URL by hand:

```text
https://api.anicards.alpha49.com/card.svg?cardType=animeStats&username=Alpha49&variation=compact&colorPreset=sunset
```

Prefer `/card.svg` for embeddable SVGs. The same query surface is also available at `/card.png` when you need a raster preview image.

Every supported card type, variation, preset, and parameter is documented in [`docs/CARD_REFERENCE.md`](docs/CARD_REFERENCE.md).

## What's in the card catalog

The catalog covers five areas, each with multiple card types and layout variations:

- **Core stats** — anime and manga totals, social stats, profile overview, anime vs manga comparison
- **Deep dives** — genre, tag, studio, voice actor, staff, score, year, country, and format distributions; charts include pie, donut, bar, and radar layouts
- **Activity and engagement** — recent activity, streaks, top activity days, seasonal viewing patterns, social milestones, review stats
- **Library and progress** — favourites, currently watching/reading, planning backlog, dropped media, completion overview, personal records, consumption milestones
- **Advanced analytics** — score comparisons, country and genre diversity, release era preferences, tag diversity, length preferences, start-year momentum

Cards accept the full runtime preset inventory documented in [`docs/CARD_REFERENCE.md`](docs/CARD_REFERENCE.md), plus per-color URL parameters for fine-tuning individual colors. Layout variations include `default`, `compact`, `minimal`, `vertical`, and card-specific chart or grid options.

## Getting started

AniCards runs on [Bun](https://bun.sh) and [Next.js](https://nextjs.org).

```bash
git clone https://github.com/RLAlpha49/AniCards.git
cd AniCards
bun install
```

Copy `.env.example` to `.env.local`, then choose the lightest local mode that fits your task:

| Mode | Reach for it when... | Minimum local setup |
| --- | --- | --- |
| **UI-only** | Docs, marketing pages, visual polish, layout work, and other frontend shell changes | Keep the three `NEXT_PUBLIC_*` loopback URLs from [`docs/DEVELOPMENT.md#minimal-envlocal-examples`](docs/DEVELOPMENT.md#minimal-envlocal-examples) |
| **Full app/API** | Route handlers, stored-user/card flows, cron paths, or AniList/Redis-backed work | Add `ANILIST_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `API_SECRET_TOKEN`; add `CRON_SECRET` only when testing `/api/cron*` |

Then start the dev server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) owns the copy-paste env snippets, protected-route notes, and the fuller variable matrix. It also includes the contributor quickstart and [`change-type validation matrix`](docs/DEVELOPMENT.md#change-type-validation-matrix) so the front page stays fast to scan instead of turning into `.env` fan fiction.

## Built with

Next.js (App Router, Turbopack) · TypeScript · Tailwind CSS · Radix UI · Upstash Redis · AniList GraphQL · Deployed on Vercel

## Documentation

- [`docs/README.md`](docs/README.md) — documentation index, including the linked draw.io diagrams for runtime, API surface, security, editor flow, and Redis persistence
- [`docs/CARD_REFERENCE.md`](docs/CARD_REFERENCE.md) — full card catalog, variations, and URL parameter reference
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — local setup, env variables, validation commands, contributor workflow
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — request flow, storage model, external services
- [`docs/API.md`](docs/API.md) — public route ownership and OpenAPI contract
- [`docs/SECURITY.md`](docs/SECURITY.md) — CSP nonce flow, headers, route protections
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — data categories, telemetry consent, retention, and deletion

## Contributing

Pull requests are welcome. Fork the repo, cut a feature branch, run the relevant validation commands from `docs/DEVELOPMENT.md`, and open a PR. If your change touches a public route, update [`openapi.yaml`](openapi.yaml) in the same PR.

Before broad repo changes, start with [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for the Bun-first workflow, contributor quickstart, copy-paste `.env.local` examples, canonical instruction discovery, shared alias map, `.drawio` workflow, OpenAPI 3.2 authoring notes, and validation commands. Use the [`change-type validation matrix`](docs/DEVELOPMENT.md#change-type-validation-matrix) to pick the smallest sensible local pass, and treat `bun run build` as a first-class regression check whenever routes, config, metadata, headers, or other production-only behavior might shift. `AGENTS.md` layers on repo-specific execution rules, and [`docs/README.md#stable-contract-index`](docs/README.md#stable-contract-index) is the jump table for durable API, architecture, security, and privacy contracts.

If you're scaffolding or refactoring shared UI, treat `components.json` as the source of truth for `shadcn/ui` aliases, `rsc` mode, and the Tailwind stylesheet entrypoint (`app/globals.css`). For public-contract changes, use `docs/README.md#stable-contract-index` as the jump table so the API, architecture, security, and privacy docs stay in sync.

For new card ideas — a layout concept, a stat breakdown you'd personally use, a color scheme — open an [issue](https://github.com/RLAlpha49/AniCards/issues/new) with a description or sketch. Whatever communicates the idea.

Found a bug? Check [existing issues](https://github.com/RLAlpha49/AniCards/issues) first, then open a new one if nothing matches.

## License

MIT. See [LICENSE](LICENSE).

---

**Disclaimer**: AniCards is an independent project with no affiliation to AniList.co. API usage is governed by their terms of service.
