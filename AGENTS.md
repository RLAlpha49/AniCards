# AniCards - AI Assistant

## Quick workflow (required)

1. **Always** Activate: `mcp_oraios_serena_activate_project "AniCards"`
2. Use Serena exploration tools for discovery: `get_symbols_overview`, `find_symbol`, `search_for_pattern`, `list_dir`
3. After exploring: `think_about_collected_information`; before edits: `think_about_task_adherence`; for non-trivial or multi-step work, proactively run the `Plan` subagent to get an implementable plan before editing; after finishing: `think_about_whether_you_are_done`
4. Prefer symbolic tools over reading full files unless necessary
5. **ALWAYS** run the `Janitor` subagent after any code edits (even if no subagent was used) to perform cleanup and review.

## Modes (serena)

- Trivial / small: `["one-shot","editing"]` — quick edit
- Medium: `["planning","editing"]` — brief plan then edit
- Large / risky: `["planning","interactive","editing"]` — require interactive validation

## Subagents — Be proactive ⚡

- Use the `Plan` subagent proactively as the first step for tasks. Ask `Plan` for an implementable plan. Run `Plan` before making edits or invoking other subagents whenever practical.
- When you have multiple distinct tasks, run the `Plan` subagent separately for each task — **DO NOT** create one Plan that attempts to fully plan multiple unrelated tasks at once. Each Plan must be focused and produce an implementable set of steps for that single task.
- Use `runSubagent` proactively for bounded, self-contained tasks (research, refactor, triage, automation, complex edits) and prefer specialized agents to execute Plan items.
- Always include: **goal**, **constraints**, and **context** when invoking any subagent.
- **ALWAYS** run the `Janitor` subagent at the end of every implementation `runSubagent` invocation to perform cleanup and review.
- Common agents: Plan, Accessibility Expert, Expert Next.js Developer, Expert React Frontend Engineer, Janitor

Concrete example — 3-task subagent workflow (required):

1. Scenario: you have three tasks (Task A, Task B, Task C).

2. For Task A (repeat the same required cycle for Task B and Task C):
   - Run the `Plan` subagent first, with a prompt that includes **goal**, **constraints**, and **context**. This step is required; do not proceed to implementation without a Plan. Example:
     `runSubagent({agentName: "Plan", prompt: "Goal: Add pagination to /api/get-cards\nConstraints: keep backwards compatibility; minimal breaking changes\nContext: repo path: app/api/get-cards; current API params: page, perPage", description: "Plan pagination for /api/get-cards"})`
   - Use the Plan output as the instruction for an implementation subagent (specialist). Example:
     `runSubagent({agentName: "Expert Next.js Developer", prompt: "Implement the following plan:\n<PASTE PLAN OUTPUT>\nRun tests and commit changes", description: "Implement Task A (pagination)"})`
   - Run the `Janitor` subagent after each task to review, simplify, and clean up changes. Example:
     `runSubagent({agentName: "Janitor", prompt: "Review Task A changes: simplify code, ensure consistent style, adjust/add tests, and suggest follow-up cleanups", description: "Janitor for Task A"})`

3. Repeat the required Plan → Implementer → Janitor cycle for Task B and Task C. After all tasks are complete, run one additional final cross-task `Janitor` to review cross-task consistency, ensure overall style and test coverage, and suggest follow-up cleanups. Do not skip this final Janitor run.

Notes:

- Always include **goal**, **constraints**, and **context** when invoking any subagent.
- Provide the Plan's output verbatim to the implementation subagent.
- Keep subagent prompts focused and bounded — each `runSubagent` should have a clear deliverable.

## Libraries & Docs

- AniList: **Always use reference documentation at [https://docs.anilist.co/reference/](https://docs.anilist.co/reference/)**
- Use Context7 / `get_library_documentation` for external library docs

## Memory policy

- Store only essential project context (patterns, decisions). Do not store docs or large summaries.

**Critical:** Activate the project first and keep agent prompts concise.
