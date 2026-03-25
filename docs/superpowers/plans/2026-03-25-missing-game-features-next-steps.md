# Missing Game Features Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the missing runtime features needed to convert all remaining blocked visual rule stories to real-flow tests.

**Architecture:** Add missing game rules in core session/round/board/scoring logic first, then expose observable state/events in the UI layer, then convert blocked stories to deterministic real-flow scenarios. Keep rules in domain/state modules, and keep Storybook harness as a consumer of real behavior.

**Tech Stack:** TypeScript, Vitest unit tests, Storybook play tests

---

### Task 1: Unplaceable Domino Discard Rule

**Files:**

- Modify: `client/src/game/state/GameSession.ts`
- Modify: `client/src/game/state/Round.ts` (if phase transitions need adjustment)
- Modify: `client/src/game/gamelogic/board.ts`
- Modify: `client/src/game/tests/placement.test.ts`
- Create: `client/src/game/state/discard-rule.test.ts` (or add to existing state test file)
- Modify: `client/src/game/visuals/PlayRulesVisualTdd.stories.tsx`

- [ ] **Step 1: Write failing unit tests**

Cover: no legal placement path transitions to discard, board remains unchanged for discarded domino, and round progression continues correctly.

- [ ] **Step 2: Run focused unit tests to verify red**

Run: `cd client && npx vitest run --project unit src/game/tests/placement.test.ts src/game/state/discard-rule.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal discard behavior**

Add explicit discard path in game flow/session state where legal placement is impossible, with deterministic and observable event/state output.

- [ ] **Step 4: Re-run unit tests to verify green**

Run: `cd client && npx vitest run --project unit src/game/tests/placement.test.ts src/game/state/discard-rule.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert blocked story**

Implement `DiscardWhenUnplaceable` using `RealGameRuleHarness` and assert visible discard outcome.

### Task 2: Mighty Duel 7x7 Variant Setup

**Files:**

- Modify: `client/src/game/state/GameSession.ts`
- Modify: `client/src/game/gamelogic/board.ts`
- Modify: `client/src/game/state/types.ts` (if variant config typing is added)
- Modify: `client/src/game/tests/deck.test.ts`
- Modify: `client/src/game/tests/placement.test.ts`
- Modify: `client/src/game/visuals/SetupRulesVisualTdd.stories.tsx`

- [ ] **Step 1: Write failing unit tests**

Cover: variant-specific kingdom dimensions and domino usage for two-player Mighty Duel mode.

- [ ] **Step 2: Run focused tests to verify red**

Run: `cd client && npx vitest run --project unit src/game/tests/deck.test.ts src/game/tests/placement.test.ts`
Expected: FAIL for new variant assertions.

- [ ] **Step 3: Implement minimal variant support**

Add configurable board bound and setup rules while keeping default mode unchanged.

- [ ] **Step 4: Re-run focused tests to verify green**

Run: `cd client && npx vitest run --project unit src/game/tests/deck.test.ts src/game/tests/placement.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert blocked story**

Implement `MightyDuelUsesSevenBySevenGrid` with deterministic variant scenario and DOM assertions.

### Task 3: Tie-Break Resolution in Endgame Ranking

**Files:**

- Modify: `client/src/game/state/GameSession.ts`
- Modify: `client/src/game/tests/scoring.test.ts`
- Modify: `client/src/game/tests/session.test.ts`
- Modify: `client/src/game/visuals/ScoringRulesVisualTdd.stories.tsx`

- [ ] **Step 1: Write failing unit tests**

Cover tie-break ordering rules: total score tie resolved by largest property, then crowns (or exact final rule contract selected by spec refinement).

- [ ] **Step 2: Run focused tests to verify red**

Run: `cd client && npx vitest run --project unit src/game/tests/scoring.test.ts src/game/tests/session.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal tie-break ranking logic**

Update endgame score sorting in session logic and keep existing behavior for non-ties.

- [ ] **Step 4: Re-run focused tests to verify green**

Run: `cd client && npx vitest run --project unit src/game/tests/scoring.test.ts src/game/tests/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert blocked story**

Implement `TieBreakResolution` with deterministic final-state scenario assertions.

### Task 4: Optional Bonus Rules (Middle Kingdom and Harmony)

**Files:**

- Modify: `client/src/game/state/GameSession.ts`
- Modify: `client/src/game/tests/scoring.test.ts`
- Modify: `client/src/game/visuals/ScoringRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/GameRulesVisualTdd.shared.tsx` (if summary output needs bonus detail rows)

- [ ] **Step 1: Write failing unit tests**

Cover +10 Middle Kingdom and +5 Harmony toggles, plus baseline unchanged when toggles are off.

- [ ] **Step 2: Run focused tests to verify red**

Run: `cd client && npx vitest run --project unit src/game/tests/scoring.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal bonus support**

Add optional bonus configuration and scoring application with explicit output fields for visibility.

- [ ] **Step 4: Re-run focused tests to verify green**

Run: `cd client && npx vitest run --project unit src/game/tests/scoring.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert blocked story**

Implement `VariantBonusesMiddleKingdomAndHarmony` using real-flow deterministic scenario assertions.

### Task 5: Dynasty Three-Round Aggregate Mode

**Files:**

- Modify: `client/src/game/state/game.flow.ts`
- Modify: `client/src/game/state/GameSession.ts` (or add wrapper state if dynasty should compose sessions)
- Modify: `client/src/game/tests/session.test.ts`
- Modify: `client/src/game/visuals/ScoringRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/GameRulesVisualTdd.shared.tsx`

- [ ] **Step 1: Write failing unit tests**

Cover three-round aggregate behavior, per-round score tracking, and final winner by aggregate total.

- [ ] **Step 2: Run focused tests to verify red**

Run: `cd client && npx vitest run --project unit src/game/tests/session.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal dynasty flow support**

Add explicit dynasty mode orchestration that runs three rounds/series and exposes aggregate scoring state.

- [ ] **Step 4: Re-run focused tests to verify green**

Run: `cd client && npx vitest run --project unit src/game/tests/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Convert blocked story**

Implement `DynastyThreeRoundAggregate` using deterministic scenario assertions.

### Task 6: Final Integration Verification

**Files:**

- Modify: `client/src/game/visuals/*.stories.tsx` (only if validation reveals gaps)

- [ ] **Step 1: Run all affected unit tests**

Run: `cd client && npx vitest run --project unit src/game/tests/placement.test.ts src/game/tests/deck.test.ts src/game/tests/scoring.test.ts src/game/tests/session.test.ts`
Expected: PASS.

- [ ] **Step 2: Run Storybook tests for all previously blocked stories**

Run focused `run-story-tests` for:

- `game-rules-visual-tdd-play--discard-when-unplaceable`
- `game-rules-visual-tdd-setup--mighty-duel-uses-seven-by-seven-grid`
- `game-rules-visual-tdd-scoring--tie-break-resolution`
- `game-rules-visual-tdd-scoring--variant-bonuses-middle-kingdom-and-harmony`
- `game-rules-visual-tdd-scoring--dynasty-three-round-aggregate`

Expected: PASS.

- [ ] **Step 3: Run full client verification**

Run: `cd client && npm test`
Expected: PASS.

- [ ] **Step 4: Publish preview URLs for all newly converted stories**

Run `preview-stories` and share links for visual review.
