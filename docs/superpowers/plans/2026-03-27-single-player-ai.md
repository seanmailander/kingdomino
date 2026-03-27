# Single-Player AI Opponent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `SoloConnection.emitOpponentMove()` stub with a `RandomAIPlayer` that owns a mirrored `GameSession` and picks/places randomly but always legally.

**Architecture:** `RandomAIPlayer` owns a second `GameSession` (AI perspective: `them` is local/AI, `me` is remote/human) and tracks both players' moves. `SoloConnection` gains a `RandomAIPlayer` constructor parameter and delegates `emitOpponentMove()` to it. `LobbyFlow.ReadySolo()` creates the `RandomAIPlayer` and wires it in; `playRound()` calls `aiPlayer.beginRound()` alongside `session.beginRound()`.

**Tech Stack:** TypeScript, alien-signals (no direct usage), Vitest 4, Storybook 10 + `@storybook/addon-vitest`, PeerJS-free (solo flow), `getEligiblePositions` / `findPlacementWithin5x5` / `findPlacementWithin7x7` from `client/src/game/gamelogic/board.ts`.

**Spec:** `docs/superpowers/specs/2026-03-26-single-player-ai-design.md`

---

## File Map

| File | Change |
|------|--------|
| `client/src/game/state/ai.player.ts` | **CREATE** — `RandomAIPlayer` class |
| `client/src/game/state/ai.player.test.ts` | **CREATE** — unit tests |
| `client/src/game/state/connection.solo.ts` | **MODIFY** — accept `RandomAIPlayer` param; delegate moves |
| `client/src/game/state/connection.solo.test.ts` | **MODIFY** — pass `RandomAIPlayer` to constructor |
| `client/src/game/state/game.flow.ts` | **MODIFY** — create `RandomAIPlayer` in `ReadySolo`; sync rounds |
| `client/src/game/visuals/SoloGameVisualTdd.stories.tsx` | **CREATE** — Storybook story for full solo game |

---

## Task 1 — Unit tests for `RandomAIPlayer` (RED)

**Files:**
- Create: `client/src/game/state/ai.player.test.ts`

- [ ] **Step 1.1 — Write the test file**

```typescript
// client/src/game/state/ai.player.test.ts
import { describe, expect, it } from "vitest";
import { RandomAIPlayer } from "./ai.player";

describe("RandomAIPlayer — generateMove", () => {
  it("returns a card from the active deal at a valid non-zero position when AI picks first", () => {
    const ai = new RandomAIPlayer("them", "me");
    ai.startGame(["them", "me"]); // AI picks first
    ai.beginRound([4, 22, 28, 46]);

    const move = ai.generateMove();

    expect(move.playerId).toBe("them");
    expect([4, 22, 28, 46]).toContain(move.card);
    expect(move.x).toBeTypeOf("number");
    expect(move.y).toBeTypeOf("number");
    expect(["up", "down", "left", "right"]).toContain(move.direction);
    // Any card should be placeable next to the castle — not the hardcoded sentinel (0,0,up)
    expect(move.x !== 0 || move.y !== 0).toBe(true);
  });

  it("returns a card from the active deal at a valid position when AI picks second", () => {
    const ai = new RandomAIPlayer("them", "me");
    ai.startGame(["me", "them"]); // Human picks first
    ai.beginRound([4, 22, 28, 46]);

    // Simulate human picking card 4 and placing it at (7,6,right) next to the castle
    ai.receiveHumanMove(4, 7, 6, "right");

    const move = ai.generateMove();

    expect(move.playerId).toBe("them");
    expect([22, 28, 46]).toContain(move.card); // card 4 is taken
    expect(move.x).toBeTypeOf("number");
    expect(move.y).toBeTypeOf("number");
    expect(["up", "down", "left", "right"]).toContain(move.direction);
  });
});

describe("RandomAIPlayer — receiveHumanMove", () => {
  it("prevents AI from picking the same card the human already picked", () => {
    const ai = new RandomAIPlayer("them", "me");
    ai.startGame(["me", "them"]); // Human picks first
    ai.beginRound([4, 22, 28, 46]);

    ai.receiveHumanMove(4, 7, 6, "right"); // Human claims card 4
    const move = ai.generateMove();

    expect(move.card).not.toBe(4);
    expect([22, 28, 46]).toContain(move.card);
  });

  it("tracks the human placement so the AI does not overlap the same board position", () => {
    const ai = new RandomAIPlayer("them", "me");
    ai.startGame(["me", "them"]);
    ai.beginRound([4, 22, 28, 46]);

    // Human places at (7,6) right — takes positions (7,6) and (8,6) on human's board
    // AI board is separate — this test verifies receiveHumanMove doesn't throw
    expect(() => ai.receiveHumanMove(4, 7, 6, "right")).not.toThrow();
  });
});
```

- [ ] **Step 1.2 — Run tests to confirm RED**

```bash
cd client && npx vitest run src/game/state/ai.player.test.ts
```

Expected: **FAIL** with `Cannot find module './ai.player'`

- [ ] **Step 1.3 — Commit test file**

```bash
cd client && git add src/game/state/ai.player.test.ts
git commit -m "test(ai): red — unit tests for RandomAIPlayer

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2 — Implement `RandomAIPlayer` (GREEN)

**Files:**
- Create: `client/src/game/state/ai.player.ts`

- [ ] **Step 2.1 — Write the implementation**

```typescript
// client/src/game/state/ai.player.ts
import { GameSession, Player } from "./GameSession";
import { findPlacementWithin5x5, findPlacementWithin7x7 } from "../gamelogic/board";
import type { CardId, Direction } from "./types";
import type { PlayerMoveMessage } from "./game.messages";
import type { GameVariant } from "../gamelogic/cards";

export class RandomAIPlayer {
  private readonly aiSession: GameSession;
  private readonly aiPlayerId: string;
  private readonly humanPlayerId: string;

  constructor(aiPlayerId: string, humanPlayerId: string, variant: GameVariant = "standard") {
    this.aiPlayerId = aiPlayerId;
    this.humanPlayerId = humanPlayerId;
    this.aiSession = new GameSession({ variant });
    this.aiSession.addPlayer(new Player(aiPlayerId, true));     // AI is "local" in its own session
    this.aiSession.addPlayer(new Player(humanPlayerId, false)); // Human is "remote" in AI session
  }

  /** Called once after the trusted seed exchange establishes pick order. */
  startGame(orderedPlayerIds: string[]): void {
    const pickOrder = orderedPlayerIds.map((id) => this.aiSession.playerById(id)!);
    this.aiSession.startGame(pickOrder);
  }

  /** Called at the start of each round with the same 4 cards as the human session. */
  beginRound(cardIds: [CardId, CardId, CardId, CardId]): void {
    this.aiSession.beginRound(cardIds);
  }

  /**
   * Records the human player's completed pick+placement into the AI session.
   * Must be called before generateMove() when the human acts before the AI.
   */
  receiveHumanMove(card: CardId, x: number, y: number, dir: Direction): void {
    this.aiSession.handlePick(this.humanPlayerId, card);
    this.aiSession.handlePlacement(this.humanPlayerId, x, y, dir);
  }

  /**
   * Picks a random available card and finds a valid in-bounds placement.
   * Falls back to a sentinel move (0, 0, "up") if no valid placement exists —
   * identical to the pre-existing hardcoded stub. See spec for deferred handling.
   */
  generateMove(): PlayerMoveMessage {
    const round = this.aiSession.currentRound!;
    const boardSnapshot = this.aiSession.boardFor(this.aiPlayerId);
    const findPlacement =
      this.aiSession.variant === "mighty-duel"
        ? findPlacementWithin7x7
        : findPlacementWithin5x5;

    const availableCardIds = round.deal
      .snapshot()
      .filter((slot) => slot.pickedBy === null)
      .map((slot) => slot.cardId)
      .sort(() => Math.random() - 0.5); // shuffle for randomness

    for (const cardId of availableCardIds) {
      const placement = findPlacement(boardSnapshot, cardId);
      if (placement !== null) {
        this.aiSession.handleLocalPick(cardId);
        this.aiSession.handleLocalPlacement(placement.x, placement.y, placement.direction);
        return {
          playerId: this.aiPlayerId,
          card: cardId,
          x: placement.x,
          y: placement.y,
          direction: placement.direction,
        };
      }
    }

    // Degenerate fallback: no valid in-bounds placement found for any card
    const firstCard = availableCardIds[0];
    console.warn(
      `RandomAIPlayer(${this.aiPlayerId}): no valid placement found for any available card — returning sentinel (0, 0, up)`,
    );
    this.aiSession.handleLocalPick(firstCard);
    return {
      playerId: this.aiPlayerId,
      card: firstCard,
      x: 0,
      y: 0,
      direction: "up" as Direction,
    };
  }

  /** Clean up. No active external subscriptions in this implementation. */
  destroy(): void {
    // No-op: aiSession holds no external resources
  }
}
```

- [ ] **Step 2.2 — Run tests to confirm GREEN**

```bash
cd client && npx vitest run src/game/state/ai.player.test.ts
```

Expected: **PASS** — all 4 tests green.

- [ ] **Step 2.3 — Run full test suite to check for regressions**

```bash
cd client && npm test
```

Expected: all previously passing tests still pass.

- [ ] **Step 2.4 — Commit implementation**

```bash
cd client && git add src/game/state/ai.player.ts
git commit -m "feat(ai): implement RandomAIPlayer with random valid placement

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3 — Update `SoloConnection` tests (RED)

The `SoloConnection` constructor will gain a required `aiPlayer` parameter. The existing control-message tests need updating before modifying the implementation.

**Files:**
- Modify: `client/src/game/state/connection.solo.test.ts`

- [ ] **Step 3.1 — Update existing control tests and add a move test**

Replace the contents of `client/src/game/state/connection.solo.test.ts`:

```typescript
// client/src/game/state/connection.solo.test.ts
import { describe, expect, it } from "vitest";
import { SoloConnection } from "./connection.solo";
import { RandomAIPlayer } from "./ai.player";
import { MOVE, PAUSE_ACK, RESUME_ACK, revealMessage } from "./game.messages";
import { pauseRequestMessage, resumeRequestMessage } from "./game.messages";

const makeAiPlayer = () => {
  const ai = new RandomAIPlayer("them", "me");
  // Start game so generateMove() is callable (them picks first by convention)
  ai.startGame(["them", "me"]);
  return ai;
};

describe("SoloConnection control messages", () => {
  it("responds to PAUSE_REQUEST with PAUSE_ACK", async () => {
    const conn = new SoloConnection(makeAiPlayer());
    const ack = conn.waitFor(PAUSE_ACK);
    conn.send(pauseRequestMessage());
    await expect(ack).resolves.toBeUndefined();
  });

  it("responds to RESUME_REQUEST with RESUME_ACK", async () => {
    const conn = new SoloConnection(makeAiPlayer());
    const ack = conn.waitFor(RESUME_ACK);
    conn.send(resumeRequestMessage());
    await expect(ack).resolves.toBeUndefined();
  });
});

describe("SoloConnection — emitOpponentMove delegates to RandomAIPlayer", () => {
  it("emits a MOVE message with a valid card from the deal after REVEAL", async () => {
    const ai = new RandomAIPlayer("them", "me");
    ai.startGame(["them", "me"]); // AI picks first
    ai.beginRound([4, 22, 28, 46]);

    const conn = new SoloConnection(ai);
    const move = conn.waitFor(MOVE);

    // Trigger the REVEAL → emitOpponentMove chain
    conn.send(revealMessage("test-secret"));

    const payload = await move;
    expect([4, 22, 28, 46]).toContain(payload.move.card);
    expect(payload.move.playerId).toBe("them");
    expect(payload.move.x !== 0 || payload.move.y !== 0).toBe(true);
  });
});
```

- [ ] **Step 3.2 — Run updated tests to confirm RED on the new test**

```bash
cd client && npx vitest run src/game/state/connection.solo.test.ts
```

Expected: **FAIL** — `SoloConnection` still takes no constructor params; type error.

---

## Task 4 — Modify `SoloConnection` (GREEN)

**Files:**
- Modify: `client/src/game/state/connection.solo.ts`

- [ ] **Step 4.1 — Add `RandomAIPlayer` import and constructor parameter**

At the top of the file, add the import after the existing imports:

```typescript
import { type RandomAIPlayer } from "./ai.player";
```

- [ ] **Step 4.2 — Add `aiPlayer` field and update constructor**

Replace the class opening through the `peerIdentifiers` declaration:

```typescript
export class SoloConnection {
  readonly peerIdentifiers = {
    me: "me",
    them: "them",
  } as const;

  private readonly aiPlayer: RandomAIPlayer;
  private readonly messageQueues = new Map<GameMessageType, unknown[]>();
  private readonly messageResolvers = new Map<GameMessageType, MessageResolver[]>();

  private isDestroyed = false;

  private readonly commitData = commit();

  constructor(aiPlayer: RandomAIPlayer) {
    this.aiPlayer = aiPlayer;
  }
```

- [ ] **Step 4.3 — Update `destroy` to call `aiPlayer.destroy()`**

Add `this.aiPlayer.destroy();` at the start of the destroy method body, before `this.isDestroyed = true`:

```typescript
  destroy = () => {
    if (this.isDestroyed) {
      return;
    }

    this.aiPlayer.destroy();
    this.isDestroyed = true;
    // ... rest unchanged
```

- [ ] **Step 4.4 — Update `emitOpponentMove` to delegate to `aiPlayer`**

Replace the entire `emitOpponentMove` private method:

```typescript
  private emitOpponentMove() {
    const move = this.aiPlayer.generateMove();
    this.emitIncoming(MOVE, moveMessage(move).content);
  }
```

- [ ] **Step 4.5 — Update `respondToMessage` MOVE case to relay human move**

Replace the `case MOVE:` branch in `respondToMessage`:

```typescript
      case MOVE:
        this.aiPlayer.receiveHumanMove(
          message.content.move.card,
          message.content.move.x,
          message.content.move.y,
          message.content.move.direction,
        );
        this.emitOpponentMove();
        return;
```

Note: TypeScript narrows `message` to `MoveGameMessage` inside `case MOVE:`, so `message.content.move` is type-safe.

- [ ] **Step 4.6 — Run tests to confirm GREEN**

```bash
cd client && npx vitest run src/game/state/connection.solo.test.ts
```

Expected: **PASS** — all 3 tests green.

- [ ] **Step 4.7 — Run full test suite**

```bash
cd client && npm test
```

Expected: all tests pass (the `game.flow.test.ts` `ReadySolo` test will fail if `ReadySolo()` is not yet updated — that's fine at this stage; fix is in Task 5).

- [ ] **Step 4.8 — Commit**

```bash
cd client && git add src/game/state/connection.solo.ts src/game/state/connection.solo.test.ts
git commit -m "feat(ai): wire SoloConnection to RandomAIPlayer

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5 — Update `game.flow.ts` to wire `RandomAIPlayer`

**Files:**
- Modify: `client/src/game/state/game.flow.ts`

No new unit tests are needed here — the existing `game.flow.test.ts` `ReadySolo` test will start passing once `ReadySolo()` is updated.

- [ ] **Step 5.1 — Add import for `RandomAIPlayer`**

Add after the `SoloConnection` import line:

```typescript
import { RandomAIPlayer } from "./ai.player";
```

- [ ] **Step 5.2 — Add `aiPlayer` field to `LobbyFlow`**

Add a new private field after `private remainingDeck`:

```typescript
  private aiPlayer: RandomAIPlayer | null = null;
```

- [ ] **Step 5.3 — Update `ReadySolo()` to create and pass `RandomAIPlayer`**

Replace the existing `ReadySolo()` method:

```typescript
  ReadySolo() {
    this.aiPlayer = new RandomAIPlayer("them", "me", this.variant);
    this.ready(new SoloConnection(this.aiPlayer));
  }
```

- [ ] **Step 5.4 — Call `aiPlayer.startGame()` after `session.startGame()` in `runFlow()`**

In `runFlow()`, find the two lines:
```typescript
      const pickOrder = orderedIds.map((id) => this.session!.playerById(id)!);
      this.session.startGame(pickOrder);
```

Add immediately after `this.session.startGame(pickOrder)`:
```typescript
      this.aiPlayer?.startGame(orderedIds);
```

- [ ] **Step 5.5 — Call `aiPlayer.beginRound()` after `session.beginRound()` in `playRound()`**

In `playRound()`, find the line:
```typescript
    session.beginRound(cardIds as [CardId, CardId, CardId, CardId]);
```

Add immediately after it:
```typescript
    this.aiPlayer?.beginRound(cardIds as [CardId, CardId, CardId, CardId]);
```

- [ ] **Step 5.6 — Null out `aiPlayer` in the `finally` block**

In the `finally` block of `runFlow()`, add `this.aiPlayer = null;` alongside the other cleanup:

```typescript
    } finally {
      connection.destroy();
      this.aiPlayer = null;
      this.session = null;
      this.connectionManager = null;
      this.remainingDeck = [];
      this.isRunning = false;
    }
```

- [ ] **Step 5.7 — Run full test suite**

```bash
cd client && npm test
```

Expected: **ALL PASS** — including `game.flow.test.ts` `ReadySolo` test.

- [ ] **Step 5.8 — Commit**

```bash
cd client && git add src/game/state/game.flow.ts
git commit -m "feat(ai): wire RandomAIPlayer in LobbyFlow.ReadySolo

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6 — Add `SoloGame` Storybook story (visual TDD)

**Files:**
- Create: `client/src/game/visuals/SoloGameVisualTdd.stories.tsx`

This story runs a full solo game end-to-end with a `LocalAutoDriver` component that auto-drives the human player's picks and placements, verifying the AI moves are always legal.

- [ ] **Step 6.1 — Write the story file**

```tsx
// client/src/game/visuals/SoloGameVisualTdd.stories.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import { App } from "../../App/App";
import { resetAppState, triggerLobbyStart, useApp } from "../../App/store";
import { findPlacementWithin5x5 } from "../gamelogic/board";
import { LobbyFlow } from "../state/game.flow";
import type { GameSession } from "../state/GameSession";

/**
 * Auto-drives the local ("me") player when it's their turn.
 * Uses setTimeout(0) to defer placement until LobbyFlow has registered
 * its place:made listener (avoids a race with the async game loop).
 */
function LocalAutoDriver({ session }: { session: GameSession | null }) {
  useEffect(() => {
    if (!session) return;

    const autoPick = () => {
      if (!session.isMyTurn()) return;
      const snap = session.currentRound?.deal.snapshot();
      const first = snap?.find((s) => s.pickedBy === null);
      if (first) session.handleLocalPick(first.cardId);
    };

    const autoPlace = () => {
      if (!session.isMyPlace()) return;
      const cardId = session.localCardToPlace();
      if (cardId == null) return;
      const playerId = session.myPlayer()?.id;
      if (playerId == null) return;
      const board = session.boardFor(playerId);
      const p = findPlacementWithin5x5(board, cardId);
      if (p) session.handleLocalPlacement(p.x, p.y, p.direction);
    };

    const offRound = session.events.on("round:started", autoPick);
    const offPick = session.events.on("pick:made", () => {
      // Defer both to let LobbyFlow's async loop register its next listener first
      setTimeout(autoPlace, 0);
      setTimeout(autoPick, 0);
    });

    return () => {
      offRound();
      offPick();
    };
  }, [session]);

  return null;
}

function SoloGameHarness({ roundLimit }: { roundLimit: number }) {
  const { session } = useApp();
  const [gameEnded, setGameEnded] = useState(false);

  const flow = useMemo(
    () =>
      new LobbyFlow({
        shouldContinuePlaying: (completedRounds) => completedRounds < roundLimit,
      }),
    [roundLimit],
  );

  useEffect(() => {
    resetAppState();
    flow.ReadySolo();
    triggerLobbyStart();
  }, [flow]);

  useEffect(() => {
    if (!session) return;
    return session.events.on("game:ended", () => setGameEnded(true));
  }, [session]);

  return (
    <>
      <App />
      <LocalAutoDriver session={session} />
      {gameEnded && <p data-testid="game-ended-indicator">Solo game complete</p>}
    </>
  );
}

const meta = {
  title: "Game/Solo AI Visual TDD",
  component: SoloGameHarness,
  tags: ["autodocs"],
} satisfies Meta<typeof SoloGameHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SoloGameCompletesOneRound: Story = {
  args: { roundLimit: 1 },
  play: async ({ canvas }) => {
    // Wait for the round to complete — both players (human auto-driver + AI) must move
    await waitFor(
      async () => {
        await expect(canvas.getByTestId("game-ended-indicator")).toBeVisible();
      },
      { timeout: 15000 },
    );
    // Both player boards should be rendered in the game view
    await expect(canvas.getByText(/Kingdomino/i)).toBeVisible();
  },
};

export const SoloGameCompletesTwoRounds: Story = {
  args: { roundLimit: 2 },
  play: async ({ canvas }) => {
    await waitFor(
      async () => {
        await expect(canvas.getByTestId("game-ended-indicator")).toBeVisible();
      },
      { timeout: 30000 },
    );
    await expect(canvas.getByText(/Kingdomino/i)).toBeVisible();
  },
};
```

- [ ] **Step 6.2 — Run the Storybook story tests (RED check)**

In Storybook dev with MCP, or via:

```bash
cd client && npx storybook test --story "SoloGameVisualTdd/SoloGameCompletesOneRound" --no-coverage
```

Expected: story renders and test passes if AI moves correctly. If `getByTestId("game-ended-indicator")` times out, AI is not completing moves — investigate.

- [ ] **Step 6.3 — Run full story test suite to check for regressions**

```bash
cd client && npx storybook test --no-coverage
```

Expected: all stories pass.

- [ ] **Step 6.4 — Commit**

```bash
cd client && git add src/game/visuals/SoloGameVisualTdd.stories.tsx
git commit -m "feat(ai): add SoloGame Storybook story for end-to-end solo play

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7 — Final verification

- [ ] **Step 7.1 — Run complete unit test suite**

```bash
cd client && npm test
```

Expected: all tests pass with no failures or regressions.

- [ ] **Step 7.2 — Run complete Storybook story tests**

```bash
cd client && npx storybook test --no-coverage
```

Expected: all stories pass including the 2 new SoloGame stories.

- [ ] **Step 7.3 — Manual smoke test (optional)**

Start the dev server and play a solo game through the browser to verify the AI opponent places legal dominoes each turn:

```bash
cd client && npm run dev
```

Open `http://localhost:5173`, click into solo mode, start the game, and verify the AI responds after each human move with a valid placement.

---

## Implementation Notes

### Why `setTimeout(0)` in `LocalAutoDriver`

When `pick:made` fires, `LobbyFlow.playRound()` resolves its `pickOrPause` promise. The next line in the flow (`await placeOrPause = ...waitForEvent("place:made")`) registers a listener. However, this runs as a microtask. If `LocalAutoDriver` calls `handleLocalPlacement` synchronously in the `pick:made` handler, `place:made` fires before the flow registers its listener. Using `setTimeout(0)` defers auto-placement to the macrotask queue, after all microtasks (including the flow's listener registration) have run.

### Pick order synchronization

`RandomAIPlayer.startGame(orderedIds)` is called with the same `orderedIds` string array that `LobbyFlow` uses for `session.startGame(pickOrder)`. Both sessions use player IDs `"me"` and `"them"`, so the same `orderedIds` works for both. The AI session mirrors the human session's pick order exactly.

### `SoloConnection` constructor change

`SoloConnection` now requires an `aiPlayer` parameter. The only construction site is `LobbyFlow.ReadySolo()` — no other code constructs `SoloConnection` directly. Unit tests for `SoloConnection` are updated to pass a `RandomAIPlayer` instance.

### Deferred: AI discard (fully trapped board)

If every available card fails `findPlacementWithin5x5`, `generateMove()` returns a sentinel `(0, 0, "up")` — the same as the previous hardcoded stub. `LobbyFlow` will call `handlePlacement` with those coordinates, which will fail validation. This is the pre-existing remote-player discard gap (see spec Out of Scope).
