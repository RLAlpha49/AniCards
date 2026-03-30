---
name: Implement New Card Types
argument-hint: "Section: <section name> | CardType: <card id or display name>"
description: "Implement card types from docs/NEW_CARD_TYPES.md with full registry wiring, data handling, and unit coverage."
agent: agent
---

# AniCards — Implement New Card Types

You are implementing one or more card proposals from `./docs/NEW_CARD_TYPES.md` and making them production-ready across the AniCards stack.

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

## Operating rules

1. This is an engineering task, not a research-only task.
2. Implement the full requested scope; do not silently skip cards.
3. Treat `./docs/NEW_CARD_TYPES.md` as the specification, not as proof that the feature already exists.
4. Keep changes minimal, idiomatic, and aligned with existing card patterns.
5. Do not add placeholder code, TODO comments, or partial wiring.
6. Prefer extending existing helpers, registries, and template families before inventing new abstractions.
7. Add unit coverage for every new behavior. Do not add or run E2E tests unless the user explicitly asks.

## Repository facts you must honor

- `lib/card-types.ts` is the primary card registry for labels, groups, and variants. `components/stat-card-generator/constants.ts` re-exports from it.
- `app/api/card/route.ts` contains the runtime allowlist for SVG rendering.
- `lib/card-data/validation.ts` and `lib/server/user-data.ts` are additional base-card registries used for validation and selective data loading.
- `lib/card-generator.ts` dispatches templates by base card type.
- `lib/card-groups.ts`, `components/user/UserPageEditor.tsx`, and `app/api/store-cards/route.ts` may also need updates when a card introduces new variants or advanced flags.
- `openapi.yaml`, `README.md`, and `app/examples/page.tsx` are user-facing surfaces that may need updates when a new card becomes publicly supported.
- AniList query changes belong in `lib/anilist/queries.ts`; verify fields against <https://docs.anilist.co/reference/> before editing the query.

## Required workflow

1. Read the requested proposal in `./docs/NEW_CARD_TYPES.md`.
   - If `./docs/NEW_CARD_TYPES.md` does not exist, stop immediately and tell the user the implementation spec file is missing.
   - If the requested section or card cannot be found unambiguously, stop and report the unmatched value plus the nearest plausible matches.
2. Search the repository for similar cards, templates, tests, and data-processing helpers.
3. Create a short todo list and keep it updated while you work.
4. Identify the minimal implementation path for each requested card:
   - existing AniList data already fetched
   - existing local cached data already available
   - new AniList fields required
   - genuinely blocked / backend-only proposal
5. If a proposal cannot be implemented with the current backend or AniList data contract, stop before partial implementation and explain the exact blocker.

## Implementation checklist

For every requested card, verify and update the relevant surfaces below.

### 1) Data feasibility

- Confirm the required data exists in AniList or the current cached user record.
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
- `components/user/UserPageEditor.tsx`
- `app/api/store-cards/route.ts`
- `openapi.yaml`

When relevant, also update tooltip/help metadata such as:

- `lib/card-info-tooltips.ts`
- `lib/card-variant-tooltips.ts`

### 3) Data loading and shaping

- Reuse existing data paths when possible.
- Add or extend processing helpers in `lib/card-data/processing.ts`.
- Export any new processing helper from `lib/card-data/index.ts` when needed.
- Strengthen types only where necessary; keep compatibility with existing user-record shapes.

### 4) SVG template and generator wiring

- Add or extend the SVG template in the appropriate `lib/svg-templates/**` location.
- Return `TrustedSVG` and follow existing styling/variant conventions.
- Wire the template into `lib/card-generator.ts` and keep variant normalization consistent with existing cards.

### 5) Tests

At minimum, update or add unit tests that cover:

- API acceptance / rejection for the new base card type
- generator dispatch for the new card
- processing or template behavior for the new metric
- storage or editor-specific behavior when new variants or advanced flags are introduced

Prefer extending existing tests under `tests/unit/api/card`, `tests/unit/api/store-cards`, and nearby template or processing tests before creating entirely new test files.

### 6) User-facing docs and examples

Update user-facing docs only when the card is actually supported after your changes.

Common candidates:

- `README.md`
- `app/examples/page.tsx`
- `openapi.yaml`

## Validation requirements

Run the smallest sufficient validation set as you work, then run the final minimum set before declaring success:

- relevant targeted unit tests with `bun test`
- `bun run typecheck`
- `bun run eslint .`

Important:

- Do not use `bun run test` unless the user explicitly asks for end-to-end validation; in this repo it also runs Playwright E2E tests.
- If you changed only a narrow area, prefer targeted unit tests first, then broaden if failures suggest wider impact.
- If feasible, manually preview at least one sample URL or generator state for each new card after code and tests pass.

## Finish only when all of these are true

- Every requested card is fully wired into the product or explicitly blocked for a real, documented reason.
- The new base card type is recognized anywhere the repo treats card types as enumerated data.
- Rendering works for the default variant, plus any newly introduced variants.
- Unit tests for the new behavior pass.
- `bun run typecheck` and `bun run eslint .` pass.
- Your summary names the files changed, the validations run, and any remaining follow-up work.
