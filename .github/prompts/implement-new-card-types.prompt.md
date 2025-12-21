---
name: implement-new-card-types
argument-hint: "Section: <section name> | CardType: <card id or display name>"
description: "Coding task: implement new card types defined in ./docs (add to generator, API, templates, data fetching, and tests)."
agent: agent
---

# AniCards — Implement New Card Types (Coding & Tests)

You are an expert Next.js/TypeScript maintainer for **AniCards**. Your objective is to **implement the new card types** listed in the repository docs and make them fully available in the product (UI + API + server processing + templates + unit tests + docs).

Expected usage: The user will provide either the name of a section (the exact heading) from the unified `./docs/NEW_CARD_TYPES.md` (for example: "Anime Breakdowns") OR the name of a single card type to implement (either the card ID, e.g., `animeGenres`, or the display name, e.g., "Anime Genres"). When invoked with a section name, the agent will read that section from `./docs/NEW_CARD_TYPES.md` and implement all card types listed there. When invoked with a card type name, the agent will locate the single card entry in `./docs/NEW_CARD_TYPES.md` and implement only that card.

Example invocations:

```
/implement-new-card-types Section: "Anime Breakdowns"
/implement-new-card-types CardType: "animeGenres"
/implement-new-card-types CardType: "Anime Genres"
```

This is an engineering task (not research-only). Follow the repo conventions, use Serena/Serena tools if available, and make small, well-tested changes.

## Hard rules (must follow)

1. Implement _every_ card in the requested section. Do not skip any unless it is impossible; in that case, state the exact problem.
2. Always add the card to the generator UI (`components/stat-card-generator/constants.ts`) so users can select it.
3. Add the card type to the server whitelist in `app/api/card/route.ts` (ALLOWED_CARD_TYPES).
4. Update or add AniList GraphQL fields in `lib/anilist/queries.ts` only if the card requires data that is not already fetched. Always verify the field exists in AniList docs first (https://docs.anilist.co/reference/).
5. Add or extend server-side fetching (`lib/card-data/fetching.ts`) and processing (`lib/card-data/processing.ts`) to produce the data shape your SVG template needs.
6. Add (or extend) an SVG template under `lib/svg-templates/*` and wire it into `lib/card-generator.ts` (add a case that returns the new template). Follow the project patterns for naming, variants and `TrustedSVG` returns.
7. Add or update unit tests (under `tests/unit`) to assert the UI & API behavior for the new types; do NOT add E2E tests.
8. Run and pass `bun test` before declaring work done.

## Implementation checklist (detailed)

For each card type in the selected doc section:

1. Confirm required AniList fields exist.
   - If any field is missing from AniList, mark the card as `requires backend changes` and list the exact fields & storage plan.
   - Add a minimal sample AniList GraphQL query snippet you will use to fetch the data.

2. Add UI registration
   - Edit `components/stat-card-generator/constants.ts`: add a new `createCardType(...)` entry and appropriate `variations` (pattern-match existing cards). Use the same group name conventions (e.g., "Anime Breakdowns", "Profile & Favourites").
   - Update any favorites/ShowFavorites sets if the card supports it (see `FAVORITE_CARD_IDS` in `StatCardTypeSelection`).

3. Allow the card on the API
   - Add the base card ID to `ALLOWED_CARD_TYPES` in `app/api/card/route.ts`.

4. Fetch & process required data
   - If the data is already present in `USER_STATS_QUERY`, only add logic in `lib/card-data/processing.ts` to extract/transform it to the shape your template expects.
   - Otherwise, extend `lib/anilist/queries.ts` to include additional fields and update the fetcher in `lib/card-data/fetching.ts`.
   - Add types to `lib/types/records.ts` if the returned data needs stronger type coverage (prefer optional fields to maintain backward-compatibility).

5. Add or update card-data processing
   - Add a helper (e.g., `toTemplate<YourCardName>`) in `lib/card-data/processing.ts` to normalize AniList data for the template. Export it from `lib/card-data/index.ts` if used by `lib/card-generator.ts`.

6. Create the SVG template
   - Add a new template module under `lib/svg-templates/<category>/...-template.ts` following existing style (return `TrustedSVG`).
   - Make sure the template respects `extractStyles(cardConfig)` and `variant` choices used elsewhere.

7. Wire into generator
   - Import and plug the template in `lib/card-generator.ts`, adding a case for the base card type (see the existing switch/cases). Use existing helpers like `generateCategoryCard` or write a new `generateXCard` function if needed.

8. Tests
   - Unit tests: update `tests/unit/api/card/card.test.ts` to cover:
     - the new card type being accepted by the API (ALLOWED_CARD_TYPES)
     - render path for the card (`generateCardSvg` behavior) by mocking the new template and required stats data
   - Template tests: where appropriate add tests under `tests/unit` verifying your template receives the expected processed data and returns a valid `TrustedSVG` stub.
   - Do NOT add E2E tests: E2E tests are intentionally excluded due to their high database cost. Only add and run unit tests.

9. Docs & examples
   - Update `README.md` and the `examples` page if relevant. Add a short example in `docs/` stating the card is implemented and include a sample card URL for manual testing (e.g. `/api/card.svg?userId=12345&cardType=<id>`).

10. Validation & QA

- Run `bun test`. Fix test failures.
- Start the dev server (`bun run dev` / `next dev`) and use the site to generate a preview via the UI.
- Use the Chrome DevTools automation tools to call the API endpoint directly and inspect the returned SVG.

## When to spawn a subagent

- Use the `Plan` subagent when you need repository-wide discovery or a proposed implementation plan for many cards (produce a per-card TODO list).
- Use `Expert Next.js Developer` subagent for risky architectural changes (e.g., schema changes, caching semantics, complex refactors) and have it run a quick verification (search for impacted symbols and tests).

When using a subagent: pass the exact list of cards to implement, what files to check/update, and the verification steps you expect (unit tests added + manual preview checks).

- Use the `Janitor` subagent as the final step to review and automatically fix issues after implementation. Run it with the following instructions:
  - Review all changes made for the card implementation (source files, tests, and docs).
  - Run `bun test` and fix any failing unit tests; re-run tests until they pass.
  - Run formatters and linters (e.g., Prettier/ESLint) and apply fixes where appropriate.
  - Apply safe, small refactors and cleanup (remove dead code, improve typings, consolidate duplicates) without making unreviewed behavioral changes; if a substantial design decision is required, report it instead of applying it.

## Example checklist

- [ ] Tests added/updated (unit)
- [ ] `statCardTypes` updated
- [ ] `ALLOWED_CARD_TYPES` updated
- [ ] AniList queries updated only when necessary (with inline comment linking to AniList docs)
- [ ] `lib/card-data` processing functions added/updated and exported
- [ ] `lib/svg-templates` template added and documented
- [ ] `lib/card-generator.ts` wired to new template
- [ ] README/docs updated
- [ ] `bun test` passes

## Finish criteria

- All new card types in the selected section are implemented and selectable in the generator UI.
- API endpoint renders a valid SVG for each new card type and at least the `default` variant.
- Unit tests added and pass locally (`bun test`).
- Code reviewed by Janitor subagent.
