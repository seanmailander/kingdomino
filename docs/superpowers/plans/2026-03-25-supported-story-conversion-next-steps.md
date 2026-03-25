# Supported Story Conversion Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the remaining stories that are already supported by current gameplay behavior to the real-flow deterministic harness.

**Architecture:** Reuse `RealGameRuleHarness` and deterministic `TestConnection` scripts to drive real app flow, then assert visible behavior through Storybook play tests and summary/event-log DOM. Do not add Storybook-specific branches in production UI; keep scenario mechanics in story support code.

**Tech Stack:** React, TypeScript, Vitest, Storybook test-runner

---

### Task 1: Establish Supported Story Target Set

**Files:**

- Modify: `client/src/game/visuals/PlayRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/SetupRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/ScoringRulesVisualTdd.stories.tsx`

- [ ] **Step 1: Mark in-scope stories for this plan**

Keep these in scope for conversion now:

- `PlacementMustConnectLegally`
- `GridBoundaryEnforced`
- `FinalTurnNoReselection`

Keep these out of scope (blocked by missing runtime features):

- `DiscardWhenUnplaceable`
- `MightyDuelUsesSevenBySevenGrid`
- `TieBreakResolution`
- `VariantBonusesMiddleKingdomAndHarmony`
- `DynastyThreeRoundAggregate`

- [ ] **Step 2: Add TODO comments reflecting scope split**

Update TODO text in blocked stories to explicitly reference the missing-feature plan to avoid accidental partial conversions.

- [ ] **Step 3: Run focused story tests to confirm no regressions**

Run: `cd client && npx vitest run src/game/visuals/PlayRulesVisualTdd.stories.tsx src/game/visuals/SetupRulesVisualTdd.stories.tsx src/game/visuals/ScoringRulesVisualTdd.stories.tsx`
Expected: PASS for currently converted stories; TODO stories remain neutral.

### Task 2: Convert PlacementMustConnectLegally

**Files:**

- Modify: `client/src/game/visuals/PlayRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/GameRulesVisualTdd.shared.tsx`

- [ ] **Step 1: Write failing play assertions**

Add assertions that show legal placements proceed (pick/place events logged) and illegal placement attempts are rejected by absence of progress until valid input is made.

- [ ] **Step 2: Run focused story test to verify red**

Run: `cd client && npx vitest run src/game/visuals/PlayRulesVisualTdd.stories.tsx --testNamePattern="Placement must connect legally"`
Expected: FAIL.

- [ ] **Step 3: Implement minimal scenario/harness support**

Add deterministic scenario script and any minimal summary fields needed to observe legal-vs-illegal placement outcomes through DOM assertions.

- [ ] **Step 4: Re-run focused story test to verify green**

Run: `cd client && npx vitest run src/game/visuals/PlayRulesVisualTdd.stories.tsx --testNamePattern="Placement must connect legally"`
Expected: PASS.

### Task 3: Convert GridBoundaryEnforced

**Files:**

- Modify: `client/src/game/visuals/PlayRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/GameRulesVisualTdd.shared.tsx`

- [ ] **Step 1: Write failing play assertions**

Assert that attempted overflow placements do not produce accepted placement events, and that valid in-bounds moves still proceed.

- [ ] **Step 2: Run focused story test to verify red**

Run: `cd client && npx vitest run src/game/visuals/PlayRulesVisualTdd.stories.tsx --testNamePattern="5x5 kingdom boundary enforced"`
Expected: FAIL.

- [ ] **Step 3: Implement minimal scenario/harness support**

Create a deterministic multi-round setup that reaches boundary pressure and expose enough summary state to assert enforcement clearly.

- [ ] **Step 4: Re-run focused story test to verify green**

Run: `cd client && npx vitest run src/game/visuals/PlayRulesVisualTdd.stories.tsx --testNamePattern="5x5 kingdom boundary enforced"`
Expected: PASS.

### Task 4: Convert FinalTurnNoReselection

**Files:**

- Modify: `client/src/game/visuals/PlayRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/GameRulesVisualTdd.shared.tsx`

- [ ] **Step 1: Write failing play assertions**

Assert that on final turn placement, no additional pick phase appears and game reaches end-state with `game-ended` event.

- [ ] **Step 2: Run focused story test to verify red**

Run: `cd client && npx vitest run src/game/visuals/PlayRulesVisualTdd.stories.tsx --testNamePattern="Final turn places only"`
Expected: FAIL.

- [ ] **Step 3: Implement minimal scenario/harness support**

Add deterministic script reaching the final action while preserving real flow (no mocked session shortcuts).

- [ ] **Step 4: Re-run focused story test to verify green**

Run: `cd client && npx vitest run src/game/visuals/PlayRulesVisualTdd.stories.tsx --testNamePattern="Final turn places only"`
Expected: PASS.

### Task 5: Storybook Validation and Preview Handoff

**Files:**

- Modify: `client/src/game/visuals/PlayRulesVisualTdd.stories.tsx` (only if validation issues appear)

- [ ] **Step 1: Run focused story tests for all converted supported stories**

Run: `cd client && npx vitest run src/game/visuals/PlayRulesVisualTdd.stories.tsx src/game/visuals/SetupRulesVisualTdd.stories.tsx src/game/visuals/ScoringRulesVisualTdd.stories.tsx`
Expected: PASS.

- [ ] **Step 2: Run Storybook MCP tests with a11y enabled**

Run focused `run-story-tests` on converted story IDs.
Expected: PASS, no unresolved a11y violations.

- [ ] **Step 3: Generate preview URLs for all converted stories**

Run `preview-stories` for each converted story ID.
Expected: URLs available and ready for visual review.

- [ ] **Step 4: Run full client verification**

Run: `cd client && npm test`
Expected: PASS.
