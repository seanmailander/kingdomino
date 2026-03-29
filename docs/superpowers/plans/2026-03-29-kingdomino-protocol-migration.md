# kingdomino-protocol Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the universal wire-protocol code out of `packages/client/src/game/state/` into the `packages/kingdomino-protocol/` package, and update the client to import from the package instead.

**Scope (Phase 1 only):** This plan migrates *existing* files. The architecture report (section 9.4) also describes four new abstractions (`PlayerActor` interface, `RemotePlayerActor`, `GameDriver`, `MoveStrategy`) that do not yet exist as code — those are deferred to a future phase.

**Architecture:** Five source files are universal across all Kingdomino clients (`game.messages.ts`, `ConnectionManager.ts`, `connection.multiplayer.ts`, `ai.player.ts`, `connection.testing.ts`) and belong in `kingdomino-protocol`. Note: `connection.testing.ts` is classified "No (as-is)" by the spec because it's tied to the current `IGameConnection` shape; it is moved here anyway as a test utility with the understanding it will be refactored in a future phase when the actor model is adopted. Client-specific files (`game.flow.ts`, `connection.solo.ts`) stay in the client. After migration, the client gains `kingdomino-protocol` as a dependency and imports all protocol types from there.

**Tech Stack:** TypeScript, Vitest, npm workspaces (no new tools)

---

## Baseline

- **Pre-existing failing tests (do not regress these):**
  - `game.flow.test.ts` > LobbyFlow game completion > transitions room to GameEnded … (1 unit failure)
  - All `PlayRulesVisualTdd`, `ScoringRulesVisualTdd`, `SetupRulesVisualTdd`, `SoloGameVisualTdd` Storybook stories (11 Storybook failures)
  - Total: 12 failed, 95 passed before migration
- After migration, all 95 currently-passing tests must still pass (or any new failures logged as todos)

---

## File Structure

### Files created in `packages/kingdomino-protocol/src/`

| File | Source | Notes |
|------|--------|-------|
| `game.messages.ts` | Copied from client | No import changes needed |
| `ConnectionManager.ts` | Copied from client | Update relative import `./game.messages` → keep as-is (same package) |
| `connection.multiplayer.ts` | Copied from client | Same relative import |
| `ai.player.ts` | Copied from client | No relative imports (only `kingdomino-engine`) |
| `connection.testing.ts` | Copied from client | Update relative import `./game.messages` → keep as-is |
| `game.messages.control.test.ts` | Copied from client | Update import path |
| `ai.player.test.ts` | Copied from client | Update import path |
| `connection.testing.test.ts` | Copied from client | Update import paths |
| `index.ts` | Already exists (stub) | Add all exports |

### Files modified in `packages/client/src/game/state/`

| File | Change |
|------|--------|
| `game.messages.ts` | **Deleted** — replaced by package import |
| `ConnectionManager.ts` | **Deleted** — replaced by package import |
| `connection.multiplayer.ts` | **Deleted** — replaced by package import |
| `ai.player.ts` | **Deleted** — replaced by package import |
| `connection.testing.ts` | **Deleted** — replaced by package import |
| `game.messages.control.test.ts` | **Deleted** — moved to package |
| `ai.player.test.ts` | **Deleted** — moved to package |
| `connection.testing.test.ts` | **Deleted** — moved to package |
| `game.flow.ts` | Update imports to use `kingdomino-protocol` |
| `connection.solo.ts` | Update imports to use `kingdomino-protocol` |

### Files modified in `packages/client/src/game/visuals/`

| File | Change |
|------|--------|
| `GameRulesVisualTdd.shared.tsx` | Update import of `connection.testing` to `kingdomino-protocol` |

### Files modified in package configs

| File | Change |
|------|--------|
| `packages/client/package.json` | Add `"kingdomino-protocol": "*"` to dependencies |

---

## Task 1: Move protocol source files to `kingdomino-protocol`

**Files:**
- Create: `packages/kingdomino-protocol/src/game.messages.ts`
- Create: `packages/kingdomino-protocol/src/ConnectionManager.ts`
- Create: `packages/kingdomino-protocol/src/connection.multiplayer.ts`
- Create: `packages/kingdomino-protocol/src/ai.player.ts`
- Create: `packages/kingdomino-protocol/src/connection.testing.ts`

- [ ] **Step 1: Move `game.messages.ts`** — no import changes needed (only imports from `kingdomino-engine`)

```bash
mv packages/client/src/game/state/game.messages.ts \
   packages/kingdomino-protocol/src/game.messages.ts
```

- [ ] **Step 2: Move `ConnectionManager.ts`** — relative import `./game.messages` remains correct inside the package

```bash
mv packages/client/src/game/state/ConnectionManager.ts \
   packages/kingdomino-protocol/src/ConnectionManager.ts
```

- [ ] **Step 3: Move `connection.multiplayer.ts`** — relative import `./game.messages` remains correct

```bash
mv packages/client/src/game/state/connection.multiplayer.ts \
   packages/kingdomino-protocol/src/connection.multiplayer.ts
```

- [ ] **Step 4: Move `ai.player.ts`** — only imports from `kingdomino-engine`, no change needed

```bash
mv packages/client/src/game/state/ai.player.ts \
   packages/kingdomino-protocol/src/ai.player.ts
```

- [ ] **Step 5: Move `connection.testing.ts`** — relative import `./game.messages` remains correct

```bash
mv packages/client/src/game/state/connection.testing.ts \
   packages/kingdomino-protocol/src/connection.testing.ts
```

---

## Task 2: Move test files to `kingdomino-protocol`

**Files:**
- Create: `packages/kingdomino-protocol/src/game.messages.control.test.ts`
- Create: `packages/kingdomino-protocol/src/ai.player.test.ts`
- Create: `packages/kingdomino-protocol/src/connection.testing.test.ts`

- [ ] **Step 1: Move `game.messages.control.test.ts`** — relative import `./game.messages` stays correct

```bash
mv packages/client/src/game/state/game.messages.control.test.ts \
   packages/kingdomino-protocol/src/game.messages.control.test.ts
```

- [ ] **Step 2: Move `ai.player.test.ts`** — relative import `./ai.player` stays correct

```bash
mv packages/client/src/game/state/ai.player.test.ts \
   packages/kingdomino-protocol/src/ai.player.test.ts
```

- [ ] **Step 3: Move `connection.testing.test.ts`** — relative imports stay correct; `kingdomino-commitment` devDep added in Task 3

```bash
mv packages/client/src/game/state/connection.testing.test.ts \
   packages/kingdomino-protocol/src/connection.testing.test.ts
```

*Note: Do NOT run `npm test` here yet — `kingdomino-commitment` devDep is added in Task 3. Run tests after Task 3.*

---

## Task 3: Update `kingdomino-protocol/src/index.ts` and `package.json`

**Files:**
- Modify: `packages/kingdomino-protocol/src/index.ts`
- Modify: `packages/kingdomino-protocol/package.json`

- [ ] **Step 1: Update `package.json`** — add `kingdomino-commitment` as a devDep so tests can use it

In `packages/kingdomino-protocol/package.json`, add to `devDependencies`:
```json
"kingdomino-commitment": "*"
```

Then run `npm install` from the workspace root to link it:
```bash
cd /path/to/workspace/root && npm install
```

- [ ] **Step 2: Replace `index.ts` stub with full exports**

```typescript
// Wire message vocabulary
export * from "./game.messages";
// Protocol adapters
export { ConnectionManager } from "./ConnectionManager";
export { MultiplayerConnection } from "./connection.multiplayer";
export type { MultiplayerTransport, MultiplayerConnectionOptions } from "./connection.multiplayer";
// AI move generation
export { RandomAIPlayer } from "./ai.player";
// Test utilities
export { TestConnection } from "./connection.testing";
export type {
  TestConnectionOptions,
  TestConnectionScenario,
  TestConnectionControl,
} from "./connection.testing";
```

- [ ] **Step 3: Run protocol tests** — now that devDep is installed, all 3 test files should pass

```bash
cd packages/kingdomino-protocol && npm test
```

Expected: all tests pass (game.messages control tests, ai.player tests, connection.testing tests)

---

## Task 4: Add `kingdomino-protocol` to client dependencies and reinstall

**Files:**
- Modify: `packages/client/package.json`

- [ ] **Step 1: Add dependency to client `package.json`**

In `packages/client/package.json`, add to `dependencies`:
```json
"kingdomino-protocol": "*"
```

- [ ] **Step 2: Install from workspace root**

```bash
npm install
```

Expected: workspace links `kingdomino-protocol` into client's `node_modules`

---

## Task 5: Update `game.flow.ts` imports

**Files:**
- Modify: `packages/client/src/game/state/game.flow.ts`

- [ ] **Step 1: Replace relative imports with package imports**

Change:
```typescript
import { ConnectionManager } from "./ConnectionManager";
import type { WireMessage, WireMessagePayload, WireMessageType } from "./game.messages";
import { PICK, PLACE, DISCARD } from "./game.messages";
import { RandomAIPlayer } from "./ai.player";
```

To:
```typescript
import { ConnectionManager } from "kingdomino-protocol";
import type { WireMessage, WireMessagePayload, WireMessageType } from "kingdomino-protocol";
import { PICK, PLACE, DISCARD } from "kingdomino-protocol";
import { RandomAIPlayer } from "kingdomino-protocol";
```

(Keep `SoloConnection` import from `./connection.solo` since that stays in client)

---

## Task 6: Update `connection.solo.ts` imports

**Files:**
- Modify: `packages/client/src/game/state/connection.solo.ts`

- [ ] **Step 1: Replace relative imports with package imports**

Change imports from `"./game.messages"` and `"./ai.player"` to `"kingdomino-protocol"`:

```typescript
import {
  COMMITTMENT, PICK, PLACE, DISCARD, REVEAL, START,
  PAUSE_REQUEST, PAUSE_ACK, RESUME_REQUEST, RESUME_ACK,
  EXIT_REQUEST, EXIT_ACK,
  pickMessage, placeMessage, discardMessage,
  pauseAckMessage, resumeAckMessage, exitAckMessage,
  type WireMessage, type WireMessagePayload, type WireMessageType,
} from "kingdomino-protocol";
import type { RandomAIPlayer } from "kingdomino-protocol";
```

---

## Task 7: Update `GameRulesVisualTdd.shared.tsx` imports

**Files:**
- Modify: `packages/client/src/game/visuals/GameRulesVisualTdd.shared.tsx`

- [ ] **Step 1: Replace relative import of `connection.testing`**

Change:
```typescript
import { TestConnection, type TestConnectionScenario } from "../state/connection.testing";
```

To:
```typescript
import { TestConnection, type TestConnectionScenario } from "kingdomino-protocol";
```

---

## Task 8: Verify client tests and commit

- [ ] **Step 1: Run protocol package tests**

```bash
cd packages/kingdomino-protocol && npm test
```

Expected: all tests pass

- [ ] **Step 2: Run client tests**

```bash
cd packages/client && npm test
```

Expected: same 95 tests pass; same 12 pre-existing failures remain (no new failures introduced). If new failures appear, log as todos and continue.

- [ ] **Step 3: Log any new failures as todos in SQL**

For each new failure beyond the 12 pre-existing ones:
```sql
INSERT INTO todos (id, title, description) VALUES
  ('bug-<name>', 'Fix <failing test>', 'After protocol migration, <test> started failing. File: <path>. Error: <message>.');
```

- [ ] **Step 4: Commit** — use `git add -A` to stage both new files and deletions from `mv`

```bash
git add -A
git commit -m "feat: migrate protocol code from client to kingdomino-protocol

Move universal wire-protocol files from packages/client/src/game/state/
into packages/kingdomino-protocol/src/:
- game.messages.ts (wire vocabulary: PICK, PLACE, DISCARD, control messages)
- ConnectionManager.ts (typed protocol adapter over raw send/receive)
- connection.multiplayer.ts (WebRTC peer transport)
- ai.player.ts (RandomAIPlayer — AI move generation)
- connection.testing.ts (scripted test double)

And their accompanying tests (game.messages.control, ai.player, connection.testing).

Client files that stay (game.flow.ts, connection.solo.ts) now import
from 'kingdomino-protocol' instead of relative paths.

Phase 1 migration only. New abstractions from architecture report section 9.4
(PlayerActor, RemotePlayerActor, GameDriver, MoveStrategy) are deferred to a
future phase.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
