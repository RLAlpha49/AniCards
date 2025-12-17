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

Subagents are powerful autonomous agents designed to handle complex, multi-step tasks efficiently. They operate statelessly, meaning each invocation is independent, and they can complete tasks without ongoing interaction. Use subagents frequently to accelerate development, especially for research, refactoring, or repetitive tasks.

### When to Use Subagents

- **Research and Planning**: For gathering information, analyzing codebases, or outlining multi-step plans (e.g., "Research best practices for [topic] and provide a plan").
- **Code Refactoring**: Repo-scoped changes like renaming symbols, updating patterns, or cleaning up code across multiple files.
- **Triage and Debugging**: Investigating issues, running tests, or analyzing errors in large codebases.
- **Automation**: Repeatable tasks such as generating tests, updating dependencies, or applying code standards.
- **Complex Edits**: When a task involves multiple files, requires deep analysis, or benefits from specialized expertise (e.g., accessibility, performance).

### Best Practices for Effective Subagent Use

- **Be Specific**: Provide detailed prompts with clear goals, constraints, and expected outputs. Include validation steps (e.g., "Run tests after changes").
- **Choose the Right Agent**: Select from available subagents based on expertise (e.g., "Expert Next.js Developer" for routing issues).
- **Bound Tasks**: Ensure tasks are self-contained and completable in one run. Avoid open-ended or interactive tasks.
- **Validation**: Always include steps for verification, such as running lints, tests, or builds.
- **Leverage Memories**: Reference relevant project memories for context to improve subagent accuracy.

### Examples

- **Refactor API Routes**: "Refactor all API routes in `/api` to use the new error handling pattern from memory `error-handling-implementation`. Run tests and lint after changes."
- **Accessibility Audit**: "Use Accessibility Expert to audit components in `/components` for WCAG compliance. Provide a report with fixes."
- **Performance Optimization**: "Analyze and optimize bundle size in Next.js app. Suggest changes and implement them."
- **Code Cleanup**: "Use Janitor to remove unused imports and simplify code across the project."

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
