---
name: session-priming
description: Use at the start of every new session or after /clear to load project context, check git state, find available work, and establish a working baseline
---

# Session Priming

## Overview

Load project context so every session starts from the same informed baseline.

**Core principle:** Context before action. A primed session prevents wasted work from stale assumptions.

**This skill is non-negotiable at session start.** If you skipped it, stop and run it now.

## When to Use

- Start of every new conversation
- After `/clear` or context compaction
- After long idle periods where context may have been lost
- When unsure of project state

## The Priming Sequence

Run these steps in order. Do not skip steps. Do not start work until priming is complete.

### 1. Load Beads Context

```bash
bd prime
```

This recovers the task tracker, session close protocol, and command reference.

### 2. Check Git State

```bash
git branch --show-current
git status
git log --oneline -5
```

Know: what branch you're on, whether there are uncommitted changes, and what happened recently.

### 3. Find Available Work

```bash
bd ready
bd list --status=in_progress
```

Know: what's claimable and what's already in flight.

### 4. Load Beads Memories

```bash
bd memories
```

Recover persistent insights from prior sessions. If this fails (lock contention), note it and move on.

### 5. Verify Test Baseline

```bash
cd packages/client && npx vitest run --project unit 2>&1 | tail -5
```

Know: are tests green before you touch anything? If not, note failures — they're pre-existing.

### 6. Report State

Summarize to the user:

| Item | What to report |
|------|---------------|
| **Branch** | Current branch, clean/dirty status |
| **Recent work** | Last 3–5 commits (one-line) |
| **Open issues** | Count and titles from `bd ready` / `bd list --status=in_progress` |
| **Memories** | Any relevant recovered insights |
| **Test baseline** | Green or pre-existing failures |
| **Ready** | Confirm primed and awaiting task |

## Efficiency Rules

- Steps 1–4 have no dependencies on each other — run them in parallel when possible.
- Step 5 (test baseline) can run in parallel with steps 1–4.
- Step 6 (report) waits for all prior steps.

## Red Flags — STOP

| Thought | Reality |
|---------|---------|
| "I already know the project" | Context resets between sessions. Prime anyway. |
| "User gave me a task, I should start" | Context before action. Prime first. |
| "This is just a quick fix" | Quick fixes on stale context create bugs. Prime first. |
| "I'll check git later" | You won't. Uncommitted changes get lost. Prime now. |

## After Priming

You are now ready to receive a task. When the user provides one, invoke the appropriate skill (brainstorming, TDD, debugging, etc.) per the `using-superpowers` decision flow.
