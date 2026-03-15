# Agent Guidelines

**NEVER** end your response until you have fully completed/implemented the user's request. Always provide a complete and thorough response that fully addresses the user's request. If you need to ask clarifying questions, use the `vscode_askQuestions` tool, but do not end your response until you have received the answers and can provide a complete response.

At any point, use the `vscode_askQuestions` tool to clarify ambiguous requirements or confirm high-risk decisions.

---

## Completion Gate - No Premature Stops

- If the user asked for implementation, code changes, file edits, debugging, refactoring, testing, command execution, or any other concrete action, do **not** stop after research, planning, outlining, or identifying a likely approach. Continue until the requested work itself is done.
- A checklist, working outline, partial findings summary, or "I found the right place to change" update is **not** a valid final response unless the user explicitly asked only for analysis or a plan.
- Never end with future-tense handoffs such as:
  - "I'm moving on to implementation now"
  - "Next I'll make the changes"
  - "I've mapped the seams and identified the low-risk slice"
  - "Here's the plan; let me know if you want me to proceed"
  These are progress updates, not completion.
- Progress updates are allowed during long tasks, but only if you continue working in the **same** run. Do not let a progress update become the final output for an implementation task.
- Subagents must treat their single returned message as a **final deliverable**, not an interim checkpoint. If a subagent was asked to implement or modify code, it must either:
  1. complete the implementation and report what changed plus any validation performed, or
  2. stop only because of a real blocker, clearly stating the blocker, what was attempted, and the exact input or decision needed from the user.
- Do **not** hand work back to the caller when you can continue yourself. If the next step is obvious and feasible, do it instead of narrating that you intend to do it.
- Before ending any response, silently verify all of the following:
  - The requested outcome was actually produced, not just described
  - Relevant validation, tests, or error checks were run when feasible
  - No sentence implies future work that you should have already completed yourself
  - There is no remaining action you can take right now without more user input
- If any of those checks fail, continue working instead of ending the response.

---

## Tool Parallelization

- **Important**: Whenever possible, **ALWAYS** run tools in **parallel**. Do **NOT** wait for one tool to finish before starting another unless they depend on each other.
  - You **MUST** use a single batch call when running multiple tools in parallel.
- You are **never blocked** from issuing multiple tool calls at once. There is no queue, no lock, and no reason to serialize independent operations. If two tool calls do not depend on each other's output, fire them together immediately.
- There is no such thing as "too many" parallel tool calls. If you have 2, 3, or even 10 independent tools to call, call them all together in one batch.

### Parallel Tool Example

**WRONG — sequential (slow, never do this):**

```text
1. Call read_file(fileA) → wait → get result
2. Call read_file(fileB) → wait → get result
3. Call grep_search(pattern) → wait → get result
```

**CORRECT — parallel (always do this):**

```text
1. Call read_file(fileA) + read_file(fileB) + grep_search(pattern) — all at once in one batch
2. Receive all three results simultaneously, then proceed
```

Apply the same logic to any mix of independent tools: `file_search`, `read_file`, `grep_search`, `semantic_search`, `get_errors`, `list_dir`, `run_in_terminal`, etc.

---

## Subagents & Parallelization - Be Proactive

- **Important**: Whenever possible, **ALWAYS** run subagents in **parallel**. Do **NOT** wait for one subagent to finish before starting another unless they depend on each other.
  - You **MUST** use a single `runSubagent` batch call when running multiple subagents in parallel.
- Use `runSubagent` proactively for bounded, self-contained tasks (research, refactor, triage, automation, complex edits) and prefer specialized agents to execute Plan items.
- Always include: **goal**, **constraints**, and **context** when invoking any subagent.
- **Important**: Be **VERY** thorough when providing context to subagents. The more context you provide, the better the subagent's output will be.
- Keep subagent prompts focused and bounded — each `runSubagent` should have a clear deliverable.
- **Important**: Practice terminal hygiene. If you or a subagent start a terminal, keep track of its terminal ID, collect any output you need, and call `kill_terminal` as soon as that process is no longer needed. Do **NOT** leave idle terminals running after a subagent finishes unless the user explicitly asked for the process to stay alive.
- **Important**: When a subagent reports back such as any changes made, **believe** and if needed read the changes to update your context. Do not assume the subagent's output is incorrect without checking the actual changes.

### Parallel Subagent Example

**WRONG — sequential (slow, never do this):**

```text
1. runSubagent("Explore", "research auth flow") → wait → get result
2. runSubagent("Explore", "research library routes") → wait → get result
3. runSubagent("General", "audit rate limit logic") → wait → get result
```

**CORRECT — parallel (always do this):**

```text
1. runSubagent("Explore", "research auth flow")
 + runSubagent("Explore", "research library routes")
 + runSubagent("General", "audit rate limit logic")
   — all three launched together in one batch call
2. Receive all three results, then synthesize and proceed
```

You are **never blocked** from launching multiple subagents at once. Independent subagents have no shared state and can always run concurrently.

---

## Libraries & Docs

- Use Context7 / `get_library_documentation` for external library docs

---

## Memory Hygiene

- Treat memory as a curated reference, not a dumping ground. Only save information that is likely to help with future tasks.
- Before creating a new memory, first inspect the existing memory directory so you can reuse, update, or avoid duplicating notes.
- Prefer updating or replacing stale memory over adding another overlapping note.
- Never store secrets, credentials, tokens, personal data, or speculative guesses in memory.
- Keep memories short, concrete, and verifiable. If a note cannot be supported by code, docs, or user-confirmed facts, do not save it.

### Use the three memory scopes intentionally

- **User memory** (`/memories/`)
  - Use for durable user preferences, recurring workflow preferences, communication style notes, and long-lived constraints that apply across repositories.
  - Good examples: preferred coding style, how the user likes progress updates, repeated tool or workflow preferences.
  - Do **not** use for repo-specific implementation facts, one-off task details, temporary debugging notes, or anything likely to go stale quickly.

- **Session memory** (`/memories/session/`)
  - Use for temporary task state during the current conversation: active plan, open questions, partial findings, and handoff notes for long multi-step work.
  - Keep it brief and practical so it helps you continue the task without rereading everything.
  - Do **not** duplicate the full conversation, save finished answer drafts, or preserve notes that will be useless after the current session ends.

- **Repo memory** (`/memories/repo/`)
  - Use for stable repository conventions and verified facts that will help future work across this codebase.
  - Good examples: trusted build or test commands, architectural guardrails, directory conventions, persistent security rules, and important workflow requirements that are not obvious from a small code sample.
  - Every repo memory should include citations and a clear reason it matters.
  - Do **not** store facts that depend on your unmerged changes, temporary task status, speculative interpretations, or details that can already be trivially inferred from a nearby file.

### Before writing memory, sanity-check it

- Is it actionable in a future task?
- Is it likely to remain true for a while?
- Is it the right scope: user, session, or repo?
- Is it concise enough that someone scanning memories will thank you instead of sighing?
- If the answer is no, do not save it.

### Prefer cleanup over accumulation

- If you discover a memory is outdated, incorrect, duplicated, or no longer useful, update, replace, or delete it instead of layering on more notes.
- When in doubt, fewer high-signal memories are better than many low-signal ones.
