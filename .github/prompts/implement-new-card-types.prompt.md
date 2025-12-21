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
9. Use subagents at required checkpoints: call `Plan` before making edits for a Section or multiple cards (MANDATORY); call `Expert Next.js Developer` before any backend/API/query/schema changes; call `Janitor` as the final step to run tests, fix failing unit tests, run formatters/linters, and apply safe cleanups. Convert the `Plan` output into a `manage_todo_list` todo list and follow the project's planning progress rules (exactly one todo `in-progress`, mark completed immediately after finishing, add follow-ups as needed).

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

## Subagent usage (MANDATORY)

This workflow requires calling subagents at specific checkpoints. Do not proceed with multi-card/section requests or non-trivial changes until the appropriate subagents have been consulted and their outputs have been applied.

**Plan** (MANDATORY first step)

- Call the `Plan` subagent at the start when the user requests a Section or atleast one CardType, or whenever you are unsure of scope. Provide:
  - `cards`: the exact list of card IDs/names to implement
  - `scope`: file globs to inspect (for example `components/stat-card-generator/**`, `lib/**`, `tests/**`)
  - `expected deliverables`: a per-card TODO list following this prompt's Implementation checklist, prioritized order, estimated files to change, and risk flags (e.g., requires new AniList fields)
  - `verification steps`: unit tests to add, build & run instructions, manual preview URL(s)
- Wait for Plan's output, convert each plan item into a `manage_todo_list` TODO, mark exactly one todo `in-progress`, and do not begin edits until that is done.

**Expert Next.js Developer** (MANDATORY for backend/query/schema/caching changes)

- For any change that affects AniList queries, server-side fetching, API routes, caching, or architecture, call the `Expert Next.js Developer` subagent before editing. Provide:
  - the list of cards and the fields/areas you plan to change
  - files you expect will be impacted
  - a request to run a repository search for impacted symbols and tests and to provide a short risk assessment and implementation guidance
- Apply its recommendations (safer migration steps, tests to add, search results) before proceeding.

**Janitor** (MANDATORY final step)

- After implementing code and tests, call the `Janitor` subagent with instructions to:
  - run `bun run typecheck` and fail on type errors
  - run `bun test` and fix failing unit tests until all pass
  - run `bun run format:write` and `bun run lint -- --fix`, then re-run lint/format to verify
  - perform safe cleanups and simplifications (ensure each cleanup is covered by tests):
    - remove unused imports, variables, functions, and exports
    - remove dead branches and commented-out code
    - consolidate duplicate logic into shared helpers and add tests
    - inline single-use helpers where appropriate and safe
    - tighten types and remove unnecessary `any` usages when covered by tests
    - update or remove obsolete/duplicate tests
    - etc.
  - produce a short report summarizing: tests/lint results, list of files changed/removed, deleted symbols, tests added/modified, and any follow-up todos converted to `manage_todo_list` items
- Only finalize the change and mark the task done after Janitor confirms tests pass and lint/format issues are fixed.

**Notes and invocation tips**

- Pass precise, machine-friendly inputs to subagents (cards, file globs, expected outputs) and use their output to create/manage todos.
- Stop and ask the user for clarification if any subagent reports a blocking issue.

This is a mandatory requirement: failing to call the required subagent(s) at the specified checkpoints is a violation of this prompt's workflow.

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
