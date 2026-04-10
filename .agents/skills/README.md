# Agent Skills Index

All skills live in `.agents/skills/<skill-name>/SKILL.md`.

In Claude Code, invoke with the `Skill` tool. In Gemini CLI, use `activate_skill`.

> **Rule:** If there is even a 1% chance a skill applies, invoke it. See `using-superpowers` for the full decision flow.

---

## Available Skills

### `using-superpowers` ⭐ Start Here
**Invoke:** At the start of every conversation.  
Establishes how and when to use all other skills. Defines instruction priority (user > skills > defaults) and provides the skill-invocation decision flowchart.

### `session-priming`
**Invoke:** At the start of every new session, after `/clear`, or after context compaction.  
Loads project context (beads, git state, open work, memories, test baseline) so every session starts from a consistent, informed baseline. Context before action.

### `brainstorming`
**Invoke:** Before any creative work — new features, components, functionality, or behavior changes.  
Collaborative design dialogue that produces an approved spec before any code is touched. Hard gate: no implementation without design approval.

### `writing-plans`
**Invoke:** When you have a spec or requirements for a multi-step task, before touching code.  
Produces a bite-sized implementation plan (2–5 min steps) with exact file paths, code snippets, and commands. Saved to `docs/superpowers/plans/`.

### `subagent-driven-development`
**Invoke:** When executing an implementation plan in the current session.  
Dispatches a fresh subagent per task with two-stage review (spec compliance, then code quality). Recommended over `executing-plans` when subagent support is available.

### `executing-plans`
**Invoke:** When executing a written plan in a separate session without subagent support.  
Sequential plan execution with review checkpoints. Falls back from `subagent-driven-development` on platforms without subagent support.

### `dispatching-parallel-agents`
**Invoke:** When facing 2+ independent tasks with no shared state or sequential dependencies.  
One agent per independent problem domain, dispatched concurrently. Use for multiple unrelated test failures or independent investigations.

### `systematic-debugging`
**Invoke:** When encountering any bug, test failure, or unexpected behavior — before proposing fixes.  
Iron law: no fixes without root cause investigation first. Four-phase process: investigate → analyze patterns → hypothesis → implement.

### `test-driven-development`
**Invoke:** When implementing any feature or bugfix, before writing implementation code.  
Iron law: no production code without a failing test first. Red → green → refactor cycle enforced at every step.

### `verification-before-completion`
**Invoke:** Before claiming work is complete, fixed, or passing.  
Iron law: no completion claims without fresh verification evidence. Run the proof command, read the output, then make the claim.

---

## Skill Workflow

```
session-priming (every session start)
  → using-superpowers (skill routing)

brainstorming (design)
  → writing-plans (task breakdown)
    → subagent-driven-development (execute with reviews)
      → verification-before-completion (prove success)

systematic-debugging (any bug/failure, before fixing)
test-driven-development (any implementation)
dispatching-parallel-agents (independent parallel work)
```

---

## Supporting Files

Each skill directory may contain reference files, subagent prompt templates, and examples:

| Skill | Supporting Files |
|-------|----------------|
| `brainstorming` | `spec-document-reviewer-prompt.md` |
| `subagent-driven-development` | `implementer-prompt.md`, `spec-reviewer-prompt.md`, `code-quality-reviewer-prompt.md` |
| `systematic-debugging` | `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`, `find-polluter.sh` |
| `test-driven-development` | `testing-anti-patterns.md` |
| `using-superpowers` | `references/codex-tools.md`, `references/gemini-tools.md` |
| `writing-plans` | `plan-document-reviewer-prompt.md` |
