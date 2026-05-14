---
name: Implement New Card Types
argument-hint: "Section: <section name> | CardType: <card id or display name>"
description: "Implement card proposals from docs/NEW_CARD_TYPES.md end-to-end: feasibility check, registry wiring, rendering, tests, docs, and validation."
agent: agent
---

# AniCards — Implement New Card Types

You are implementing one or more card proposals from [`./docs/NEW_CARD_TYPES.md`](./docs/NEW_CARD_TYPES.md) and making them production-ready across the AniCards stack.

`./docs/NEW_CARD_TYPES.md` is the only proposal source of truth for this prompt. Do not read or use any `NEW_CARD_TYPES_*` companion files unless the user explicitly asks for them.

## How to interpret the request

The user will provide one of these inputs:

- `Section: <exact heading>` — implement every proposal listed under that heading in `./docs/NEW_CARD_TYPES.md`
- `CardType: <card id or display name>` — implement only that proposal

Examples:

```text
/implement-new-card-types Section: "Anime"
/implement-new-card-types CardType: "animeStaffMomentum"
/implement-new-card-types CardType: "Anime Staff Momentum"
```

If both are provided, treat `CardType` as the narrower request and implement only the explicitly named card.

Matching rules:

- Match the exact card id or exact display name first.
- If no exact match exists, try a trimmed, case-insensitive comparison.
- If multiple proposals still match, stop and report the ambiguous value plus the closest plausible matches.
- If the repository already partially implements the requested card, finish the missing surfaces instead of creating a duplicate card family.

## Operating rules

1. This is an engineering task, not a research-only task.
2. Implement the full requested scope; do not silently skip cards.
3. Treat `./docs/NEW_CARD_TYPES.md` as the product specification and the repository as the source of truth for current implementation state.
4. Keep changes minimal, idiomatic, and aligned with existing card patterns.
5. Do not add placeholder code, TODO comments, speculative abstractions, or fake data paths.
6. Prefer extending existing helpers, registries, and template families before inventing new abstractions.
7. Re-read any file immediately before editing it; do not rely on stale context if the workspace may have changed.
8. Add unit coverage for every new behavior. Do not add or run E2E tests unless the user explicitly asks.
9. When browser tools are available, use them for final card-link inspection instead of stopping at code-level validation alone.

## Repository facts you must honor

- `lib/card-types.ts` is the primary card registry for labels, groups, and variants. `components/stat-card-generator/constants.ts` re-exports from it.
- `app/api/card/route.ts` contains the runtime allowlist for SVG rendering.
- `lib/card-data/validation.ts` and `lib/server/user-data.ts` are additional base-card registries used for validation and selective data loading.
- `lib/card-generator.ts` dispatches templates by base card type.
- `lib/card-groups.ts` and `lib/svg-templates/common/dimensions.ts` are common wiring points for newly supported cards.
- `components/user/UserPageEditor.tsx` and `app/api/store-cards/route.ts` usually matter only when a card introduces new variants, advanced flags, or editor-specific behavior.
- `app/examples/examples-catalog.ts`, `docs/CARD_REFERENCE.md`, `README.md`, and `openapi.yaml` are the common user-facing surfaces for newly supported cards.
- `lib/card-info-tooltips.ts` and `lib/card-variant-tooltips.ts` may need updates when the card or its variants need user-facing explanation.
- AniList query changes belong in `lib/anilist/queries.ts`; verify fields against <https://docs.anilist.co/reference/> before editing the query.
- Add or extend helpers in `lib/card-data/**` only when they shape reusable record-level data. If the logic is template-family-specific or purely presentational, keep it next to the relevant `lib/svg-templates/**` family instead.
- If you update `openapi.yaml`, update every relevant `CardType` enum occurrence exactly once and verify that you did not introduce duplicate entries.

## Required workflow

1. Read the requested proposal in `./docs/NEW_CARD_TYPES.md`.
   - If `./docs/NEW_CARD_TYPES.md` does not exist, stop immediately and tell the user the implementation spec file is missing.
   - If the requested section or card cannot be found unambiguously, stop and report the unmatched value plus the nearest plausible matches.
2. Search the repository for similar cards, templates, tests, and data-processing helpers.
3. Create a short todo list and keep it updated while you work.
4. Identify the minimal implementation path for each requested card:
   - already shipped but incomplete
   - existing AniList data already fetched
   - existing local cached data already available
   - new AniList fields required
   - genuinely blocked / backend-only proposal
5. If a proposal cannot be implemented with the current backend or AniList data contract, stop before partial implementation and explain the exact blocker.

## Implementation checklist

For every requested card, verify and update the relevant surfaces below.

### 1) Data feasibility

- Confirm the required data exists in AniList or the current cached user record.
- Prefer existing persisted user-record data before changing AniList queries.
- If the proposal document includes a feasibility note, treat it as a hint and verify it against the current repository.
- If new AniList fields are needed, add only the smallest necessary query changes.
- If the proposal requires backend collection or storage that does not exist, do not fake it; explain the missing fields and storage path that would be required.

### 2) Card registry and editor wiring

Update the card registry and every dependent place that needs to know the new base card type or its variants.

Common files to inspect:

- `lib/card-types.ts`
- `lib/card-data/validation.ts`
- `lib/server/user-data.ts`
- `app/api/card/route.ts`
- `lib/card-groups.ts`
- `lib/svg-templates/common/dimensions.ts`
- `components/user/UserPageEditor.tsx`
- `app/api/store-cards/route.ts`
- `openapi.yaml`

When relevant, also update tooltip/help metadata such as:

- `lib/card-info-tooltips.ts`
- `lib/card-variant-tooltips.ts`

### 3) Data loading and shaping

- Reuse existing data paths when possible.
- Put shared record-shaping helpers where the existing family expects them.
- Use `lib/card-data/**` for reusable record-level shaping; keep renderer-local calculations next to the relevant SVG template family.
- Export any new shared helper from the appropriate barrel only when that repository area already uses one.
- Strengthen types only where necessary; keep compatibility with existing user-record shapes.

### 4) SVG template and generator wiring

- Add or extend the SVG template in the appropriate `lib/svg-templates/**` location.
- Return `TrustedSVG` and follow existing styling, sizing, and variant conventions.
- Wire the template into `lib/card-generator.ts` and keep variant normalization consistent with existing cards.
- Ensure the default variant renders sensibly for sparse, empty, or partially sampled data.

### 5) Tests

At minimum, update or add unit tests that cover:

- API acceptance / rejection for the new base card type
- generator dispatch for the new card
- processing, helper, or template behavior for the new metric
- storage or editor-specific behavior when new variants or advanced flags are introduced

Prefer extending existing tests under `tests/unit/api/card`, `tests/unit/api/store-cards`, and nearby template or processing tests before creating entirely new test files.

### 6) User-facing docs and examples

Update user-facing docs only when the card is actually supported after your changes.

Common candidates:

- `README.md`
- `docs/CARD_REFERENCE.md`
- `app/examples/examples-catalog.ts`
- `openapi.yaml`

Keep the registry label, docs label, example title, and base card id consistent.

### 7) Browser-based card preview and visual QA

After the implementation and automated checks pass, validate the rendered card output in the browser when browser tools are available.

- Build at least one real `/api/card` URL for each requested card, for example:

  ```text
  http://localhost:3000/api/card?userId=542244&cardType=animeStats&variation=vertical&colorPreset=anilistDarkGradient
  ```

- You may change `userId`, `variation`, `colorPreset`, and other safe query parameters to get a representative preview for the card you just implemented.
- Open the card URL directly in the browser instead of relying only on text fetches or unit tests.
- Inspect the rendered output using browser page reads plus element-level or SVG-level checks when possible.
- Take at least one screenshot for each newly implemented card and use it to verify that the output looks visually correct.
- Look for layout or rendering issues such as clipping, overflow, broken alignment, missing labels, unreadable text, malformed legends, empty-state regressions, incorrect dimensions, or obviously poor color contrast.
- If the card introduces multiple new variants or especially different layouts, inspect more than one representative URL.
- Treat browser validation as part of the completion bar when it is feasible in the current environment.

If `http://localhost:3000` is not reachable:

- Start the local app if that is feasible for the current task, typically with `bun run dev`.
- If live browser validation is blocked by missing environment variables, unavailable upstream services, or an unreachable local server you cannot reasonably start, fall back to a direct generator-state preview and explicitly report why the browser pass could not run.
- Do not claim browser validation happened if you only ran tests or inspected raw text output.

## Validation requirements

Run the smallest sufficient validation set as you work, then run the final minimum set before declaring success:

- relevant targeted unit tests with `bun test`
- `bun run typecheck`
- `bun run eslint .`

Important:

- Do not use `bun run test` unless the user explicitly asks for end-to-end validation; in this repo it also runs Playwright E2E tests.
- If you changed only a narrow area, prefer targeted unit tests first, then broaden if failures suggest wider impact.
- If browser tools are available and the local app can be reached, open at least one live `/api/card` URL per requested card in the browser, inspect it directly, and take a screenshot.
- If browser validation is not feasible, manually preview at least one generator state for each new card and explain the blocker.

## Finish only when all of these are true

- Every requested card is fully wired into the product or explicitly blocked for a real, documented reason.
- The new base card type is recognized anywhere the repo treats card types as enumerated data.
- Rendering works for the default variant, plus any newly introduced variants.
- User-facing docs, examples, and OpenAPI are updated if the card is now publicly supported.
- Unit tests for the new behavior pass.
- `bun run typecheck` and `bun run eslint .` pass.
- If feasible, you verified at least one live `/api/card` URL per requested card in the browser and checked screenshots or page output for visual correctness.
- If live browser validation was blocked, you explicitly documented the blocker and used the best available preview fallback instead.
- Your summary names the files changed, whether AniList query changes were required, the validations run, any pre-existing warnings or errors, and any remaining follow-up work.
