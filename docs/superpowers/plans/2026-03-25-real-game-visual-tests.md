# Real Game Visual Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scaffold-based visual rule stories with stories that run the real two-player game flow through a deterministic test connection.

**Architecture:** Refactor `LobbyFlow` so it can start with an injected connection mode or explicit connection instance, add a scenario-driven `TestConnection` that implements the existing game connection contract, and introduce Storybook harness helpers that boot the real app flow and drive deterministic scenarios. Keep UI-only orchestration stories browser-driven, while rule stories assert visible DOM from the integrated app/game surface.

**Tech Stack:** React, TypeScript, Vitest, Storybook test-runner, alien-signals

---

### Task 1: Make LobbyFlow Accept Configurable Connections

**Dependencies:** None

**Files:**

- Modify: `client/src/game/state/game.flow.ts`
- Test: `client/src/game/state/game.flow.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Add a focused `LobbyFlow` test proving the flow can be started with an explicit connection instance and that `ReadySolo()` still uses the solo connection path.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/game/state/game.flow.test.ts`
Expected: FAIL because `LobbyFlow` only hardcodes `SoloConnection`.

- [ ] **Step 3: Write minimal implementation**

Refactor `LobbyFlow` to expose a `ready(connection)`-style entry point or equivalent injected start method, keep `ReadySolo()` as a thin wrapper, and preserve the existing room/session lifecycle.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/game/state/game.flow.test.ts`
Expected: PASS.

### Task 2: Add Deterministic TestConnection

**Dependencies:** Task 1

**Files:**

- Create: `client/src/game/state/connection.testing.ts`
- Create: `client/src/game/state/connection.testing.test.ts`
- Modify: `client/src/game/state/game.flow.ts`
- Modify: `client/src/game/state/ConnectionManager.ts` (only if needed for typed hooks)

- [ ] **Step 1: Write the failing test**

Add tests for a scenario-driven `TestConnection` covering handshake messages, deterministic opponent moves, invalid move exhaustion, immediate failure on inconsistent scripts, and compatibility with the existing trusted-seed handshake so deterministic secrets still flow through `ConnectionManager.buildTrustedSeed()` without production bypasses.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/game/state/connection.testing.test.ts`
Expected: FAIL because `TestConnection` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement `TestConnection` with the `send`, `waitFor`, and `destroy` contract used by `LobbyFlow`, supporting deterministic scenario configuration for handshake values and remote move scripts.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npx vitest run src/game/state/connection.testing.test.ts`
Expected: PASS.

### Task 3: Build Real-Flow Story Harness Support

**Dependencies:** Task 2

**Files:**

- Modify: `client/src/App/store.ts`
- Create: `client/src/game/visuals/GameRulesVisualTdd.shared.tsx` (replace scaffold contents with real-flow harness helpers)
- Modify: `client/src/App/App.tsx` (only if the harness cannot render the existing `App` directly)
- Test: `client/src/game/visuals/PlayRulesVisualTdd.stories.tsx`

- [ ] **Step 1: Write the failing story/test**

Update one representative story to render the real app surface through a deterministic harness and assert on visible game UI that cannot pass with the current scaffold.

- [ ] **Step 2: Run story test to verify it fails**

Run: `cd client && npx vitest run src/game/visuals/PlayRulesVisualTdd.stories.tsx`
Expected: FAIL because stories still render static scaffolds.

- [ ] **Step 3: Write minimal implementation**

Add story support helpers that reset store state, start the app with a provided connection instance, auto-trigger lobby start when required, and expose scenario-specific render helpers without adding Storybook branches to production UI components.

The intended boot path is: a story harness renders the real `App`, calls a new explicit `LobbyFlow` start method with an injected connection instance from a React effect, resets room/session state before mount, and uses existing store signals (`triggerLobbyStart`, `triggerLobbyLeave`) instead of adding Storybook-only branches to production UI.

- [ ] **Step 4: Run story test to verify it passes**

Run: `cd client && npx vitest run src/game/visuals/PlayRulesVisualTdd.stories.tsx`
Expected: PASS for the converted story.

### Task 4: Replace Setup And Play Rule Stories With Real Flow

**Dependencies:** Task 3

**Files:**

- Modify: `client/src/game/visuals/SetupRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/PlayRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/GameRulesVisualTdd.shared.tsx`

**Stories:**

- `SetupByPlayerCount`
- `MightyDuelUsesSevenBySevenGrid`
- `TurnOrderFromDominoSelection`
- `PlacementMustConnectLegally`
- `DiscardWhenUnplaceable`
- `GridBoundaryEnforced`
- `FinalTurnNoReselection`

- [ ] **Step 1: Write failing assertions story-by-story**

For each targeted setup/play story, replace scaffold assertions with DOM assertions against the real app/game UI, starting with the simplest scenarios and keeping any intentionally browser-driven story interaction in `play` functions.

- [ ] **Step 2: Run focused story tests to verify failures**

Run: `cd client && npx vitest run src/game/visuals/SetupRulesVisualTdd.stories.tsx src/game/visuals/PlayRulesVisualTdd.stories.tsx`
Expected: FAIL on the newly converted stories until the harness/scenarios match the assertions.

- [ ] **Step 3: Write minimal implementation**

Define deterministic scenarios that drive the real game through setup and play outcomes such as turn order, legal placement gating, discard behavior, boundary enforcement, and final-turn behavior.

- [ ] **Step 4: Run focused story tests to verify they pass**

Run: `cd client && npx vitest run src/game/visuals/SetupRulesVisualTdd.stories.tsx src/game/visuals/PlayRulesVisualTdd.stories.tsx`
Expected: PASS.

### Task 5: Replace Scoring Rule Stories With Real Flow

**Dependencies:** Task 3

**Files:**

- Modify: `client/src/game/visuals/ScoringRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/GameRulesVisualTdd.shared.tsx`
- Modify: `client/src/game/visuals/Game.tsx` or scoring-presenting components only if visible scoring output is currently missing

**Stories:**

- `PrestigeScoringByProperty`
- `TieBreakResolution`
- `VariantBonusesMiddleKingdomAndHarmony`
- `DynastyThreeRoundAggregate`

- [ ] **Step 1: Write the failing assertions**

Convert scoring stories to assert the visible end-of-game results produced by real sessions, including totals and any currently supported ranking/tie handling.

- [ ] **Step 2: Run story tests to verify they fail**

Run: `cd client && npx vitest run src/game/visuals/ScoringRulesVisualTdd.stories.tsx`
Expected: FAIL because scoring stories still use static harnesses.

- [ ] **Step 3: Write minimal implementation**

Add only the scenario/harness and UI surface needed to expose real scoring results from completed sessions; if a spec item is not implemented in production code yet, keep that story pending or explicitly scoped out rather than fabricating behavior.

- [ ] **Step 4: Run story tests to verify they pass**

Run: `cd client && npx vitest run src/game/visuals/ScoringRulesVisualTdd.stories.tsx`
Expected: PASS for all implemented scoring stories.

### Task 6: Full Verification And Storybook Review

**Dependencies:** Tasks 4 and 5

**Files:**

- Modify: `client/src/game/visuals/*.stories.tsx` (only if verification reveals gaps)

- [ ] **Step 1: Run focused storybook preview generation**

Preview the impacted setup, play, and scoring stories for visual inspection.

- [ ] **Step 2: Run impacted story tests**

Run: `cd client && npm test`
Expected: PASS with converted story suites green.

- [ ] **Step 3: Run targeted unit tests**

Run: `cd client && npx vitest run src/game/state/game.flow.test.ts src/game/state/connection.testing.test.ts`
Expected: PASS.

- [ ] **Step 4: Confirm scope against spec**

Verify that the implementation uses the real flow, the new `test` connection path, deterministic scenarios, and no Storybook-only branches in production UI.
