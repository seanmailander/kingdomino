# Decouple Game Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove four coupling violations between game logic, state, and UI layers to make each layer independently testable and portable.

**Architecture:** Each fix is a standalone, non-breaking refactor. Fix #5 (move `fetch.ts`) is a dead-code relocation. Fix #3 (scoring) extracts BFS algorithms to pure functions and has the Board delegate to them. Fix #2 (BoardArea) adds session query methods so the component stops calling gamelogic directly. Fix #1 (LobbyFlow) introduces a `FlowAdapter` interface so `game.flow.ts` never imports from `App/`.

**Tech Stack:** TypeScript 5, React 18, Vitest 4, alien-signals. Run tests with `cd client && npm test`.

---

## Pre-flight: Verify baseline

- [ ] Run `cd client && npm test` and note the 2 pre-existing failures:
  - `game.flow.test.ts > LobbyFlow game completion > transitions room to GameEnded` (timeout/flaky)
  - `SetupRulesVisualTdd.stories.tsx > Setup By Player Count` (visual story)
- [ ] Confirm 138 passing, 2 failing before touching any code.

---

## Task 1: Move `fetch.ts` out of `gamelogic/`

`fetch.ts` contains `getData` / `postData` HTTP helpers. They have zero consumers in the codebase — confirmed by search. Moving them to a dedicated `api/` module eliminates the misleading implication that HTTP calls are part of game logic.

**Files:**
- Create: `client/src/api/fetch.ts`
- Delete: `client/src/game/gamelogic/fetch.ts`

- [ ] **Step 1: Create `client/src/api/fetch.ts`** with the same content as the original:

```ts
export async function getData<T = unknown>(
  url: string = "",
  _data: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    mode: "cors",
    cache: "no-cache",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    referrerPolicy: "no-referrer",
  });
  return response.json() as Promise<T>;
}

export async function postData<T = unknown>(
  url: string = "",
  data: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    mode: "cors",
    cache: "no-cache",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    referrerPolicy: "no-referrer",
    body: JSON.stringify(data),
  });
  return response.json() as Promise<T>;
}
```

- [ ] **Step 2: Delete `client/src/game/gamelogic/fetch.ts`**

```bash
rm client/src/game/gamelogic/fetch.ts
```

- [ ] **Step 3: Run tests — confirm same baseline (no new failures)**

```bash
cd client && npm test
```

Expected: same 2 failures, 138 passing.

- [ ] **Step 4: Commit**

```bash
git add client/src/api/fetch.ts client/src/game/gamelogic/fetch.ts
git commit -m "refactor: move fetch.ts from gamelogic/ to api/

HTTP helpers getData/postData have no consumers; relocating them out of
the pure-functions layer clarifies that gamelogic/ contains only game rules.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: Extract scoring algorithms to `gamelogic/board.ts`

`Board.ts` owns four BFS-based scoring algorithms (`score`, `largestPropertySize`, `totalCrowns`, `isCastleCentered`). These are pure computations that belong in the pure-functions layer. After this task, `Board` methods delegate to the pure functions — all existing tests pass unchanged.

**Files:**
- Modify: `client/src/game/gamelogic/board.ts` (add 4 pure functions)
- Modify: `client/src/game/state/Board.ts` (delegate to pure functions)
- Modify: `client/src/game/tests/scoring.test.ts` (add tests for pure functions directly)

Note: `gamelogic/board.ts` already defines `type Board = ReadonlyArray<ReadonlyArray<BoardCell>>` matching `BoardGrid` in `state/Board.ts`. Use that local type.

### Step 2a: Write failing tests for the pure functions

- [ ] **Step 2a-1: Add pure-function tests to `client/src/game/tests/scoring.test.ts`**

Add a new `describe` block at the top of the file (before existing `describe("Tie-break helpers"...)`):

```ts
import {
  scoreBoard,
  largestRegion,
  totalCrowns as totalCrownsGrid,
  isCastleCentered as isCastleCenteredGrid,
} from "../gamelogic/board";
```

And add this describe block:

```ts
describe("Pure scoring functions in gamelogic/board", () => {
  it("scoreBoard returns 0 for an empty board", () => {
    expect(scoreBoard(new Board().snapshot())).toBe(0);
  });

  it("scoreBoard computes region-size × crown-count", () => {
    // card 0: grain/grain at (7,6)right, card 18: grain(1cr)/wood at (9,6)right
    // 3-cell grain region × 1 crown = 3
    const grid = new Board().place(0, 7, 6, right).place(18, 9, 6, right).snapshot();
    expect(scoreBoard(grid)).toBe(3);
  });

  it("largestRegion returns 0 for an empty board", () => {
    expect(largestRegion(new Board().snapshot())).toBe(0);
  });

  it("largestRegion returns the size of the largest contiguous terrain region", () => {
    // card 0: grain/grain → 2-cell region
    const grid = new Board().place(0, 7, 6, right).snapshot();
    expect(largestRegion(grid)).toBe(2);
  });

  it("totalCrownsGrid returns 0 for an empty board", () => {
    expect(totalCrownsGrid(new Board().snapshot())).toBe(0);
  });

  it("totalCrownsGrid sums all crown values", () => {
    // card 18: grain(1cr)/wood(0cr), card 44: mine(2cr)/grain(0cr) → 3 crowns
    const grid = new Board().place(18, 7, 6, right).place(44, 5, 6, left).snapshot();
    expect(totalCrownsGrid(grid)).toBe(3);
  });

  it("isCastleCenteredGrid returns true for an empty board", () => {
    expect(isCastleCenteredGrid(new Board().snapshot())).toBe(true);
  });

  it("isCastleCenteredGrid returns false for asymmetric placement", () => {
    const grid = new Board().place(0, 7, 6, right).snapshot();
    expect(isCastleCenteredGrid(grid)).toBe(false);
  });
});
```

- [ ] **Step 2a-2: Run tests — confirm new tests FAIL** (functions don't exist yet)

```bash
cd client && npm test -- --reporter=verbose 2>&1 | grep -E "scoreBoard|largestRegion|totalCrowns|isCastleCentered|FAIL"
```

Expected: `scoreBoard is not a function` or similar import errors.

### Step 2b: Implement the pure functions

- [ ] **Step 2b-1: Add the four pure functions to `client/src/game/gamelogic/board.ts`**

Append to the end of the file (after `findPlacementWithin7x7`):

```ts
// ── Pure scoring functions ────────────────────────────────────────────────────
// These are pure functions over a board grid snapshot.
// Board.ts methods delegate to these for testability and reuse.

/** BFS flood-fill: score = Σ(regionSize × regionCrowns). Castle and empty cells excluded. */
export const scoreBoard = (grid: Board): number => {
  const size = grid.length;
  const visited = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  let total = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = grid[y][x];
      if (visited[y][x] || !cell?.tile) continue;

      const terrain = cell.tile;
      const queue: [number, number][] = [[x, y]];
      let regionSize = 0;
      let regionCrowns = 0;

      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        if (visited[cy][cx]) continue;
        visited[cy][cx] = true;
        regionSize++;
        regionCrowns += grid[cy][cx]?.value ?? 0;

        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as [number, number][]) {
          if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited[ny][nx] && grid[ny][nx]?.tile === terrain) {
            queue.push([nx, ny]);
          }
        }
      }

      total += regionSize * regionCrowns;
    }
  }
  return total;
};

/** BFS flood-fill: size of the largest single contiguous terrain region (castle excluded). */
export const largestRegion = (grid: Board): number => {
  const size = grid.length;
  const visited = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  let maxSize = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = grid[y][x];
      if (visited[y][x] || !cell?.tile) continue;

      const terrain = cell.tile;
      const queue: [number, number][] = [[x, y]];
      let regionSize = 0;

      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        if (visited[cy][cx]) continue;
        visited[cy][cx] = true;
        regionSize++;

        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as [number, number][]) {
          if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited[ny][nx] && grid[ny][nx]?.tile === terrain) {
            queue.push([nx, ny]);
          }
        }
      }

      if (regionSize > maxSize) maxSize = regionSize;
    }
  }
  return maxSize;
};

/** Sum of all crown values across all terrain tiles (castle excluded). */
export const totalCrowns = (grid: Board): number => {
  let total = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell?.tile) total += cell.value ?? 0;
    }
  }
  return total;
};

/** True if the castle at (6,6) is at the center of the bounding box of all placed tiles. */
export const isCastleCentered = (grid: Board): boolean => {
  const CASTLE = 6;
  let minX = CASTLE, maxX = CASTLE, minY = CASTLE, maxY = CASTLE;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x]?.tile !== undefined) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return minX + maxX === CASTLE * 2 && minY + maxY === CASTLE * 2;
};
```

- [ ] **Step 2b-2: Run tests — confirm new pure-function tests pass**

```bash
cd client && npm test -- --reporter=verbose 2>&1 | grep -E "Pure scoring|scoreBoard|largestRegion|totalCrownsGrid|isCastleCenteredGrid|FAIL"
```

Expected: all 8 new tests pass.

### Step 2c: Delegate from Board class to pure functions

- [ ] **Step 2c-1: Update `client/src/game/state/Board.ts`** to import and delegate

Add import at the top of `Board.ts` (after existing imports):

```ts
import { scoreBoard, largestRegion, totalCrowns, isCastleCentered } from "../gamelogic/board";
```

Replace the four method bodies in the `Board` class:

```ts
score(): number {
  return scoreBoard(this.snapshot());
}

largestPropertySize(): number {
  return largestRegion(this.snapshot());
}

totalCrowns(): number {
  return totalCrowns(this.snapshot());
}

isCastleCentered(): boolean {
  return isCastleCentered(this.snapshot());
}
```

**Important:** The method names on `Board` stay the same (`largestPropertySize`, `totalCrowns`, `isCastleCentered`). The pure functions in `gamelogic/board.ts` use slightly different names (`largestRegion`, `totalCrowns`, `isCastleCentered`) — the `Board` class methods wrap them. This avoids naming conflicts in the import.

- [ ] **Step 2c-2: Run tests — confirm ALL tests pass (same baseline)**

```bash
cd client && npm test
```

Expected: same 2 pre-existing failures, all others passing.

- [ ] **Step 2c-3: Commit**

```bash
git add client/src/game/gamelogic/board.ts client/src/game/state/Board.ts client/src/game/tests/scoring.test.ts
git commit -m "refactor: extract scoring algorithms to pure functions in gamelogic/board

scoreBoard, largestRegion, totalCrowns, isCastleCentered are now exported
pure functions in gamelogic/board.ts. Board.ts methods delegate to them.
Adds 8 new unit tests verifying the pure functions in isolation.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Remove gamelogic imports from `BoardArea.tsx`

`BoardArea.tsx` calls `getEligiblePositions` and `getValidDirections` directly from `gamelogic/board`. These are placement rules that belong in the state layer. This task adds two query methods to `GameSession` and updates the component to use them.

**Files:**
- Modify: `client/src/game/state/GameSession.ts` (add 2 query methods)
- Modify: `client/src/game/visuals/BoardArea.tsx` (remove gamelogic imports, use session methods)
- Modify: `client/src/game/tests/session.test.ts` (add tests for new query methods)

### Step 3a: Write failing tests for the new session query methods

- [ ] **Step 3a-1: Add tests to `client/src/game/tests/session.test.ts`**

Find the describe block `"GameSession — turn flow"` and add two new tests at the end of it:

```ts
it("localEligiblePositions returns empty array when not in placing phase", () => {
  const session = makeSession();
  session.beginRound([0, 1, 2, 3]);
  // Still in picking phase
  expect(session.localEligiblePositions()).toEqual([]);
});

it("localEligiblePositions returns positions after local player picks", () => {
  const session = makeSession();
  session.beginRound([0, 1, 2, 3]);
  session.handleLocalPick(0);
  // Now in placing phase — castle adjacent positions should be eligible
  const positions = session.localEligiblePositions();
  expect(positions.length).toBeGreaterThan(0);
});

it("localValidDirectionsAt returns empty array when not in placing phase", () => {
  const session = makeSession();
  session.beginRound([0, 1, 2, 3]);
  expect(session.localValidDirectionsAt(7, 6)).toEqual([]);
});

it("localValidDirectionsAt returns valid directions after local player picks", () => {
  const session = makeSession();
  session.beginRound([0, 1, 2, 3]);
  session.handleLocalPick(0);
  // Castle-adjacent (7,6) should have valid directions for card 0 (grain/grain)
  const directions = session.localValidDirectionsAt(7, 6);
  expect(directions.length).toBeGreaterThan(0);
});
```

Note: check the top of `session.test.ts` for the `makeSession` helper to understand its shape. If it doesn't exist, create a local helper:

```ts
function makeSession() {
  const session = new GameSession();
  const me = new Player("me", true);
  const them = new Player("them", false);
  session.addPlayer(me);
  session.addPlayer(them);
  session.startGame([me, them]);
  return session;
}
```

- [ ] **Step 3a-2: Run tests — confirm 4 new tests FAIL**

```bash
cd client && npm test -- --reporter=verbose 2>&1 | grep -E "localEligiblePositions|localValidDirectionsAt|FAIL"
```

Expected: `session.localEligiblePositions is not a function`.

### Step 3b: Add query methods to GameSession

- [ ] **Step 3b-1: Add two methods to `GameSession` class in `client/src/game/state/GameSession.ts`**

Add after the `localCardToPlace()` method (around line 336):

```ts
/** Eligible anchor positions for the local player's card-to-place. Returns [] when not in placing phase. */
localEligiblePositions(): Array<{ x: number; y: number }> {
  const me = this.myPlayer();
  if (!me || !this._currentRound || this._currentRound.phase !== "placing") return [];
  if (this._currentRound.currentActor?.id !== me.id) return [];
  const cardId = this._currentRound.deal.pickedCardFor(me);
  if (cardId === null) return [];
  return getEligiblePositions(me.board.snapshot(), cardId);
}

/** Valid placement directions for the local player's card at grid position (x, y). Returns [] when not in placing phase. */
localValidDirectionsAt(x: number, y: number): Direction[] {
  const me = this.myPlayer();
  if (!me || !this._currentRound || this._currentRound.phase !== "placing") return [];
  if (this._currentRound.currentActor?.id !== me.id) return [];
  const cardId = this._currentRound.deal.pickedCardFor(me);
  if (cardId === null) return [];
  return getValidDirections(me.board.snapshot(), cardId, x, y);
}
```

Note: `getEligiblePositions`, `getValidDirections`, and `Direction` are already imported at the top of `GameSession.ts`.

- [ ] **Step 3b-2: Run tests — confirm the 4 new session tests pass**

```bash
cd client && npm test -- --reporter=verbose 2>&1 | grep -E "localEligiblePositions|localValidDirectionsAt|FAIL"
```

Expected: 4 new tests pass.

### Step 3c: Update `BoardArea.tsx` to use session methods

- [ ] **Step 3c-1: Update `client/src/game/visuals/BoardArea.tsx`**

Remove these two import lines:
```ts
import { getEligiblePositions, getValidDirections } from "../gamelogic/board";
import { up, down, left, right } from "../gamelogic/cards";
```

Add back only the direction constants needed for the rotate lookup (they're still needed for `rotateLookup`):
```ts
import { up, down, left, right } from "../gamelogic/cards";
```

Replace the three lines that compute eligible positions and validators inside the component:

**Remove:**
```ts
const eligiblePositions = getEligiblePositions(myBoard, cardId);
const isValidTile = (x: number, y: number) =>
  eligiblePositions.some((pos) => pos.x === x && pos.y === y);

const isValidDirection = (x: number, y: number, nextDirection: Direction) =>
  cardId !== undefined &&
  getValidDirections(myBoard, cardId, x, y).some((d) => d === nextDirection);
```

**Add:**
```ts
const eligiblePositions = session.localEligiblePositions();
const isValidTile = (x: number, y: number) =>
  eligiblePositions.some((pos) => pos.x === x && pos.y === y);

const isValidDirection = (x: number, y: number, nextDirection: Direction) =>
  session.localValidDirectionsAt(x, y).some((d) => d === nextDirection);
```

Remove the line `const myBoard = session.boardFor(playerId);` — it was only used by `getEligiblePositions(myBoard, cardId)` which is gone.

Remove `const cardId = session.localCardToPlace();` — it was only used by `getEligiblePositions(myBoard, cardId)` and `getValidDirections(myBoard, cardId, ...)`, both of which are gone. It is NOT used in `handleClick`.

Final cleaned-up variable block in `BoardArea`:
```ts
const isMyPlace = session.isMyPlace();
const eligiblePositions = session.localEligiblePositions();
```

- [ ] **Step 3c-2: Run tests — confirm all tests still pass**

```bash
cd client && npm test
```

Expected: same 2 pre-existing failures only.

- [ ] **Step 3c-3: Commit**

```bash
git add client/src/game/state/GameSession.ts client/src/game/visuals/BoardArea.tsx client/src/game/tests/session.test.ts
git commit -m "refactor: move placement validation out of BoardArea into GameSession

Adds localEligiblePositions() and localValidDirectionsAt(x, y) to
GameSession so the component no longer calls gamelogic directly.
BoardArea.tsx now only calls session methods — no gamelogic imports remain.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Decouple `LobbyFlow` from `App/store`

`game.flow.ts` currently imports from `App/store` and `App/AppExtras`, creating a reverse dependency where the state layer controls UI state. This task introduces a `FlowAdapter` interface that `LobbyFlow` uses instead. `AppFlowAdapter` (in `App/`) implements it with the App store. The `gameLobby` singleton moves to `App/` where it belongs.

**Files:**
- Modify: `client/src/game/state/game.flow.ts` (add `FlowAdapter` interface, remove App imports, use adapter)
- Create: `client/src/App/AppFlowAdapter.ts` (implements `FlowAdapter` using App store)
- Create: `client/src/App/gameLobby.ts` (singleton wired with `AppFlowAdapter`)
- Modify: `client/src/Splash/Splash.tsx` (import `gameLobby` from new location)
- Modify: `client/src/game/state/game.flow.test.ts` (pass `AppFlowAdapter` explicitly)
- Modify: `client/src/game/visuals/GameRulesVisualTdd.shared.tsx` (update gameLobby import if used)
- Modify: `client/src/game/visuals/SoloGameVisualTdd.stories.tsx` (update gameLobby import if used)

### Step 4a: Define `FlowAdapter` and update `LobbyFlow` to use it

- [ ] **Step 4a-1: Add `FlowAdapter` interface and `FlowPhase` type to `game.flow.ts`**

Add after the existing `LobbyFlowOptions` type (around line 38), and update `LobbyFlowOptions` to require an adapter:

```ts
/** Internal phase names used by LobbyFlow — independent of UI room constants. */
export type FlowPhase = "splash" | "lobby" | "game" | "paused";

/**
 * Adapter interface that decouples LobbyFlow from any specific UI framework or store.
 * The App layer provides AppFlowAdapter; tests can provide a test double.
 */
export interface FlowAdapter {
  setSession(session: GameSession | null): void;
  setPhase(phase: FlowPhase): void;
  getPhase(): FlowPhase;
  oncePhaseIsNot(phase: FlowPhase): Promise<void>;
  awaitStart(): Promise<void>;
  awaitLeave(): Promise<void>;
  awaitPause(): Promise<void>;
  awaitResume(): Promise<void>;
  reset(): void;
}
```

Update `LobbyFlowOptions` to include the adapter:

```ts
type LobbyFlowOptions = {
  adapter: FlowAdapter;   // Required — no default; provided by App layer
  createConnectionManager?: (connection: IGameConnection) => ConnectionManager;
  shouldContinuePlaying?: (completedRounds: number, remainingDeck: readonly number[]) => boolean;
  variant?: GameVariant;
  bonuses?: GameBonuses;
};
```

- [ ] **Step 4a-2: Update the `LobbyFlow` class to store and use the adapter**

Update the constructor to store the adapter, and replace all App store calls:

```ts
export class LobbyFlow {
  private isRunning = false;
  private session: GameSession | null = null;
  private connectionManager: ConnectionManager | null = null;
  private remainingDeck?: number[];
  private aiPlayer: RandomAIPlayer | null = null;
  private soloConnection: SoloConnection | null = null;
  private readonly adapter: FlowAdapter;
  private readonly createConnectionManager: (connection: IGameConnection) => ConnectionManager;
  private readonly shouldContinuePlaying: (
    completedRounds: number,
    remainingDeck: readonly number[],
  ) => boolean;
  private readonly variant: GameVariant;
  private readonly bonuses: GameBonuses;

  constructor(options: LobbyFlowOptions) {
    this.adapter = options.adapter;
    this.createConnectionManager =
      options.createConnectionManager ??
      ((connection) => new ConnectionManager(connection.send, connection.waitFor));
    this.shouldContinuePlaying =
      options.shouldContinuePlaying ?? ((_, remainingDeck) => remainingDeck.length > 0);
    this.variant = options.variant ?? "standard";
    this.bonuses = options.bonuses ?? {};
  }
```

- [ ] **Step 4a-3: Replace all App store calls with adapter calls throughout `LobbyFlow`**

Replace each occurrence:

| Old (App store) | New (adapter) |
|---|---|
| `getRoom() !== Game` | `this.adapter.getPhase() !== "game"` |
| `getRoom() === GamePaused` | `this.adapter.getPhase() === "paused"` |
| `getRoom() === Game` | `this.adapter.getPhase() === "game"` |
| `getRoom() !== GamePaused` | `this.adapter.getPhase() !== "paused"` |
| `setRoom(GamePaused)` | `this.adapter.setPhase("paused")` |
| `setRoom(Game)` | `this.adapter.setPhase("game")` |
| `setRoom(Lobby)` | `this.adapter.setPhase("lobby")` |
| `setRoom(Splash)` / `setRoom("Splash")` | `this.adapter.setPhase("splash")` |
| `setCurrentSession(this.session)` | `this.adapter.setSession(this.session)` |
| `setCurrentSession(null)` | `this.adapter.setSession(null)` |
| `resetAppState()` | `this.adapter.reset()` |
| `awaitLobbyStart()` | `this.adapter.awaitStart()` |
| `awaitLobbyLeave()` | `this.adapter.awaitLeave()` |
| `awaitPauseIntent()` | `this.adapter.awaitPause()` |
| `awaitResumeIntent()` | `this.adapter.awaitResume()` |
| `onceRoomIsNot(Game)` | `this.adapter.oncePhaseIsNot("game")` |
| `onceRoomIsNot(GamePaused)` | `this.adapter.oncePhaseIsNot("paused")` |

Also update `ReadyMultiplayer()`:
```ts
ReadyMultiplayer() {
  this.adapter.setSession(null);
  this.adapter.setPhase("splash");
}
```

- [ ] **Step 4a-4: Remove the App store imports and the `gameLobby` singleton from `game.flow.ts`**

Delete these import lines:
```ts
import {
  setCurrentSession,
  setRoom,
  getRoom,
  onceRoomIsNot,
  awaitLobbyStart,
  awaitLobbyLeave,
  awaitPauseIntent,
  awaitResumeIntent,
  resetAppState,
} from "../../App/store";
import { Lobby, Game, Splash, GamePaused } from "../../App/AppExtras";
```

Delete the bottom of the file:
```ts
export const gameLobby = new LobbyFlow();
```

### Step 4b: Create `AppFlowAdapter` and `gameLobby` singleton in `App/`

- [ ] **Step 4b-1: Create `client/src/App/AppFlowAdapter.ts`**

```ts
import {
  setCurrentSession,
  setRoom,
  getRoom,
  onceRoomIsNot,
  awaitLobbyStart,
  awaitLobbyLeave,
  awaitPauseIntent,
  awaitResumeIntent,
  resetAppState,
} from "./store";
import { Lobby, Game, Splash, GamePaused } from "./AppExtras";
import type { FlowAdapter, FlowPhase } from "../game/state/game.flow";
import type { GameSession } from "../game/state/GameSession";

const phaseToRoom = {
  splash: Splash,
  lobby: Lobby,
  game: Game,
  paused: GamePaused,
} as const;

const roomToPhase = (): FlowPhase => {
  const room = getRoom();
  if (room === GamePaused) return "paused";
  if (room === Game) return "game";
  if (room === Lobby) return "lobby";
  return "splash";
};

export class AppFlowAdapter implements FlowAdapter {
  setSession(session: GameSession | null): void {
    setCurrentSession(session);
  }

  setPhase(phase: FlowPhase): void {
    setRoom(phaseToRoom[phase]);
  }

  getPhase(): FlowPhase {
    return roomToPhase();
  }

  oncePhaseIsNot(phase: FlowPhase): Promise<void> {
    return onceRoomIsNot(phaseToRoom[phase]);
  }

  awaitStart(): Promise<void> {
    return awaitLobbyStart();
  }

  awaitLeave(): Promise<void> {
    return awaitLobbyLeave();
  }

  awaitPause(): Promise<void> {
    return awaitPauseIntent();
  }

  awaitResume(): Promise<void> {
    return awaitResumeIntent();
  }

  reset(): void {
    resetAppState();
  }
}
```

- [ ] **Step 4b-2: Create `client/src/App/gameLobby.ts`**

```ts
import { LobbyFlow } from "../game/state/game.flow";
import { AppFlowAdapter } from "./AppFlowAdapter";

export const gameLobby = new LobbyFlow({ adapter: new AppFlowAdapter() });
```

### Step 4c: Update consumers of `gameLobby`

- [ ] **Step 4c-1: Update `client/src/Splash/Splash.tsx`**

Change the import:
```ts
// Old:
import { gameLobby } from "../game/state/game.flow";
// New:
import { gameLobby } from "../App/gameLobby";
```

- [ ] **Step 4c-2: Update `client/src/game/visuals/SoloGameVisualTdd.stories.tsx`**

Check its imports — if it imports `gameLobby` from `game.flow`, update to `../../App/gameLobby`. If it imports `LobbyFlow` (class) to create its own instance, it now needs to pass an adapter. For stories, use `AppFlowAdapter`:

```ts
import { AppFlowAdapter } from "../../App/AppFlowAdapter";
// When creating a LobbyFlow instance:
new LobbyFlow({ adapter: new AppFlowAdapter(), ... })
```

- [ ] **Step 4c-3: Update `client/src/game/visuals/GameRulesVisualTdd.shared.tsx`**

Same pattern — update any `LobbyFlow` construction to pass `{ adapter: new AppFlowAdapter(), ... }`.

### Step 4d: Update `game.flow.test.ts`

The tests currently pass App store imports directly (`triggerLobbyStart`, `getRoom`, etc.). The tests stay as integration tests — they use the real `AppFlowAdapter` and real App store. Only the `LobbyFlow` construction changes.

- [ ] **Step 4d-1: Update `client/src/game/state/game.flow.test.ts`**

Add import:
```ts
import { AppFlowAdapter } from "../../App/AppFlowAdapter";
```

Update every `new LobbyFlow()` call to `new LobbyFlow({ adapter: new AppFlowAdapter() })`.

Also update any `new LobbyFlow({ shouldContinuePlaying: ... })` calls to include the adapter:
```ts
new LobbyFlow({ adapter: new AppFlowAdapter(), shouldContinuePlaying: (n) => n < 1 })
```

- [ ] **Step 4d-2: Run tests — confirm same baseline**

```bash
cd client && npm test
```

Expected: same 2 pre-existing failures. All others passing.

- [ ] **Step 4d-3: Commit**

```bash
git add client/src/game/state/game.flow.ts \
        client/src/App/AppFlowAdapter.ts \
        client/src/App/gameLobby.ts \
        client/src/Splash/Splash.tsx \
        client/src/game/state/game.flow.test.ts \
        client/src/game/visuals/SoloGameVisualTdd.stories.tsx \
        client/src/game/visuals/GameRulesVisualTdd.shared.tsx
git commit -m "refactor: decouple LobbyFlow from App/store via FlowAdapter

Introduces FlowAdapter interface so game.flow.ts has zero imports from App/.
AppFlowAdapter (in App/) implements it with the real store.
gameLobby singleton moves to App/gameLobby.ts.
LobbyFlow can now run headlessly with any adapter (test doubles, server-side, etc).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Verification

After all four tasks are complete:

- [ ] Run the full test suite:
  ```bash
  cd client && npm test
  ```
  Expected: exactly 2 pre-existing failures, all others green.

- [ ] Confirm `game.flow.ts` has zero imports from `../../App/`:
  ```bash
  grep "from.*App/" client/src/game/state/game.flow.ts
  ```
  Expected: no output.

- [ ] Confirm `BoardArea.tsx` has zero gamelogic imports for validation functions:
  ```bash
  grep "getEligiblePositions\|getValidDirections" client/src/game/visuals/BoardArea.tsx
  ```
  Expected: no output.

- [ ] Confirm `gamelogic/board.ts` exports the four scoring functions:
  ```bash
  grep "^export const scoreBoard\|^export const largestRegion\|^export const totalCrowns\|^export const isCastleCentered" client/src/game/gamelogic/board.ts
  ```
  Expected: 4 matches.

- [ ] Confirm `fetch.ts` is gone from `gamelogic/`:
  ```bash
  ls client/src/game/gamelogic/fetch.ts 2>&1
  ```
  Expected: `No such file or directory`.
