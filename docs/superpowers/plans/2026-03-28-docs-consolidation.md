# Documentation Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add index files and cross-references so agents can discover all project documentation from AGENTS.md without filesystem exploration.

**Architecture:** Five new/updated files form a discoverable hub-and-spoke structure: AGENTS.md → docs/README.md → per-directory indexes (.agents/skills/README.md, docs/superpowers/README.md) + one missing piece (server/README.md). No content is moved; only navigation is added.

**Tech Stack:** Markdown only — no code changes.

---

## Inventory of Current Documentation

### Files that exist but are not cross-referenced from AGENTS.md

| File | What it covers |
|------|---------------|
| `client/src/game/readme.md` | Game module architecture (logic / state / visuals layers) |
| `client/src/game/testing.md` | Test scenarios by domain (50+ test cases) |
| `client/README.md` | Client dev scripts (start, build, preview, test) |
| `server/` | ❌ No README — completely undocumented |
| `.agents/skills/` | 9 skills — no index, must explore to discover |
| `docs/superpowers/specs/` | 5 design specs — no index |
| `docs/superpowers/plans/` | 3 implementation plans — no index |
| `docs/` | No top-level index |

### Files that are already cross-referenced in AGENTS.md

- `client/src/CLAUDE.md` — mentioned inline in Code Conventions section
- `client/.storybook/` — mentioned in Key Directories table
- All `client/src/game/state/` and `client/src/game/gamelogic/` paths

---

## File Map (files created or modified)

| Action | Path | Responsibility |
|--------|------|---------------|
| **Create** | `docs/README.md` | Top-level doc hub; links every doc file with one-line purpose |
| **Create** | `server/README.md` | Server architecture, purpose, scripts, key files |
| **Create** | `.agents/skills/README.md` | Skills index: name, when to invoke, one-liner per skill |
| **Create** | `docs/superpowers/README.md` | Specs + plans index with dates and status |
| **Modify** | `AGENTS.md` | Add "Documentation Map" section linking all sub-documents |

---

## Task 1: Create `docs/README.md` — Top-Level Documentation Hub

**Files:**
- Create: `docs/README.md`

- [ ] **Step 1: Create the file**

```markdown
# Kingdomino Documentation

Navigation hub for all project documentation. Start here.

---

## For Agents

The authoritative agent context is **[`AGENTS.md`](../AGENTS.md)** at the repo root — it is injected into every agent session. This file supplements it with links to all sub-documents.

---

## Project Overview

| File | Purpose |
|------|---------|
| [`README.md`](../README.md) | Project overview, roadmap, constraints |
| [`rules.md`](../rules.md) | Official Kingdomino board game rules |
| [`RESEARCH.md`](../RESEARCH.md) | Research notes: fair-play crypto, shuffling, P2P |

---

## Client (`client/`)

| File | Purpose |
|------|---------|
| [`client/README.md`](../client/README.md) | Dev scripts: start, build, preview, test |
| [`client/src/CLAUDE.md`](../client/src/CLAUDE.md) | TypeScript code conventions for client/src |
| [`client/src/game/readme.md`](../client/src/game/readme.md) | Game module architecture (logic / state / visuals layers) |
| [`client/src/game/testing.md`](../client/src/game/testing.md) | Test plan: 50+ scenarios across deck, placement, scoring, rounds |

---

## Server (`server/`)

| File | Purpose |
|------|---------|
| [`server/README.md`](../server/README.md) | Server purpose, scripts, key files |

---

## Agent Skills (`.agents/skills/`)

| File | Purpose |
|------|---------|
| [`.agents/skills/README.md`](../.agents/skills/README.md) | Index of all available skills with when-to-invoke summaries |

---

## Design Specs & Implementation Plans (`docs/superpowers/`)

| File | Purpose |
|------|---------|
| [`docs/superpowers/README.md`](superpowers/README.md) | Index of all specs and plans with dates and status |
```

- [ ] **Step 2: Verify file was created**

```bash
cat docs/README.md
```
Expected: File prints cleanly with all links present.

- [ ] **Step 3: Commit**

```bash
git add docs/README.md
git commit -m "docs: add top-level documentation index

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: Create `server/README.md` — Server Documentation

**Files:**
- Create: `server/README.md`

> **Context:** The server is purely a signaling layer — it uses Node.js, Express, the `peer` PeerJS server, and `multicast-dns` for mDNS. It has no game logic and no real test suite. Key files: `server/index.js` (entry), `server/package.json`.

- [ ] **Step 1: Read server package.json to confirm scripts and dependencies**

```bash
cat server/package.json
```

- [ ] **Step 2: List key server source files**

```bash
ls server/
```

- [ ] **Step 3: Create the file using what you found**

```markdown
# Kingdomino Signaling Server

This is a **minimal signaling server only** — it has no game logic. All game rules and state live in the client.

## Purpose

1. **PeerJS peer discovery** — lets clients find each other by peer ID
2. **mDNS advertisement** — broadcasts `kingdomino.local` on the local network so clients can reach the server without internet

## Tech Stack

- Node.js + Express
- `peer` — PeerJS server (WebRTC signaling)
- `multicast-dns` — mDNS/Bonjour advertisement

## Available Scripts

In the `server/` directory:

### `npm start`
Starts the signaling server (default port 9000).

### `npm run lint`
Runs the linter.

> **Note:** There is no real test suite for the server.

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Entry point — sets up Express, PeerJS server, mDNS advertisement |
| `package.json` | Dependencies and scripts |

## Relationship to Client

The client connects to this server only to discover other peers. Once two clients have each other's peer IDs, all game communication is **direct peer-to-peer via WebRTC** — the server is no longer involved.
```

- [ ] **Step 4: Verify file was created**

```bash
cat server/README.md
```

- [ ] **Step 5: Commit**

```bash
git add server/README.md
git commit -m "docs: add server README explaining signaling-only role

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Create `.agents/skills/README.md` — Skills Index

**Files:**
- Create: `.agents/skills/README.md`

- [ ] **Step 1: List all skill directories to confirm names**

```bash
ls .agents/skills/
```
Expected: brainstorming, dispatching-parallel-agents, executing-plans, subagent-driven-development, systematic-debugging, test-driven-development, using-superpowers, verification-before-completion, writing-plans

- [ ] **Step 2: Create the index**

```markdown
# Agent Skills Index

All skills live in `.agents/skills/<skill-name>/SKILL.md`.

In Claude Code, invoke with the `Skill` tool. In Gemini CLI, use `activate_skill`.

> **Rule:** If there is even a 1% chance a skill applies, invoke it. See `using-superpowers` for the full decision flow.

---

## Available Skills

### `using-superpowers` ⭐ Start Here
**Invoke:** At the start of every conversation.  
Establishes how and when to use all other skills. Defines instruction priority (user > skills > defaults) and provides the skill-invocation decision flowchart.

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
```

- [ ] **Step 3: Verify file was created**

```bash
cat .agents/skills/README.md
```

- [ ] **Step 4: Commit**

```bash
git add .agents/skills/README.md
git commit -m "docs: add skills index with when-to-invoke guide

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Create `docs/superpowers/README.md` — Specs & Plans Index

**Files:**
- Create: `docs/superpowers/README.md`

- [ ] **Step 1: List all specs and plans to confirm exact filenames**

```bash
ls docs/superpowers/specs/ && ls docs/superpowers/plans/
```

- [ ] **Step 2: Create the index**

The status for each spec/plan should be inferred by reading the actual file briefly. Do not copy status values from this plan verbatim — verify each one. Use these rules: spec with no matching plan = `design-only`; spec with a matching plan = `planned`; plan currently being worked = `in-progress`.

```markdown
# Superpowers Specs & Plans

Design specs live in `docs/superpowers/specs/`.  
Implementation plans live in `docs/superpowers/plans/`.

Specs are written by the `brainstorming` skill. Plans are written by the `writing-plans` skill.

---

## Design Specs

| File | Topic | Status |
|------|-------|--------|
| [`2026-03-25-real-game-visual-tests-design.md`](specs/2026-03-25-real-game-visual-tests-design.md) | Real game visual test harness design | planned |
| [`2026-03-26-discard-protocol-design.md`](specs/2026-03-26-discard-protocol-design.md) | Two discard bugs: protocol fix | approved |
| [`2026-03-26-single-player-ai-design.md`](specs/2026-03-26-single-player-ai-design.md) | RandomAIPlayer with mirrored GameSession | planned |
| [`2026-03-27-full-game-loop-menu-start-pause-exit-design.md`](specs/2026-03-27-full-game-loop-menu-start-pause-exit-design.md) | Full game loop: menu / start / pause / exit | planned |
| [`2026-03-28-solo-game-story-e2e-refactor-design.md`](specs/2026-03-28-solo-game-story-e2e-refactor-design.md) | SoloGameVisualTdd → pure App e2e story | planned |

---

## Implementation Plans

| File | Topic | Status |
|------|-------|--------|
| [`2026-03-27-single-player-ai.md`](plans/2026-03-27-single-player-ai.md) | RandomAIPlayer implementation | in-progress |
| [`2026-03-27-full-game-loop-menu-start-pause-exit.md`](plans/2026-03-27-full-game-loop-menu-start-pause-exit.md) | Full game loop UI | in-progress |
| [`2026-03-28-solo-game-story-e2e-refactor.md`](plans/2026-03-28-solo-game-story-e2e-refactor.md) | SoloGameVisualTdd e2e refactor | in-progress |
| [`2026-03-28-docs-consolidation.md`](plans/2026-03-28-docs-consolidation.md) | Documentation structure & navigation | in-progress |
```

- [ ] **Step 3: Verify file was created**

```bash
cat docs/superpowers/README.md
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/README.md
git commit -m "docs: add superpowers specs and plans index

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: Update `AGENTS.md` — Add Documentation Map Section

**Files:**
- Modify: `AGENTS.md` (append a new section before the closing)

- [ ] **Step 1: Read the current AGENTS.md to find the right insertion point**

```bash
cat AGENTS.md
```
The file ends after "Quality Guardrails". The new section goes at the very end.

- [ ] **Step 2: Append the Documentation Map section**

Add the following at the end of `AGENTS.md`:

```markdown

---

# Documentation Map

Use this map to navigate all project documentation without filesystem exploration.

## Top-Level Index
- [`docs/README.md`](docs/README.md) — Hub: links to every doc file in the project

## Code Conventions & Architecture
- [`client/src/CLAUDE.md`](client/src/CLAUDE.md) — TypeScript conventions for client/src (typing, exports, OOP vs pure)
- [`client/src/game/readme.md`](client/src/game/readme.md) — Game module architecture: logic / state / visuals layers and their dependencies
- [`client/src/game/testing.md`](client/src/game/testing.md) — Test plan: 50+ domain-driven scenarios across deck, placement, scoring, rounds

## Client & Server Setup
- [`client/README.md`](client/README.md) — Dev scripts: start, build, test, preview
- [`server/README.md`](server/README.md) — Signaling server: purpose, scripts, key files

## Agent Skills
- [`.agents/skills/README.md`](.agents/skills/README.md) — Index of all skills with when-to-invoke summaries and workflow

## Design History
- [`docs/superpowers/README.md`](docs/superpowers/README.md) — Index of all specs and implementation plans with status
```

- [ ] **Step 3: Verify the section was added cleanly**

```bash
tail -30 AGENTS.md
```
Expected: Documentation Map section appears at the end.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add Documentation Map section to AGENTS.md

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Final Verification

- [ ] **Confirm all new files exist**

```bash
ls docs/README.md server/README.md .agents/skills/README.md docs/superpowers/README.md
```
Expected: All 4 files listed.

- [ ] **Confirm AGENTS.md has the Documentation Map**

```bash
grep -n "Documentation Map" AGENTS.md
```
Expected: Line number printed.

- [ ] **Confirm no broken relative links in docs/README.md**

```bash
# Check that every linked file actually exists (macOS-compatible, no -P flag)
grep -oE '\(([^)]+)\)' docs/README.md | tr -d '()' | grep '^\.' | while read link; do
  resolved="docs/$link"
  [ -f "$resolved" ] && echo "OK: $link" || echo "MISSING: $link"
done
```
Expected: All lines print `OK:`.

- [ ] **Final commit summary**

```bash
git log --oneline -6
```
Expected: 5 new commits (one per task) visible in log.
