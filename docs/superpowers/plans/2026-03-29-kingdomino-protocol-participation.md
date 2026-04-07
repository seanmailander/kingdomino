# `kingdomino-protocol` Participation Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `packages/kingdomino-protocol` to match the Participation Protocol shape described in section 9.4 of `docs/architecture-report.md`, adding `PlayerActor`, `RemotePlayerActor`, and `GameDriver`, and marking misfit existing code with TODO comments.

**Architecture:** `PlayerActor` is the per-player move-source interface; `RemotePlayerActor` wraps a `ConnectionManager` to receive moves from a network peer; `GameDriver` owns a `GameSession` + actor map and drives the turn loop by asking actors for moves and feeding them into the engine. `MoveStrategy` / `AIPlayerActor` are **out of scope** for this plan. The existing files `ai.player.ts`, `connection.testing.ts`, and `connection.multiplayer.ts` are annotated with TODO comments explaining why they do not yet fit the new shape.

**Tech Stack:** TypeScript, `vitest`, `kingdomino-engine` (for `GameSession`, `BoardGrid`, `CardId`, `Direction`, `PlayerId`, `GameEventBus`)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/player.actor.ts` | `PlayerActor` interface |
| Create | `src/remote.player.actor.ts` | `RemotePlayerActor` — wraps `ConnectionManager` |
| Create | `src/game.driver.ts` | `GameDriver` — drives turn loop via session events |
| Create | `src/remote.player.actor.test.ts` | Unit tests for `RemotePlayerActor` |
| Create | `src/game.driver.test.ts` | Integration test for `GameDriver` |
| Modify | `src/ai.player.ts` | Add TODO: shadow-session design; superseded by `AIPlayerActor + MoveStrategy` |
| Modify | `src/connection.testing.ts` | Add TODO: should become `TestRosterFactory` producing scripted `PlayerActor`s |
| Modify | `src/connection.multiplayer.ts` | Add TODO: `MultiplayerConnection` is the transport for `RemotePlayerActor` |
| Modify | `src/index.ts` | Export `PlayerActor`, `RemotePlayerActor`, `GameDriver` |

---

## Task 1: `PlayerActor` Interface

**Files:**
- Create: `packages/kingdomino-protocol/src/player.actor.ts`

- [ ] **Step 1: Write the failing test**

`RemotePlayerActor` will verify this interface compiles; there is no standalone test for a plain interface. Skip to Step 3.

- [ ] **Step 2: Create `player.actor.ts`**

```typescript
import type { CardId, Direction, PlayerId } from "kingdomino-engine";
import type { BoardGrid } from "kingdomino-engine";

export type PlacementResult =
  | { x: number; y: number; direction: Direction }
  | { discard: true };

export interface PlayerActor {
  readonly playerId: PlayerId;
  /**
   * Ask the actor to choose a card from the available (unpicked) cards for
   * this round.  The actor may use the board snapshot to inform its choice.
   */
  awaitPick(availableCards: CardId[], boardSnapshot: BoardGrid): Promise<CardId>;
  /**
   * Ask the actor to place (or discard) the card they just picked.
   * Returns coordinates + direction, or { discard: true }.
   */
  awaitPlacement(cardId: CardId, boardSnapshot: BoardGrid): Promise<PlacementResult>;
  /** Release any held resources (e.g. cancel in-flight waits). */
  destroy(): void;
}
```

- [ ] **Step 3: Run type-check**

```bash
cd packages/kingdomino-protocol && npm run tscheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/kingdomino-protocol/src/player.actor.ts
git commit -m "feat(protocol): add PlayerActor interface

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: `RemotePlayerActor` + Tests

**Files:**
- Create: `packages/kingdomino-protocol/src/remote.player.actor.ts`
- Create: `packages/kingdomino-protocol/src/remote.player.actor.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/kingdomino-protocol/src/remote.player.actor.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { MultiplayerConnection } from "./connection.multiplayer";
import { ConnectionManager } from "./ConnectionManager";
import { RemotePlayerActor } from "./remote.player.actor";
import type { BoardGrid } from "kingdomino-engine";

/**
 * Wire two MultiplayerConnections together so that messages sent on one
 * arrive on the other, simulating two peers communicating over the wire.
 */
function makeConnectedPair() {
  const a = new MultiplayerConnection({ me: "local", them: "remote" });
  const b = new MultiplayerConnection({ me: "remote", them: "local" });
  a.setTransport({ send: (msg) => b.receive(msg) });
  b.setTransport({ send: (msg) => a.receive(msg) });
  return { local: a, remote: b };
}

// A minimal BoardGrid stand-in; the actor ignores it for remote moves.
const stubBoard = {} as BoardGrid;

describe("RemotePlayerActor", () => {
  it("awaitPick() resolves with the card ID from the peer's PICK message", async () => {
    const { local, remote } = makeConnectedPair();
    const manager = new ConnectionManager(local.send, local.waitFor);
    const actor = new RemotePlayerActor("remote", manager);

    // Peer sends a pick message
    remote.send({ type: "pick:made", playerId: "remote", cardId: 42 });

    const cardId = await actor.awaitPick([4, 22, 42], stubBoard);
    expect(cardId).toBe(42);
  });

  it("awaitPlacement() resolves with x/y/direction from a PLACE message", async () => {
    const { local, remote } = makeConnectedPair();
    const manager = new ConnectionManager(local.send, local.waitFor);
    const actor = new RemotePlayerActor("remote", manager);

    remote.send({ type: "place:made", playerId: "remote", x: 7, y: 6, direction: "right" });

    const result = await actor.awaitPlacement(42, stubBoard);
    expect(result).toEqual({ x: 7, y: 6, direction: "right" });
  });

  it("awaitPlacement() resolves with { discard: true } from a DISCARD message", async () => {
    const { local, remote } = makeConnectedPair();
    const manager = new ConnectionManager(local.send, local.waitFor);
    const actor = new RemotePlayerActor("remote", manager);

    remote.send({ type: "discard:made", playerId: "remote" });

    const result = await actor.awaitPlacement(42, stubBoard);
    expect(result).toEqual({ discard: true });
  });

  it("destroy() does not throw", () => {
    const { local } = makeConnectedPair();
    const manager = new ConnectionManager(local.send, local.waitFor);
    const actor = new RemotePlayerActor("remote", manager);
    expect(() => actor.destroy()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/kingdomino-protocol && npm test -- --reporter=verbose remote.player.actor
```

Expected: FAIL — `RemotePlayerActor` not found.

- [ ] **Step 3: Implement `RemotePlayerActor`**

`packages/kingdomino-protocol/src/remote.player.actor.ts`:

```typescript
import type { CardId, PlayerId } from "kingdomino-engine";
import type { BoardGrid } from "kingdomino-engine";
import { PLACE, DISCARD } from "./game.messages";
import type { PlayerActor, PlacementResult } from "./player.actor";
import type { ConnectionManager } from "./ConnectionManager";

export class RemotePlayerActor implements PlayerActor {
  constructor(
    readonly playerId: PlayerId,
    private readonly connection: ConnectionManager,
  ) {}

  async awaitPick(_availableCards: CardId[], _boardSnapshot: BoardGrid): Promise<CardId> {
    const msg = await this.connection.waitForPick();
    return msg.cardId;
  }

  async awaitPlacement(_cardId: CardId, _boardSnapshot: BoardGrid): Promise<PlacementResult> {
    // Pre-register both rejection handlers before any await to prevent unhandled rejections.
    // NOTE: The losing resolver (whichever of place/discard does not arrive) stays registered
    // in ConnectionManager's queue. This matches the existing pattern in
    // ConnectionManager.waitForPickAndPlacement(). If this becomes a problem in multi-round
    // play (stale waiter consuming a future message), ConnectionManager needs a
    // waitForPlaceOrDiscard() that handles cancellation internally.
    const placeOrNull = this.connection.waitForPlace().catch((): null => null);
    const discardOrNull = this.connection.waitForDiscard().catch((): null => null);

    const msg = await Promise.race([placeOrNull, discardOrNull]);
    if (!msg) throw new Error("RemotePlayerActor: connection closed while waiting for placement");

    if (msg.type === PLACE) {
      return { x: msg.x, y: msg.y, direction: msg.direction };
    }
    return { discard: true };
  }

  /** The connection lifecycle is owned externally; nothing to release here. */
  destroy(): void {}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/kingdomino-protocol && npm test -- --reporter=verbose remote.player.actor
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run type-check**

```bash
cd packages/kingdomino-protocol && npm run tscheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/kingdomino-protocol/src/remote.player.actor.ts \
        packages/kingdomino-protocol/src/remote.player.actor.test.ts
git commit -m "feat(protocol): add RemotePlayerActor

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: `GameDriver` + Tests

**Files:**
- Create: `packages/kingdomino-protocol/src/game.driver.ts`
- Create: `packages/kingdomino-protocol/src/game.driver.test.ts`

### Background

`GameDriver` owns a `GameSession` and a `Map<PlayerId, PlayerActor>`. Its `run()` method returns a `Promise<void>` that resolves when `game:ended` fires (the game finished cleanly) and rejects when any actor's `awaitPick()` or `awaitPlacement()` throws (fatal error — the driver surfaces it without retrying).

The driver hooks into the session's event bus to know when a round starts, then drives picks and placements for that round by:
1. Polling `round.currentActor` (set and advanced by the session after each `handlePick()`) to find whose pick is next.
2. Calling `actors.get(playerId)!.awaitPick(availableCards, boardSnapshot)` and feeding the result to `session.handlePick()`.
3. After the picking phase transitions, the session stores which card each player picked. The driver re-reads `round.currentActor` for the placing phase and calls `actor.awaitPlacement(pickedCardId, boardSnapshot)`.
4. The driver reads the card each actor is placing from `round.deal.snapshot()` (the slot where `pickedBy.id === playerId`).

The session's internal `_runGameLoop()` is started by `startGame()` and drives the seed → deck → round lifecycle automatically. The driver layer only handles move production (pick + placement), not round creation. This is a **design tension** noted below.

- [ ] **Step 1: Write the failing integration test**

`packages/kingdomino-protocol/src/game.driver.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GameSession, Player, findPlacementWithin5x5 } from "kingdomino-engine";
import type { CardId, BoardGrid } from "kingdomino-engine";
import type { PlayerActor, PlacementResult } from "./player.actor";
import { GameDriver } from "./game.driver";

/**
 * A scripted PlayerActor that always picks the first available card and finds
 * the first valid in-bounds placement using the engine's own helper.
 * Falls back to { discard: true } only when no valid placement exists.
 * This is safe to use across multiple rounds on the same board.
 */
function makeScriptedActor(playerId: string): PlayerActor {
  return {
    playerId,
    awaitPick: async (available: CardId[], _board: BoardGrid) => available[0],
    awaitPlacement: async (cardId: CardId, board: BoardGrid): Promise<PlacementResult> => {
      const placement = findPlacementWithin5x5(board, cardId);
      return placement ?? { discard: true };
    },
    destroy: () => {},
  };
}

describe("GameDriver", () => {
  it("runs a complete 2-player game and resolves when game:ended fires", async () => {
    const session = new GameSession({ variant: "standard" });
    const alice = new Player("alice");
    const bob = new Player("bob");
    session.addPlayer(alice);
    session.addPlayer(bob);

    const actors = new Map([
      ["alice", makeScriptedActor("alice")],
      ["bob",   makeScriptedActor("bob")],
    ]);

    const driver = new GameDriver(session, actors);
    session.startGame();

    await expect(driver.run()).resolves.toBeUndefined();
  });

  it("rejects when an actor throws during awaitPick", async () => {
    const session = new GameSession({ variant: "standard" });
    const alice = new Player("alice");
    const bob = new Player("bob");
    session.addPlayer(alice);
    session.addPlayer(bob);

    const brokenActor: PlayerActor = {
      playerId: "alice",
      awaitPick: async () => { throw new Error("actor failed"); },
      awaitPlacement: async () => ({ discard: true }),
      destroy: () => {},
    };

    const actors = new Map([
      ["alice", brokenActor],
      ["bob",   makeScriptedActor("bob", 22)],
    ]);

    const driver = new GameDriver(session, actors);
    session.startGame();

    await expect(driver.run()).rejects.toThrow("actor failed");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/kingdomino-protocol && npm test -- --reporter=verbose game.driver
```

Expected: FAIL — `GameDriver` not found.

- [ ] **Step 3: Implement `GameDriver`**

`packages/kingdomino-protocol/src/game.driver.ts`:

```typescript
import type { GameSession, Round } from "kingdomino-engine";
import type { PlayerId, CardId } from "kingdomino-engine";
import type { PlayerActor } from "./player.actor";

// TODO: GameDriver currently hooks into the session's internal event loop via
// session.events subscriptions and drives moves reactively. A cleaner future
// shape (per architecture-report §8.3) would have GameDriver own the turn
// sequence entirely — calling beginRound() and managing the seed provider
// directly — rather than riding the session's own _runGameLoop(). That
// refactor requires changes to GameSession's public API (exposing per-round
// seed consumption as an external-drive point) and is deferred.

export class GameDriver {
  constructor(
    private readonly session: GameSession,
    private readonly actors: Map<PlayerId, PlayerActor>,
  ) {}

  /**
   * Drive the game to completion.
   * Resolves when `game:ended` fires (all rounds played cleanly).
   * Rejects if any actor's `awaitPick()` or `awaitPlacement()` throws.
   */
  run(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const offGameEnded = this.session.events.on("game:ended", () => {
        offGameEnded();
        offRoundStarted();
        resolve();
      });

      const offRoundStarted = this.session.events.on("round:started", (event) => {
        void this.driveRound(event.round).catch((err) => {
          offGameEnded();
          offRoundStarted();
          reject(err);
        });
      });
    });
  }

  private async driveRound(round: Round): Promise<void> {
    const pickedCards = new Map<PlayerId, CardId>();

    // Single loop over the pick→place→pick→place→…→complete phase machine.
    // RoundPhase alternates: picking → placing (per player) until complete.
    while (round.phase !== "complete") {
      const player = round.currentActor;
      if (!player) break;

      const actor = this.actors.get(player.id);
      if (!actor) throw new Error(`GameDriver: no actor registered for player "${player.id}"`);

      if (round.phase === "picking") {
        const availableCards = round.deal
          .snapshot()
          .filter((slot) => slot.pickedBy === null)
          .map((slot) => slot.cardId);

        const boardSnapshot = this.session.boardFor(player.id);
        const cardId = await actor.awaitPick(availableCards, boardSnapshot);

        pickedCards.set(player.id, cardId);
        this.session.handlePick(player.id, cardId);
      } else {
        // placing phase
        const pickedSlot = round.deal
          .snapshot()
          .find((slot) => slot.pickedBy?.id === player.id);
        const cardId = pickedSlot?.cardId ?? pickedCards.get(player.id);
        if (cardId === undefined) {
          throw new Error(`GameDriver: cannot determine picked card for player "${player.id}"`);
        }

        const boardSnapshot = this.session.boardFor(player.id);
        const result = await actor.awaitPlacement(cardId, boardSnapshot);

        if ("discard" in result) {
          this.session.handleDiscard(player.id);
        } else {
          this.session.handlePlacement(player.id, result.x, result.y, result.direction);
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/kingdomino-protocol && npm test -- --reporter=verbose game.driver
```

Expected: both tests PASS.

- [ ] **Step 5: Run the full protocol test suite**

```bash
cd packages/kingdomino-protocol && npm test
```

Expected: all tests pass (no regressions).

- [ ] **Step 6: Run type-check**

```bash
cd packages/kingdomino-protocol && npm run tscheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/kingdomino-protocol/src/game.driver.ts \
        packages/kingdomino-protocol/src/game.driver.test.ts
git commit -m "feat(protocol): add GameDriver

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Annotate Legacy Files with TODO Comments

**Files to modify:**
- `packages/kingdomino-protocol/src/ai.player.ts`
- `packages/kingdomino-protocol/src/connection.testing.ts`
- `packages/kingdomino-protocol/src/connection.multiplayer.ts`

- [ ] **Step 1: Add TODO to `ai.player.ts`**

Add this block at the top of the file, before the imports:

```typescript
// TODO: RandomAIPlayer uses a shadow GameSession to track game state and
// generate moves. This is the legacy design (per architecture-report §9.3).
// Under the proposed actor model (§9.4), this should be replaced with:
//   - MoveStrategy interface: pure function (availableCards, boardSnapshot) → move
//   - RandomMoveStrategy: stateless implementation of MoveStrategy
//   - AIPlayerActor: implements PlayerActor, delegates move computation to a MoveStrategy
// The shadow session approach is tightly coupled to the 1:1 IGameConnection
// shape and cannot compose cleanly in N-player or mixed-mode games.
```

- [ ] **Step 2: Add TODO to `connection.testing.ts`**

Add this block at the top of the file, before the imports:

```typescript
// TODO: TestConnection is a scripted IGameConnection-shaped test double.
// Under the actor model (architecture-report §9.4), the correct shape is a
// TestRosterFactory that produces scripted PlayerActor instances — one per
// player slot — rather than a single connection object that pretends to be
// a remote peer. The handshake-interleaved move emission here is a consequence
// of the IGameConnection coupling and would be unnecessary with per-actor scripting.
```

- [ ] **Step 3: Add TODO to `connection.multiplayer.ts`**

Add this block at the top of the file, before the imports:

```typescript
// TODO: MultiplayerConnection serves as the transport layer for
// RemotePlayerActor (architecture-report §9.4). It owns the raw send/receive
// primitives and the per-message-type queuing. A future rename/restructure may
// move this to a transport-focused module (e.g. peer.transport.ts) to clarify
// that MultiplayerConnection is not itself a PlayerActor — it is a building
// block that RemotePlayerActor wraps.
```

- [ ] **Step 4: Run all tests to verify nothing broke**

```bash
cd packages/kingdomino-protocol && npm test
```

Expected: all tests still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/kingdomino-protocol/src/ai.player.ts \
        packages/kingdomino-protocol/src/connection.testing.ts \
        packages/kingdomino-protocol/src/connection.multiplayer.ts
git commit -m "chore(protocol): annotate legacy files with architecture TODO comments

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: Update `index.ts` Exports

**Files:**
- Modify: `packages/kingdomino-protocol/src/index.ts`

- [ ] **Step 1: Update exports**

Replace the current content of `index.ts` with:

```typescript
// kingdomino-protocol public API

// Wire message vocabulary
export * from "./game.messages";

// Protocol adapter
export { ConnectionManager } from "./ConnectionManager";

// Transport layer (used by RemotePlayerActor)
export { MultiplayerConnection } from "./connection.multiplayer";
export type { MultiplayerTransport, MultiplayerConnectionOptions } from "./connection.multiplayer";

// Actor model
export type { PlayerActor, PlacementResult } from "./player.actor";
export { RemotePlayerActor } from "./remote.player.actor";

// Turn loop driver
export { GameDriver } from "./game.driver";

// Legacy: RandomAIPlayer (shadow-session design; see TODO in ai.player.ts)
export { RandomAIPlayer } from "./ai.player";

// Test utilities (see TODO in connection.testing.ts)
export { TestConnection } from "./connection.testing";
export type {
  TestConnectionOptions,
  TestConnectionScenario,
  TestConnectionControl,
} from "./connection.testing";
```

- [ ] **Step 2: Run all tests**

```bash
cd packages/kingdomino-protocol && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run type-check**

```bash
cd packages/kingdomino-protocol && npm run tscheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/kingdomino-protocol/src/index.ts
git commit -m "feat(protocol): export PlayerActor, RemotePlayerActor, GameDriver from index

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Final Verification

- [ ] Run the full client test suite to confirm no regressions:

```bash
cd client && npm test
```

Expected: all tests pass.
