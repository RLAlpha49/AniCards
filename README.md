<!-- markdownlint-disable MD033 -->
# AniCards

<p align="center">
  <img src="./public/pwa/icon-any.svg" alt="AniCards app icon" width="256" height="256" />
</p>

Turn your AniList history into embeddable SVG cards. Paste an image link anywhere and your anime and manga stats show up.

## Why AniCards exists

AniList tracks everything: how many episodes you've watched, which genres dominate your list, your activity streaks, score distributions, seasonal patterns. None of that is easy to share outside AniList itself. AniCards pulls that data from the AniList GraphQL API and renders it as SVG cards you can embed with a single URL — no hosting required on your end.

## What you can do with it

Go to [anicards.alpha49.com](https://anicards.alpha49.com), enter your AniList username, choose a card type, adjust the look, and copy the embed URL. The card updates automatically as your AniList data changes daily.

If you prefer to build the URL by hand:

```text
https://api.anicards.alpha49.com/card.svg?cardType=animeStats&userName=Alpha49&variation=compact&colorPreset=sunset
```

Every supported card type, variation, and parameter is documented in [`docs/CARD_REFERENCE.md`](docs/CARD_REFERENCE.md).

## What's in the card catalog

The catalog covers five areas, each with multiple card types and layout variations:

- **Core stats** — anime and manga totals, social stats, profile overview, anime vs manga comparison
- **Deep dives** — genre, tag, studio, voice actor, staff, score, year, country, and format distributions; charts include pie, donut, bar, and radar layouts
- **Activity and engagement** — recent activity, streaks, top activity days, seasonal viewing patterns, social milestones, review stats
- **Library and progress** — favourites, currently watching/reading, planning backlog, dropped media, completion overview, personal records, consumption milestones
- **Advanced analytics** — score comparisons, country and genre diversity, release era preferences, tag diversity, length preferences, start-year momentum

Cards accept color presets (`anilistDark`, `sunset`, `default`) or per-color URL parameters. Layout variations include `default`, `compact`, `minimal`, `vertical`, and chart-specific options depending on the card type.

## Getting started

AniCards runs on [Bun](https://bun.sh) and [Next.js](https://nextjs.org).

```bash
git clone https://github.com/RLAlpha49/AniCards.git
cd AniCards
bun install
```

Copy the env template before starting the server:

```bash
# macOS / Linux
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

Then start the dev server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

**UI-only mode** (no credentials needed) covers all frontend work, marketing pages, and visual changes. **Full API mode** — routes that call AniList or read/write Redis — requires an `ANILIST_TOKEN` and Upstash Redis credentials. The env template in `.env.example` is grouped by concern; fill in only what your work actually needs. Full details are in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

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

For new card ideas — a layout concept, a stat breakdown you'd personally use, a color scheme — open an [issue](https://github.com/RLAlpha49/AniCards/issues/new) with a description or sketch. Whatever communicates the idea.

Found a bug? Check [existing issues](https://github.com/RLAlpha49/AniCards/issues) first, then open a new one if nothing matches.

## License

MIT. See [LICENSE](LICENSE).

---

**Disclaimer**: AniCards is an independent project with no affiliation to AniList.co. API usage is governed by their terms of service.
