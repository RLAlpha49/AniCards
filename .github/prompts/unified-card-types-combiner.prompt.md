---
name: Unified Card Types Combiner
argument-hint: "Inputs: ./docs/NEW_CARD_TYPES_*.md"
description: "Combine multiple NEW_CARD_TYPES_<MODEL>.md proposal files into one deduplicated, implementation-ready docs/NEW_CARD_TYPES.md."
agent: agent
---

# AniCards — NEW_CARD_TYPES Combiner (Research-only)

You are consolidating multiple model-generated proposal files into one authoritative `./docs/NEW_CARD_TYPES.md` document.

## Purpose

- Merge multiple `./docs/NEW_CARD_TYPES_<MODEL>.md` files into a single, deduplicated, implementation-ready proposal set.
- Preserve the best evidence from each source while removing overlap, weak ideas, and contradictions.

## Hard rules

- This is **research-only** work. Do not modify runtime code.
- You may read proposal files inside `./docs` only as merge inputs.
- When verifying whether a card already exists or whether data is available, **exclude `./docs` from repository evidence**.
- Do not treat proposal files as authoritative proof of implementation, feasibility, or correctness.
- The final document must be more useful than any single input file, not just a stitched copy.

## Inputs

- A list of proposal files such as `./docs/NEW_CARD_TYPES_*.md`.
- If no explicit list is provided, combine all matching proposal files you can find.
- If an input file is missing fields, normalize or enrich it using only repository evidence outside `./docs` and the AniList reference: <https://docs.anilist.co/reference/>
- If an explicitly requested input file does not exist, stop and report which file is missing instead of silently combining a partial set.
- If no matching proposal files exist at all, stop and tell the user the combiner has no source documents yet.

## What “better than merge” means

The final file should help a future implementation agent act quickly. Normalize every surviving idea into a consistent format that includes:

- clear display name and proposed id
- proposal type (`new card type` or `new variant`)
- feasibility and complexity
- distinctness rationale
- required data and evidence
- provenance (`Sources`)

## Deduplication & merging rules

- Consider two entries duplicates if any of the following are true:
  1. Exact title match after normalization (lowercase, trim whitespace, remove punctuation).
  2. High semantic similarity in title + one-line description.
  3. Substantial overlap in Required Data fields and similar descriptions.
  4. They would produce essentially the same user-facing insight, even with different wording.
- When duplicates are found:
  - Merge them into a single stronger entry.
  - Preserve the clearest description, the best evidence, the most specific data requirements, and the most practical UI suggestion.
  - Add a `Sources` sub-bullet listing all input filenames (and model ids if embedded in filename) that contributed to the merged entry.
  - If entries conflict, prefer the version with explicit AniList fields, stronger repo evidence, clearer implementation feasibility, and less speculative scope.
  - If uncertainty remains, keep one canonical entry and annotate the uncertainty in `Notes / risks`.
- Do not produce two final entries that meet the duplication criteria above — final list must have unique, non-overlapping ideas.

## Pruning rules

Drop an entry entirely if any of these are true:

- it duplicates an implemented card already present in the repo
- it is only a superficial visual tweak with no meaningful new insight
- it is too vague to implement responsibly
- it requires backend work but does not justify the additional complexity
- a stronger merged version already covers its value

## Verification

- For each final entry, verify the required data exists either:
  - In AniList API (explicit GraphQL field names are sufficient), or
  - In the repository outside `./docs` (list file paths and 1-line context where the data is present).

Also verify that the entry is not already implemented by checking the current card-definition surfaces outside `./docs`, especially:

- `lib/card-types.ts`
- `lib/card-data/validation.ts`
- `lib/card-groups.ts`
- `lib/card-generator.ts`
- `README.md`
- `openapi.yaml`

## Output expectations

- Output a single Markdown file saved as `./docs/NEW_CARD_TYPES.md`.
- The unified document must include:
  - **Metadata header:** combiner model id, date, input files used, number of unique ideas.
  - **Short summary table:** (`Proposed ID | Name | Type | Category | Feasibility | Complexity`).
  - **Grouped sections by Category** (for example Anime / Manga / User / Social / Character / Studio / Trend / Comparative / Other).
  - **Each card entry in the normalized format:**
    - Title (display name)
    - Proposed ID
    - Proposal Type
    - Category
    - One-line Description
    - Why it is distinct
    - Feasibility
    - Complexity
    - Duplicate Check / evidence
    - Required Data (exact AniList GraphQL fields OR local data paths)
    - Nearest existing implementation (similar card/template/helper)
    - Sample AniList GraphQL query (if applicable)
    - UI/Visual suggestion
    - Sources
    - Notes / risks (optional)

## Additional guidance & quality checks

- Preserve valuable material from every input file, but normalize tone and structure.
- Standardize proposed ids to camelCase and display names to readable title case.
- If an idea is better framed as a new variant of an existing card than a brand-new card type, classify it as `new variant`.
- Prefer implementation-oriented sections and wording that a future coding agent can use directly.
- Order entries within each category by feasibility first, then complexity.
- If only one proposal file is provided, still normalize, verify, prune, and strengthen it rather than copying it through unchanged.

## Finish

- Save the unified Markdown file to `./docs/NEW_CARD_TYPES.md`.
- Do not change code; this is a research artifact only.
- Ensure the final file is deduplicated, evidence-backed, and ready for downstream implementation work.
- If the combiner model id is not provided by the runtime, use a sensible explicit fallback such as `unknown-combiner-model` instead of leaving it blank.
