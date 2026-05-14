---
name: New Card Types Research
argument-hint: "Focus: <anime|manga|user|social|mixed> | Count: <number> | Model: <suffix>"
description: "Research new AniCards card ideas or variants and write a deduplicated proposal file in docs/. No code changes."
agent: agent
---

# AniCards — New Card Types / Variants (Research Only)

You are researching high-value additions for the **AniCards** project.

Your task is to propose **new, non-duplicate, technically grounded card ideas** that fit the current AniCards architecture.

Optional request inputs:

- `Focus`: preferred area such as `anime`, `manga`, `user`, `social`, or `mixed`
- `Count`: desired number of ideas
- `Model`: suffix for the output filename

If the user does not specify them, default to:

- `Focus = mixed`
- `Count = 10`
- `Model = <MODEL>`

Where `<MODEL>` is the model identifier you are running as (e.g., `gpt-5.4`, `claude-opus-4.6`, etc.).

## Goal

Produce a research artifact that an implementation agent can act on with minimal extra discovery.

## Hard rules (non-negotiable)

- **Research-only:** do not implement code, rename files, refactor, or modify runtime behavior.
- **`./docs` is write-only during research:** do not read existing `./docs` proposal files or use them as evidence while generating ideas.
- **Avoid duplicates:** do not propose a card or variant that already exists, or that is only a cosmetic rewording of an existing capability.
- **Prefer feasible ideas:** most proposals should be implementable with existing AniList fields from <https://docs.anilist.co/reference/> or already-cached local data.
- **Do not pad the list:** fewer strong ideas are better than many weak or repetitive ones.

## Where to verify duplicates and feasibility

Before proposing any idea, inspect the current implementation surfaces that define supported cards and their capabilities. At minimum, verify against:

- `lib/card-types.ts`
- `lib/card-data/validation.ts`
- `lib/card-groups.ts`
- `lib/card-generator.ts`
- `lib/server/user-data.ts`
- `README.md`
- `openapi.yaml`
- relevant templates/tests/helpers outside `./docs`

A proposal counts as a duplicate if the same underlying metric, comparison, leaderboard, distribution, or user insight already exists anywhere above, even if the title differs.

## Recommended research workflow

1. Search the repo for existing card ids, labels, and similar metrics.
2. Identify promising gaps that fit AniCards' current card families and data model.
3. For each candidate, verify one of these feasibility paths:
   - **AniList-ready** — can be built from documented AniList fields
   - **Local-ready** — can be built from existing project data already fetched or stored
   - **Requires backend changes** — needs new collection/storage; use this sparingly and be explicit
4. Reject ideas that are too close to existing cards, too thin to justify their own card, or purely visual variants with no meaningful new insight.
5. Write the final Markdown artifact in a format that makes future deduplication and implementation easy.

## Using subagents (optional)

Using subagents is helpful for broad repository search or AniList verification. When you use them:

- Give them explicit goals, constraints, and deliverables.
- Tell them `./docs` is off-limits for research.
- Ask for evidence: search terms used, matched files, and a short rationale.

Typical bounded research tasks:

- Search for similar implemented cards and return evidence.
- Confirm required AniList fields and provide a minimal sample query.
- Identify analogous files or templates in the repo.
- Assess implementation complexity and risk.

## Feasibility constraints

Only keep ideas whose data path is clear.

### A) AniList-ready

Use the AniList GraphQL reference: <https://docs.anilist.co/reference/>

For AniList-ready ideas, include:

- exact GraphQL fields
- a minimal sample query

### B) Local-ready

If the idea can be built from data already fetched or stored locally, include:

- the relevant file paths
- a one-line explanation of why those files contain the needed data

### C) Requires backend changes

This is allowed, but must be explicit and uncommon.

For these ideas, include:

- the exact new fields or aggregates needed
- where they would likely be fetched, derived, and stored
- why the card is still worth keeping despite added implementation cost

## Output Artifact

Create a Markdown file at:

- `./docs/NEW_CARD_TYPES_<MODEL>.md`

Where `<MODEL>` is the model identifier you are running as (e.g., `gpt-5.4`, `claude-opus-4.6`, etc.).

If the target output file already exists, overwrite it with the new research artifact rather than appending a second format or partial update.

## Quality bar

- Aim for **8–12 ideas** unless the user requests otherwise.
- At least **70%** of the final ideas should be `AniList-ready` or `Local-ready`.
- Include a balanced mix only when it improves usefulness; do not force every category.
- Prefer cards that surface a distinct insight, not just another rendering of the same statistic.

## Verification requirements

For **each** proposal:

1. **Run targeted repository searches** to confirm it does _not_ already exist.
2. If a similar card exists:
   - either reject it, or
   - explain precisely why the proposal is distinct enough to keep.
3. Record the search terms used and at least one concrete repo citation.

## Required Structure of the Output File

At the top of the file include:

### Metadata

- Model id
- Date
- Requested focus
- Requested count
- Final idea count

### Summary Table

A short table with these columns:

| Proposed ID | Name | Type | Category | Feasibility | Complexity |
| ----------- | ---- | ---- | -------- | ----------- | ---------- |

Then group entries by category, such as: Anime, Manga, User, Social, Character, Studio, Trend, Comparative, Other.

## Per-entry format

For each proposal, include:

- **Title (display name)**
- **Proposed ID** (camelCase)
- **Proposal Type** (`new card type` or `new variant`)
- **Category**
- **One-line Description**
- **Why it is distinct**
- **Feasibility** (`AniList-ready`, `Local-ready`, or `requires backend changes`)
- **Complexity** (`low`, `medium`, or `high`)
- **Duplicate Check**
  - search terms used
  - repo evidence with file paths
- **Required Data**
  - exact AniList GraphQL fields, or
  - local data file paths with explanation, or
  - explicit backend additions required
- **Nearest existing implementation**
  - similar card/template/helper to reuse
- **Sample AniList GraphQL query** (when applicable)
- **UI / visual suggestion**
- **Notes / risks** (optional)

## Example Entry

```markdown
### Top Characters by Voice Actor Diversity

- Proposed ID: topCharactersByVoiceActorDiversity
- Proposal Type: new card type
- Category: Character
- Description: Shows characters ranked by number of distinct voice actors (e.g., different versions, languages).
- Why it is distinct: Existing cards summarize staff and voice actors globally, but not character-level casting breadth.
- Feasibility: AniList-ready
- Complexity: medium
- Duplicate Check:
  - Search terms: `voice actor`, `character`, `cast`
  - Repo evidence: `lib/card-types.ts` contains `animeVoiceActors` but no character-casting card.
- Required Data: `character.name`, `character.voiceActors { id name { full } languageV2 }`
- Nearest existing implementation: reuse leaderboard/template ideas from other ranking-style cards.
- Sample Query: <provide minimal GraphQL query>
- UI: leaderboard with small avatar + count + sample voice actor list
```

## Finish Criteria

- You produced `./docs/NEW_CARD_TYPES_<MODEL>.md`.
- Every kept idea includes concrete evidence, feasibility analysis, and a useful implementation starting point.
- The list is deduplicated, high-signal, and materially different from the cards already in the repo.
