# AniCards - AI Coding Assistant Instructions

## 🚨 CRITICAL: Workflow

**ALWAYS follow this sequence**:

1. `mcp_oraios_serena_activate_project "AniCards"` - Activate project first
2. Explore with Serena tools (`get_symbols_overview`, `find_symbol`, `search_for_pattern`, `list_dir`)
3. Use `think_about_collected_information` after gathering context
4. Make precise edits
5. Use `think_about_task_adherence` before committing changes
6. Use `think_about_whether_you_are_done` to verify completion

**KEY**: Use Serena tools for discovery, not reading files unless necessary. Always read any relevant memories for context if needed. Memories are for context only, NOT documentation summaries. Never summarize changes or create summary documents unless explicitly asked to, this applies to things outside of memories as well.

## 📚 Context7 Integration

**Always `use context7`** when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.

## Serena Modes & Adaptive Behavior

**Default modes:** `["planning", "editing"]`

Always assume the default modes are active to ensure modes are correctly set and you don't forget to change them.

Always use the `switch_modes` tool to adapt modes based on task complexity. NOTE: Reserve `interactive` only for large or risky changes that require clarification; avoid `interactive` for routine small edits to reduce unnecessary prompts.

| Task Type               | Modes                                                         | When to Use                                                                                           |
| ----------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Trivial fixes**       | `["one-shot", "editing"]`                                     | Skip planning overhead, make & verify immediately                                                     |
| **Small edits**         | `["one-shot", "editing"]`                                     | Quick changes — avoid interactive prompts; no detailed planning needed                                |
| **Medium features**     | `["planning", "editing"]`                                     | Brief 3–6 item plan, explore, edit incrementally; only use interactive when clarification is required |
| **Large/risky changes** | `["planning", "interactive", "editing"]` + extra verification | Thorough planning & verification at every checkpoint                                                  |

**Thinking Tools — Use at Relevant Checkpoints:**

- **`think_about_collected_information`** → After exploring code, verify context is sufficient before editing
- **`think_about_task_adherence`** → Before making changes, confirm the approach is still correct
- **`think_about_whether_you_are_done`** → After completing work, verify all requirements are met

_Use these thinking tools whenever applicable, not just for the largest changes._

## Serena Tools

### Exploration Tools (Code Discovery)

- **`get_symbols_overview`**: High-level view of top-level symbols in a file
- **`find_symbol`**: Locate specific symbol by name path with optional depth
- **`search_for_pattern`**: Regex search when you don't know exact symbol names
- **`list_dir`**: Understand project structure
- **`find_file`**: Search files by glob pattern

**Best Practice**: Always explore with these tools BEFORE reading files. Saves tokens and time.

## Subagent (runSubagent)

- This workspace supports a `runSubagent` tool to launch a single-run, stateless autonomous agent for bounded, repeatable tasks (e.g., repo-scoped refactors, triage, or research).
- Use the subagent where tasks can be completed autonomously and include explicit validation steps (e.g., lints/tests). Use the subagent when possible/useful to automate repeatable, bounded tasks that don't require continuous human interaction.
- For templates, examples, and detailed guidance, see the Serena memory `subagent-usage` (use `read_memory` to access the reference).

## Memory Strategy

Use memories for context only:

- **Project patterns**: Recurring code patterns, conventions, architectural rules
- **Critical decisions**: Why certain choices were made, constraints to maintain
- **Essential workflows**: Complex multi-step processes that are hard to discover

**Do NOT write memories for**: Documentation summaries, code overviews, or API reference (use Serena tools instead).

**Critical Success Factors:**

- ✅ Always activate project before using Serena tools
- ✅ Use Serena tools for code exploration before reading files
- ✅ Switch modes based on task complexity
- ✅ Use serena thinking tools at relevant checkpoints
- ✅ Write memories only for essential context, not documentation summaries
