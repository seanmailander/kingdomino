# Game Engine Package Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `GameSession`, game state classes, and pure game logic from `client/` into a standalone `packages/kingdomino-engine` npm workspace package with a strict command/query/observe API surface, and extract the commitment/seed protocol into `packages/kingdomino-commitment`.

**Architecture:** Two new npm workspace packages are created inside the repo. `kingdomino-engine` owns all game state (GameSession, Player, Board, Round, Deal) and pure logic (gamelogic/). `kingdomino-commitment` owns the peer seed exchange protocol. LobbyFlow is trimmed to lobby-only; the engine drives its own game loop via a `SeedProvider`. `Player.isLocal` is removed; `GameSession` receives `localPlayerId` instead.

**Tech Stack:** TypeScript 5, Vitest 4, npm workspaces, seedrandom, Web Crypto API (`crypto.subtle`)

---

## File Map

### Created

```
packages/
  kingdomino-engine/
    package.json
    tsconfig.json
    vitest.config.ts
    src/
      index.ts                ← public barrel export
      SeedProvider.ts         ← interface: nextSeed(): Promise<string>
      GameEvent.ts            ← named event types + GameEvent union
      GameEventBus.ts         ← typed pub/sub
      types.ts                ← PlayerId, CardId, Direction
      Player.ts               ← domain entity (no isLocal)
      Board.ts
      Round.ts
      Deal.ts
      GameSession.ts          ← orchestrator + internal game loop
      GameSession.test.ts     ← migrated from client
      Round.test.ts           ← migrated from client
      gamelogic/
        board.ts              ← moved from client
        board.test.ts         ← moved from client
        cards.ts              ← moved from client
        cards.test.ts         ← moved from client
        utils.ts              ← moved from client; chooseOrderFromSeed generalized
        utils.test.ts         ← moved from client
        winners.ts            ← moved from client
        winners.test.ts       ← moved from client

  kingdomino-commitment/
    package.json
    tsconfig.json
    vitest.config.ts
    src/
      index.ts
      CommitmentTransport.ts  ← narrow transport interface for seed exchange
      CommitmentSeedProvider.ts ← commit/reveal protocol; migrated from ConnectionManager
      RandomSeedProvider.ts   ← deterministic seed for solo + tests
      CommitmentSeedProvider.test.ts
      RandomSeedProvider.test.ts
```

### Modified

```
package.json                                    ← add workspaces
client/package.json                             ← add kingdomino-engine + kingdomino-commitment deps
client/src/game/state/types.ts                  ← remove (re-export from engine)
client/src/game/state/Player.ts                 ← remove (now in engine)
client/src/game/state/Board.ts                  ← remove (now in engine)
client/src/game/state/Round.ts                  ← remove (now in engine)
client/src/game/state/Deal.ts                   ← remove (now in engine)
client/src/game/state/GameSession.ts            ← remove (now in engine)
client/src/game/gamelogic/                      ← all files removed (now in engine)
client/src/game/state/ConnectionManager.ts      ← remove buildTrustedSeed; keep control msgs only
client/src/game/state/connection.solo.ts        ← use RandomSeedProvider
client/src/game/state/connection.testing.ts     ← use RandomSeedProvider
client/src/game/state/game.messages.ts          ← WireMessage: MoveMessage + ControlMessage
client/src/game/state/game.flow.ts              ← lobby-only LobbyFlow; call session.startGame()
client/src/game/state/game.flow.test.ts         ← update for new API
client/src/App/store.ts                         ← subscribe to GameEvent union; remove player:joined
```

---

## Task 1: Workspace Scaffolding

**Files:**
- Modify: `package.json`
- Create: `packages/kingdomino-engine/package.json`
- Create: `packages/kingdomino-engine/tsconfig.json`
- Create: `packages/kingdomino-engine/vitest.config.ts`
- Create: `packages/kingdomino-engine/src/index.ts`
- Create: `packages/kingdomino-commitment/package.json`
- Create: `packages/kingdomino-commitment/tsconfig.json`
- Create: `packages/kingdomino-commitment/vitest.config.ts`
- Create: `packages/kingdomino-commitment/src/index.ts`
- Modify: `client/package.json`

- [ ] **Step 1: Confirm tests are green before starting**

```bash
cd client && npm test -- --reporter=verbose 2>&1 | tail -5
```
Expected: all tests pass.

- [ ] **Step 2: Add workspaces to root package.json**

Replace the `"scripts"` block keeping everything else, adding `"workspaces"`:

```json
{
  "name": "kingdomino",
  "workspaces": ["client", "packages/*"],
  "scripts": {
    "lint": "oxlint client/src",
    "lint:fix": "oxlint --fix client/src",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "test": "echo \"Tests are green. Green is good\""
  }
}
```
(keep existing `version`, `description`, `homepage`, etc. fields)

- [ ] **Step 3: Create engine package scaffold**

```bash
mkdir -p packages/kingdomino-engine/src/gamelogic
```

`packages/kingdomino-engine/package.json`:
```json
{
  "name": "kingdomino-engine",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "tscheck": "tsc --noEmit"
  },
  "dependencies": {
    "seedrandom": "^3.0.5"
  },
  "devDependencies": {
    "@types/seedrandom": "^3.0.8",
    "typescript": "^5.9.3",
    "vitest": "^4.0.0"
  }
}
```

`packages/kingdomino-engine/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`packages/kingdomino-engine/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
  },
});
```

`packages/kingdomino-engine/src/index.ts` (empty barrel for now):
```ts
// Public API — populated in later tasks
export {};
```

- [ ] **Step 4: Create commitment package scaffold**

```bash
mkdir -p packages/kingdomino-commitment/src
```

`packages/kingdomino-commitment/package.json`:
```json
{
  "name": "kingdomino-commitment",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "tscheck": "tsc --noEmit"
  },
  "dependencies": {
    "kingdomino-engine": "*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.0"
  }
}
```

`packages/kingdomino-commitment/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`packages/kingdomino-commitment/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
  },
});
```

`packages/kingdomino-commitment/src/index.ts`:
```ts
export {};
```

- [ ] **Step 5: Add engine + commitment as client dependencies**

In `client/package.json`, add to `"dependencies"`:
```json
"kingdomino-engine": "*",
"kingdomino-commitment": "*"
```

- [ ] **Step 6: Install workspaces**

```bash
cd /path/to/repo/root && npm install
```

Expected: `node_modules/kingdomino-engine` and `node_modules/kingdomino-commitment` symlinks created.

- [ ] **Step 7: Verify client tests still pass**

```bash
cd client && npm test 2>&1 | tail -10
```
Expected: all tests pass (nothing changed in source yet).

- [ ] **Step 8: Commit**

```bash
git add packages/ package.json client/package.json package-lock.json
git commit -m "chore: add kingdomino-engine and kingdomino-commitment workspace scaffolding

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: Move Gamelogic to Engine

Move the four pure-logic files and their tests from `client/src/game/gamelogic/` to `packages/kingdomino-engine/src/gamelogic/`. Update `chooseOrderFromSeed` to accept a generic player ID array instead of the `{ me, them }` shape.

**Files:**
- Move: `client/src/game/gamelogic/{board,cards,utils,winners}.ts` → `packages/kingdomino-engine/src/gamelogic/`
- Move: `client/src/game/gamelogic/{board,cards,utils,winners}.test.ts` → `packages/kingdomino-engine/src/gamelogic/`
- Modify: `packages/kingdomino-engine/src/gamelogic/utils.ts` (generalize `chooseOrderFromSeed`)
- Modify: `packages/kingdomino-engine/src/index.ts` (barrel)

- [ ] **Step 1: Copy gamelogic files to engine**

```bash
cp client/src/game/gamelogic/board.ts    packages/kingdomino-engine/src/gamelogic/
cp client/src/game/gamelogic/cards.ts    packages/kingdomino-engine/src/gamelogic/
cp client/src/game/gamelogic/utils.ts    packages/kingdomino-engine/src/gamelogic/
cp client/src/game/gamelogic/winners.ts  packages/kingdomino-engine/src/gamelogic/
cp client/src/game/gamelogic/board.test.ts    packages/kingdomino-engine/src/gamelogic/
cp client/src/game/gamelogic/cards.test.ts    packages/kingdomino-engine/src/gamelogic/
cp client/src/game/gamelogic/utils.test.ts    packages/kingdomino-engine/src/gamelogic/
cp client/src/game/gamelogic/winners.test.ts  packages/kingdomino-engine/src/gamelogic/
```

- [ ] **Step 2: Run engine tests — expect failures due to missing seedrandom types**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | head -30
```
Expected: import/type errors for `seedrandom`. Fix by ensuring `@types/seedrandom` is installed (already in `devDependencies`). Run `npm install` from workspace root if needed.

- [ ] **Step 3: Generalize `chooseOrderFromSeed` in engine utils.ts**

The client version accepts `{ me: string; them: string }`. Change the engine version to accept `string[]` so the engine is not coupled to the peer-connection concept:

In `packages/kingdomino-engine/src/gamelogic/utils.ts`, replace the `PeerIdentifiers` type and `chooseOrderFromSeed` export:

```ts
// Remove: type PeerIdentifiers = { me: string; them: string };

// Replace chooseOrderFromSeed:
export const chooseOrderFromSeed = (seed: string, playerIds: readonly string[]): string[] => {
  // Sort for determinism (both peers start from the same canonical order)
  const sorted = [...playerIds].sort();
  return seededShuffle(seed)(sorted);
};
```

Also update `utils.test.ts` in the engine to test the new signature:

```ts
// In packages/kingdomino-engine/src/gamelogic/utils.test.ts
// Replace any chooseOrderFromSeed tests that use { me, them } with:
it("chooseOrderFromSeed returns a deterministic order for the same seed", () => {
  const a = chooseOrderFromSeed("test-seed", ["alice", "bob"]);
  const b = chooseOrderFromSeed("test-seed", ["bob", "alice"]); // different insertion order
  expect(a).toEqual(b); // same result — sort() ensures determinism
  expect(a).toHaveLength(2);
  expect(a).toContain("alice");
  expect(a).toContain("bob");
});
```

- [ ] **Step 4: Run engine tests — expect pass**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | tail -10
```
Expected: all gamelogic tests pass.

- [ ] **Step 5: Move `commit`/`verify`/`combine` to engine utils.ts**

These commitment/reveal functions currently live in `client/src/game/gamelogic/utils.ts` (already being moved in Steps 1–8). However, the existing signatures in that file need to be **replaced** with cleaner ones that match what `CommitmentSeedProvider` (Task 7) will consume. The existing `commit()` takes no args and returns an object; the new version takes a pre-generated secret string and returns just the hash. Make these replacements in the engine copy of `utils.ts` after Step 1:

In `packages/kingdomino-engine/src/gamelogic/utils.ts`, add the following exports (copy the implementations verbatim from `ConnectionManager.ts`):

```ts
// Commitment protocol utilities — also used by kingdomino-commitment package
export const commit = async (secret: string): Promise<string> => {
  const data = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
};

export const verify = async (secret: string, commitment: string): Promise<boolean> =>
  (await commit(secret)) === commitment;

export const combine = (a: string, b: string): string => {
  const aNum = BigInt("0x" + a);
  const bNum = BigInt("0x" + b);
  return (aNum ^ bNum).toString(16).padStart(64, "0");
};
```

Remove these same functions from `client/src/game/state/ConnectionManager.ts` in Task 8.

- [ ] **Step 6: Update engine barrel (src/index.ts)**

```ts
// packages/kingdomino-engine/src/index.ts
export * from "./gamelogic/board";
export * from "./gamelogic/cards";
export * from "./gamelogic/utils";
export * from "./gamelogic/winners";
```

- [ ] **Step 7: Update client gamelogic imports to use engine package**

In every file under `client/src/` that imports from `"../gamelogic/..."` or `"../../gamelogic/..."` or `"./gamelogic/..."`, change those imports to `"kingdomino-engine"`. Files to update:
- `client/src/game/state/GameSession.ts`
- `client/src/game/state/Board.ts`
- `client/src/game/state/ConnectionManager.ts`
- `client/src/game/state/game.flow.ts`
- `client/src/game/state/ai.player.ts`
- `client/src/game/state/connection.solo.ts`
- Any visual components that imported from gamelogic directly

Example change in `GameSession.ts`:
```ts
// Before:
import { getCard } from "../gamelogic/cards";
import { findPlacementWithin5x5, ... } from "../gamelogic/board";

// After:
import { getCard, findPlacementWithin5x5, ... } from "kingdomino-engine";
```

- [ ] **Step 8: Delete client gamelogic source files (keep game.messages.ts etc.)**

```bash
rm client/src/game/gamelogic/board.ts
rm client/src/game/gamelogic/cards.ts
rm client/src/game/gamelogic/utils.ts
rm client/src/game/gamelogic/winners.ts
rm client/src/game/gamelogic/board.test.ts
rm client/src/game/gamelogic/cards.test.ts
rm client/src/game/gamelogic/utils.test.ts
rm client/src/game/gamelogic/winners.test.ts
```

- [ ] **Step 9: Run client tests — expect pass**

```bash
cd client && npm test 2>&1 | tail -10
```
Expected: all pass (imports now resolve through `kingdomino-engine` workspace package).

- [ ] **Step 10: Commit**

```bash
git add packages/kingdomino-engine/src/gamelogic/ client/src/game/ package-lock.json
git commit -m "refactor: move gamelogic pure functions to kingdomino-engine package

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Move State Classes to Engine

Move `types.ts`, `Player.ts` (removing `isLocal`), `Board.ts`, `Round.ts`, and `Deal.ts` to the engine package. Update `GameSession.ts` (still in client for now) to import from the engine.

**Files:**
- Move: `client/src/game/state/types.ts` → `packages/kingdomino-engine/src/types.ts`
- Move: `client/src/game/state/Board.ts` → `packages/kingdomino-engine/src/Board.ts`
- Move: `client/src/game/state/Round.ts` → `packages/kingdomino-engine/src/Round.ts`
- Move: `client/src/game/state/Deal.ts` → `packages/kingdomino-engine/src/Deal.ts`
- Move: `client/src/game/state/Player.ts` → `packages/kingdomino-engine/src/Player.ts` (remove `isLocal`)
- Move: `client/src/game/state/Round.test.ts` → `packages/kingdomino-engine/src/Round.test.ts`

- [ ] **Step 1: Write failing test in engine for Player without isLocal**

Create `packages/kingdomino-engine/src/Player.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Player } from "./Player";

describe("Player", () => {
  it("has an id", () => {
    const p = new Player("alice");
    expect(p.id).toBe("alice");
  });

  it("does not have an isLocal property", () => {
    const p = new Player("alice");
    // @ts-expect-error isLocal should not exist on Player
    expect(p.isLocal).toBeUndefined();
  });

  it("starts with a zero score", () => {
    const p = new Player("alice");
    expect(p.score()).toBe(0);
  });
});
```

- [ ] **Step 2: Run engine tests — expect fail (Player.ts not yet in engine)**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | grep "Player"
```
Expected: FAIL — cannot find module `./Player`.

- [ ] **Step 3: Copy types, Board, Round, Deal to engine (unmodified)**

```bash
cp client/src/game/state/types.ts  packages/kingdomino-engine/src/types.ts
cp client/src/game/state/Board.ts  packages/kingdomino-engine/src/Board.ts
cp client/src/game/state/Round.ts  packages/kingdomino-engine/src/Round.ts
cp client/src/game/state/Deal.ts   packages/kingdomino-engine/src/Deal.ts
cp client/src/game/state/Round.test.ts packages/kingdomino-engine/src/Round.test.ts
```

In `Board.ts`, `Round.ts`, `Deal.ts`: update any internal imports from `"./types"` — these stay as-is since they're in the same directory. Update imports from `"../gamelogic/..."` to use `"./gamelogic/..."` (relative within engine).

- [ ] **Step 4: Create engine Player.ts (isLocal removed)**

```ts
// packages/kingdomino-engine/src/Player.ts
import type { PlayerId, Direction, CardId } from "./types";
import { Board } from "./Board";

export class Player {
  private _board: Board = new Board();

  constructor(readonly id: PlayerId) {}

  get board(): Board {
    return this._board;
  }

  score(): number {
    return this._board.score();
  }

  applyPlacement(cardId: CardId, x: number, y: number, direction: Direction): void {
    this._board.place(cardId, x, y, direction);
  }
}
```

- [ ] **Step 5: Run engine tests — expect pass**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | tail -10
```
Expected: Player tests + Round tests pass.

- [ ] **Step 6: Update engine barrel (src/index.ts)**

```ts
// packages/kingdomino-engine/src/index.ts
export * from "./gamelogic/board";
export * from "./gamelogic/cards";
export * from "./gamelogic/utils";
export * from "./gamelogic/winners";
export type { PlayerId, CardId, Direction } from "./types";
export { Player } from "./Player";
export { Board } from "./Board";
export type { BoardCell, BoardGrid } from "./Board";
export { Round } from "./Round";
export type { RoundPhase } from "./Round";
export { Deal } from "./Deal";
```

- [ ] **Step 7: Update client imports to use engine for these types**

In `client/src/game/state/GameSession.ts`, `game.flow.ts`, `connection.solo.ts`, `ai.player.ts`, `connection.testing.ts`, visuals that import `Player`, `Board`, `Round`, `Deal`, `types`:

```ts
// Before:
import { Player } from "./Player";
import { Deal } from "./Deal";
import type { PlayerId, CardId } from "./types";

// After:
import { Player, Deal } from "kingdomino-engine";
import type { PlayerId, CardId } from "kingdomino-engine";
```

In files that create `new Player(id, isLocal)`, update to `new Player(id)`. `isLocal` is gone. For places that read `player.isLocal`, find them all and substitute `player.id === session.localPlayerId` (or similar — `GameSession` will provide the local player concept in the next task).

- [ ] **Step 8: Delete client state files that moved to engine**

```bash
rm client/src/game/state/types.ts
rm client/src/game/state/Player.ts
rm client/src/game/state/Board.ts
rm client/src/game/state/Round.ts
rm client/src/game/state/Deal.ts
rm client/src/game/state/Round.test.ts
```

- [ ] **Step 9: Run client tests — expect pass**

```bash
cd client && npm test 2>&1 | tail -10
```
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add packages/kingdomino-engine/src/ client/src/game/state/ package-lock.json
git commit -m "refactor: move Player/Board/Round/Deal to kingdomino-engine; remove Player.isLocal

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Move GameSession + Introduce GameEvent Union

Move `GameSession.ts` and its bus to the engine. Replace `GameEventMap` with the named-type `GameEvent` discriminated union. Add `localPlayerId` to the constructor. Remove `player:joined` from events. Move `GameSession.test.ts` to the engine.

**Files:**
- Create: `packages/kingdomino-engine/src/GameEvent.ts`
- Create: `packages/kingdomino-engine/src/GameEventBus.ts`
- Move: `client/src/game/state/GameSession.ts` → `packages/kingdomino-engine/src/GameSession.ts`
- Move: `client/src/game/tests/session.test.ts` → `packages/kingdomino-engine/src/GameSession.test.ts`
- Modify: `packages/kingdomino-engine/src/index.ts`

- [ ] **Step 1: Write a failing test for the GameEvent union shape**

Create `packages/kingdomino-engine/src/GameEvent.test.ts`:
```ts
import { describe, it, expectTypeOf } from "vitest";
import type { GameEvent, PickMadeEvent, PlaceMadeEvent } from "./GameEvent";

describe("GameEvent", () => {
  it("GameEvent is a discriminated union with type field", () => {
    // Compile-time check: all variants have a `type` field
    expectTypeOf<GameEvent>().toHaveProperty("type");
  });

  it("PickMadeEvent has player and cardId", () => {
    expectTypeOf<PickMadeEvent>().toHaveProperty("player");
    expectTypeOf<PickMadeEvent>().toHaveProperty("cardId");
  });

  it("PlaceMadeEvent has coordinates", () => {
    expectTypeOf<PlaceMadeEvent>().toHaveProperty("x");
    expectTypeOf<PlaceMadeEvent>().toHaveProperty("y");
    expectTypeOf<PlaceMadeEvent>().toHaveProperty("direction");
  });
});
```

- [ ] **Step 2: Run — expect fail (GameEvent.ts not yet created)**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | grep "GameEvent"
```
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create GameEvent.ts**

```ts
// packages/kingdomino-engine/src/GameEvent.ts
import type { Player } from "./Player";
import type { Round } from "./Round";
import type { CardId, Direction } from "./types";

export type GameScore = {
  player: Player;
  score: number;
  bonuses: { middleKingdom: number; harmony: number };
};

export type GameStartedEvent   = { type: "game:started";   players: ReadonlyArray<Player>; pickOrder: ReadonlyArray<Player> };
export type RoundStartedEvent  = { type: "round:started";  round: Round };
export type PickMadeEvent      = { type: "pick:made";       player: Player; cardId: CardId };
export type PlaceMadeEvent     = { type: "place:made";      player: Player; cardId: CardId; x: number; y: number; direction: Direction };
export type DiscardMadeEvent   = { type: "discard:made";    player: Player; cardId: CardId };
export type RoundCompleteEvent = { type: "round:complete";  nextPickOrder: ReadonlyArray<Player> };
export type GamePausedEvent    = { type: "game:paused" };
export type GameResumedEvent   = { type: "game:resumed" };
export type GameEndedEvent     = { type: "game:ended";      scores: GameScore[] };

export type GameEvent =
  | GameStartedEvent
  | RoundStartedEvent
  | PickMadeEvent
  | PlaceMadeEvent
  | DiscardMadeEvent
  | RoundCompleteEvent
  | GamePausedEvent
  | GameResumedEvent
  | GameEndedEvent;
```

- [ ] **Step 4: Create GameEventBus.ts**

```ts
// packages/kingdomino-engine/src/GameEventBus.ts
import type { GameEvent } from "./GameEvent";

type Listener<T extends GameEvent> = (event: T) => void;

export class GameEventBus {
  private listeners = new Map<string, Set<Listener<never>>>();

  on<T extends GameEvent["type"]>(
    type: T,
    listener: (e: Extract<GameEvent, { type: T }>) => void,
  ): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener as Listener<never>);
    return () => this.listeners.get(type)?.delete(listener as Listener<never>);
  }

  emit(event: GameEvent): void {
    this.listeners.get(event.type)?.forEach((fn) => fn(event as never));
  }
}
```

- [ ] **Step 5: Run engine tests — expect GameEvent tests to pass**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | grep -E "PASS|FAIL|GameEvent"
```
Expected: PASS.

- [ ] **Step 6: Copy and adapt GameSession.ts to engine**

Copy `client/src/game/state/GameSession.ts` to `packages/kingdomino-engine/src/GameSession.ts`.

Key changes:
1. Remove `GameEventMap`, `GameEventBus` (now separate files — import them)
2. Replace `events.emit("event:name", payload)` → `events.emit({ type: "event:name", ...payload })`
3. Replace `events.on("event:name", listener)` → same signature (GameEventBus updated)
4. Remove `"player:joined"` event and `addPlayer` emit
5. Add `localPlayerId?: PlayerId` to constructor and store as `private readonly _localPlayerId`
6. Remove `player.isLocal` references — use `p.id === this._localPlayerId` instead
7. Import from local engine files (not client paths)
8. Keep `beginRound()` and `endGame()` public for now (they become private in Task 6)

```ts
// packages/kingdomino-engine/src/GameSession.ts
import { getCard } from "./gamelogic/cards";
import {
  findPlacementWithin5x5, findPlacementWithin7x7,
  getEligiblePositions, getValidDirections,
  staysWithin5x5, staysWithin7x7,
} from "./gamelogic/board";
import type { PlayerId, CardId, Direction } from "./types";
import type { BoardGrid } from "./Board";
import { Player } from "./Player";
import { Deal } from "./Deal";
import { Round } from "./Round";
import { GameEventBus } from "./GameEventBus";
import type { GameVariant } from "./gamelogic/cards";

export type { GameEvent, GameEventBus, GameScore } from "./GameEvent"; // re-export
export type { BoardCell, BoardGrid } from "./Board";
export { Board } from "./Board";
export { Player } from "./Player";
export { Deal } from "./Deal";
export { Round } from "./Round";
export type { RoundPhase } from "./Round";
export type { PlayerId, CardId } from "./types";

export type GamePhase = "lobby" | "playing" | "paused" | "finished";
export type GameBonuses = { middleKingdom?: boolean; harmony?: boolean };

export class GameSession {
  readonly events = new GameEventBus();

  private _phase: GamePhase = "lobby";
  private _players: Player[] = [];
  private _pickOrder: Player[] = [];
  private _currentRound: Round | null = null;
  private readonly _variant: GameVariant;
  private readonly _bonuses: GameBonuses;
  private readonly _localPlayerId: PlayerId | undefined;
  private readonly _discardedPlayerIds = new Set<string>();

  constructor({
    variant = "standard",
    bonuses = {},
    localPlayerId,
  }: {
    variant?: GameVariant;
    bonuses?: GameBonuses;
    localPlayerId?: PlayerId;
  } = {}) {
    this._variant = variant;
    this._bonuses = bonuses;
    this._localPlayerId = localPlayerId;
  }

  // ... (rest of methods updated to use this._localPlayerId instead of player.isLocal)
  // myPlayer(): Player | undefined { return this._players.find(p => p.id === this._localPlayerId); }
  // addPlayer() no longer emits player:joined

  // Queries
  get phase(): GamePhase { return this._phase; }
  get players(): ReadonlyArray<Player> { return this._players; }
  get pickOrder(): ReadonlyArray<Player> { return this._pickOrder; }
  get round(): Round | null { return this._currentRound; }

  /** Returns the card infos in the current round's deal, or [] if no round is active. */
  deal(): CardInfo[] {
    return this._currentRound ? this._currentRound.deal.cards.map((id) => getCard(id)) : [];
  }
```

> **Note:** This is a significant file. Copy the full implementation from the client, then apply the changes above methodically. The test in the next step will verify correctness.

- [ ] **Step 7: Copy session tests to engine and adapt**

```bash
cp client/src/game/tests/session.test.ts packages/kingdomino-engine/src/GameSession.test.ts
```

Update all imports in `GameSession.test.ts` to use engine-relative paths (no `../../App/store` etc.). Remove any test that referenced `player.isLocal` — replace with checking `session.myPlayer()?.id === playerId`.

The session tests import `Player` and construct `new Player(id, isLocal)` — change to `new Player(id)`. The session itself receives `localPlayerId` in the constructor.

Example fixture change:
```ts
// Before:
const alice = new Player("alice", true);
const bob   = new Player("bob", false);
const session = new GameSession();
session.addPlayer(alice);
session.addPlayer(bob);
session.startGame([alice, bob]);

// After:
const session = new GameSession({ localPlayerId: "alice" });
session.addPlayer(new Player("alice"));
session.addPlayer(new Player("bob"));
session.startGame([session.playerById("alice")!, session.playerById("bob")!]);
```

- [ ] **Step 8: Run engine tests — expect pass**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | tail -15
```
Expected: all GameSession + Round + gamelogic tests pass.

- [ ] **Step 9: Update engine barrel**

```ts
// packages/kingdomino-engine/src/index.ts
export * from "./gamelogic/board";
export * from "./gamelogic/cards";
export * from "./gamelogic/utils";
export * from "./gamelogic/winners";
export type { PlayerId, CardId, Direction } from "./types";
export { Player } from "./Player";
export { Board } from "./Board";
export type { BoardCell, BoardGrid } from "./Board";
export { Round } from "./Round";
export type { RoundPhase } from "./Round";
export { Deal } from "./Deal";
export type { GameEvent, GameScore,
  GameStartedEvent, RoundStartedEvent, PickMadeEvent, PlaceMadeEvent,
  DiscardMadeEvent, RoundCompleteEvent, GamePausedEvent, GameResumedEvent,
  GameEndedEvent } from "./GameEvent";
export { GameEventBus } from "./GameEventBus";
export { GameSession } from "./GameSession";
export type { GamePhase, GameBonuses } from "./GameSession";
```

- [ ] **Step 10: Update client to import GameSession from engine**

In `client/src/game/state/game.flow.ts` and `client/src/App/store.ts`:
```ts
// Before:
import { GameSession, Player, GameEventMap } from "./GameSession";

// After:
import { GameSession, Player, type GameEvent } from "kingdomino-engine";
```

In `store.ts`, change the `ALL_EVENTS` array to use `GameEvent["type"]` values. Remove `"player:joined"` from the list. Change `GameEventMap` type references to `GameEvent`.

- [ ] **Step 11: Delete client's GameSession.ts**

```bash
rm client/src/game/state/GameSession.ts
rm -rf client/src/game/tests/  # session.test.ts moved to engine
```

- [ ] **Step 12: Run both engine and client tests**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | tail -5
cd ../../client && npm test 2>&1 | tail -10
```
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add packages/kingdomino-engine/src/ client/src/ package-lock.json
git commit -m "refactor: move GameSession to kingdomino-engine; introduce GameEvent discriminated union

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: Add SeedProvider + Pause/Resume to GameSession

Add the `SeedProvider` interface to the engine. Add `pause()` and `resume()` commands to `GameSession` emitting `game:paused` / `game:resumed`. These are needed by LobbyFlow (still via adapter) and will be used by the internal game loop in the next task.

**Files:**
- Create: `packages/kingdomino-engine/src/SeedProvider.ts`
- Modify: `packages/kingdomino-engine/src/GameSession.ts`
- Modify: `packages/kingdomino-engine/src/index.ts`

- [ ] **Step 1: Write failing tests for pause/resume**

In `packages/kingdomino-engine/src/GameSession.test.ts`, add a new `describe("pause and resume")` block:
```ts
describe("pause and resume", () => {
  it("pause() in playing phase transitions to paused and emits game:paused", () => {
    const { session } = makeSession(); // existing helper that starts the game
    const events: string[] = [];
    session.events.on("game:paused", () => events.push("game:paused"));

    expect(session.phase).toBe("playing");
    session.pause();
    expect(session.phase).toBe("paused");
    expect(events).toEqual(["game:paused"]);
  });

  it("resume() in paused phase transitions to playing and emits game:resumed", () => {
    const { session } = makeSession();
    const events: string[] = [];
    session.events.on("game:resumed", () => events.push("game:resumed"));

    session.pause();
    session.resume();
    expect(session.phase).toBe("playing");
    expect(events).toEqual(["game:resumed"]);
  });

  it("pause() throws if not in playing phase", () => {
    const session = new GameSession({ localPlayerId: "alice" });
    expect(() => session.pause()).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/kingdomino-engine && npm test -- --reporter=verbose 2>&1 | grep "pause\|resume"
```
Expected: FAIL — `pause` is not a function.

- [ ] **Step 3: Create SeedProvider.ts**

```ts
// packages/kingdomino-engine/src/SeedProvider.ts

/**
 * Provides seeds for cryptographically fair card distribution.
 * Implementations: CommitmentSeedProvider (P2P), RandomSeedProvider (solo/test).
 *
 * Note: `nextSeed()` returns `Promise<string>` (hex string), not `Promise<number>`.
 * The spec mentions `number` in one place but hex strings are the correct type
 * for SHA-256 commitment output. Use strings throughout.
 */
export interface SeedProvider {
  nextSeed(): Promise<string>;
}
```

- [ ] **Step 4: Add pause()/resume() to GameSession**

In `packages/kingdomino-engine/src/GameSession.ts`:

1. Add `"paused"` to `GamePhase` (already in the type — verify it's there).
2. Add the two methods:

```ts
pause(): void {
  if (this._phase !== "playing") throw new Error("Can only pause while playing");
  this._phase = "paused";
  this.events.emit({ type: "game:paused" });
}

resume(): void {
  if (this._phase !== "paused") throw new Error("Can only resume while paused");
  this._phase = "playing";
  this.events.emit({ type: "game:resumed" });
}
```

- [ ] **Step 5: Run — expect pass**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | tail -5
```
Expected: all pass including new pause/resume tests.

- [ ] **Step 6: Update engine barrel to export SeedProvider**

```ts
export type { SeedProvider } from "./SeedProvider";
```

- [ ] **Step 7: Run client tests — expect pass (no client changes yet)**

```bash
cd client && npm test 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
git add packages/kingdomino-engine/src/
git commit -m "feat(engine): add SeedProvider interface and pause/resume commands to GameSession

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6: Internal Game Loop in GameSession

Wire `startGame()` to drive the full game loop via `SeedProvider`. Make `beginRound()` and `endGame()` private. `startGame()` now takes no arguments — it calls `seedProvider.nextSeed()` for pick order and each subsequent round.

**Files:**
- Modify: `packages/kingdomino-engine/src/GameSession.ts`
- Modify: `packages/kingdomino-engine/src/GameSession.test.ts`

- [ ] **Step 1: Write a failing integration test for the game loop**

Add a new describe block to `GameSession.test.ts`. This test needs a `SeedProvider` and a helper that auto-plays picks and placements:

```ts
import type { SeedProvider } from "./SeedProvider";
import { findPlacementWithin5x5 } from "./gamelogic/board";

/** Returns a SeedProvider that yields a fixed sequence of seeds */
const fixedSeeds = (seeds: string[]): SeedProvider => {
  let i = 0;
  return { nextSeed: async () => seeds[i++] ?? "fallback" };
};

/** Auto-plays all picks and placements for the current round */
const autoPlayRound = (session: GameSession): void => {
  while (session.currentRound !== null) {
    const round = session.currentRound;
    const actor = round.currentActor;
    if (!actor) break;

    if (round.phase === "picking") {
      const snap = round.deal.snapshot();
      const available = snap.filter((s) => s.pickedBy === null);
      session.handlePick(actor.id, available[0].cardId);
    } else {
      const cardId = round.deal.pickedCardFor(actor);
      if (cardId === null) break;
      const placement = findPlacementWithin5x5(actor.board.snapshot(), cardId);
      if (placement) {
        session.handlePlacement(actor.id, placement.x, placement.y, placement.direction);
      } else {
        session.handleDiscard(actor.id);
      }
    }
  }
};

describe("game loop", () => {
  it("startGame() plays all rounds and emits game:ended when deck exhausted", async () => {
    // Use enough fixed seeds: 1 for pick order + 12 rounds (48 cards / 4 per round)
    const seeds = Array.from({ length: 13 }, (_, i) => `seed-${i}`);
    const seedProvider = fixedSeeds(seeds);

    const session = new GameSession({ localPlayerId: "alice", seedProvider });
    session.addPlayer(new Player("alice"));
    session.addPlayer(new Player("bob"));

    const endedPromise = new Promise<void>((resolve) =>
      session.events.on("game:ended", () => resolve()),
    );

    session.startGame(); // triggers async loop

    // Drive all picks and placements as rounds fire
    let roundCount = 0;
    session.events.on("round:started", () => {
      roundCount++;
      // Use setImmediate to let the async loop await, then auto-play
      setImmediate(() => autoPlayRound(session));
    });

    await endedPromise;
    expect(roundCount).toBe(12); // 48 cards / 4 per round
  }, 5000);
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/kingdomino-engine && npm test -- --reporter=verbose 2>&1 | grep "game loop"
```
Expected: FAIL — `startGame()` still takes `pickOrder` and has no internal loop.

- [ ] **Step 3: Add `seedProvider` to GameSession constructor and wire the game loop**

In `packages/kingdomino-engine/src/GameSession.ts`:

1. Import `SeedProvider` and `chooseOrderFromSeed`, `getNextFourCards`, `generateDeck`.
2. Store `_seedProvider` and `_remainingDeck` as private fields.
3. Change `startGame()` signature to `startGame(): void`.
4. Make `beginRound()` private.
5. Make `endGame()` private.
6. Add internal `_runGameLoop()` async method.

```ts
import type { SeedProvider } from "./SeedProvider";
import { chooseOrderFromSeed, getNextFourCards } from "./gamelogic/utils";
import { generateDeck } from "./gamelogic/cards";

// In constructor options:
// seedProvider?: SeedProvider;

// In constructor body (store provider only — deck size depends on player count, built in startGame):
// this._seedProvider = options.seedProvider;

startGame(): void {
  if (this._phase !== "lobby") throw new Error("Game not in lobby phase");
  // Build the deck now so player count is known; generateDeck() always returns all 48 cards
  this._remainingDeck = [...generateDeck()] as CardId[];
  this._phase = "playing";
  // Kick off async loop; errors surface via console and reset
  void this._runGameLoop();
}

private async _runGameLoop(): Promise<void> {
  if (!this._seedProvider) {
    // No seed provider: caller must drive rounds manually (legacy / testing)
    return;
  }
  try {
    // First seed determines pick order
    const firstSeed = await this._seedProvider.nextSeed();
    const orderedIds = chooseOrderFromSeed(firstSeed, this._players.map((p) => p.id));
    this._pickOrder = orderedIds.map((id) => this._requirePlayer(id));
    this.events.emit({ type: "game:started", players: [...this._players], pickOrder: [...this._pickOrder] });

    while (this._remainingDeck.length > 0) {
      if (this._phase === "paused") {
        // Wait for resume
        await new Promise<void>((resolve) => {
          const off = this.events.on("game:resumed", () => { off(); resolve(); });
        });
      }
      if (this._phase !== "playing") break;

      const seed = await this._seedProvider.nextSeed();
      const { next: cardIds, remaining } = getNextFourCards(seed, this._remainingDeck);
      this._remainingDeck = remaining as CardId[];

      this._beginRound(cardIds as [CardId, CardId, CardId, CardId]);

      // Wait for round:complete
      await new Promise<void>((resolve) => {
        const off = this.events.on("round:complete", () => { off(); resolve(); });
      });
    }

    if (this._phase === "playing") {
      this._endGame();
    }
  } catch (e) {
    console.error("GameSession game loop error:", e);
  }
}

private _beginRound(cardIds: [CardId, CardId, CardId, CardId]): void {
  // renamed from beginRound()
  const deal = new Deal(cardIds);
  this._currentRound = new Round(deal, this._pickOrder);
  this.events.emit({ type: "round:started", round: this._currentRound });
}

private _endGame(): void {
  this._phase = "finished";
  const scores = /* ... existing scoring logic ... */
  this.events.emit({ type: "game:ended", scores });
}
```

> **Note for implementer:** The existing `beginRound()` and `endGame()` public methods contained all the implementation logic. Rename them to `_beginRound()` and `_endGame()`. Where `startGame()` previously took `pickOrder`, now that comes from the seed. Update all existing callers in the test suite that still call `beginRound()` / `startGame(pickOrder)` directly — these tests need updating to use the game loop pattern (with a `SeedProvider` or with the manual override for legacy tests).

- [ ] **Step 4: Update existing session tests for the new startGame() signature**

For tests that previously called `session.startGame([alice, bob])` and `session.beginRound([...])` directly, there are two migration options:

**Option A (preferred):** Use a `SeedProvider` that resolves immediately and controls pick order:
```ts
// fixedSeeds helper defined above
const session = new GameSession({
  localPlayerId: "alice",
  seedProvider: fixedSeeds(["seed-0", "seed-1", ...]),
});
session.addPlayer(new Player("alice"));
session.addPlayer(new Player("bob"));
session.startGame(); // async, loop driven by seedProvider
// Then manually trigger picks/places in test
```

**Option B (escape hatch for unit tests that test pick/place in isolation):** Keep a `beginRound()` test-only override. Mark with `@internal`:
```ts
/** @internal — test use only. In normal flow, the game loop calls this. */
beginRound(cardIds: [CardId, CardId, CardId, CardId]): void {
  this._beginRound(cardIds);
}
```

Choose Option B for tests that test pick/place mechanics directly (they don't need to test the loop). Use Option A for the new integration test. Update `GameSession.test.ts` accordingly.

- [ ] **Step 5: Run engine tests — expect all pass**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | tail -10
```
Expected: all pass including the new game loop test.

- [ ] **Step 6: Update LobbyFlow to call `session.startGame()` instead of `session.startGame(pickOrder)`**

In `client/src/game/state/game.flow.ts`:
- Remove `const firstSeed = await this.connectionManager.buildTrustedSeed();`
- Remove `const orderedIds = chooseOrderFromSeed(...)`
- Remove `session.startGame(pickOrder)`
- Add `session.startGame()` (engine handles pick order via SeedProvider)

> **Note:** The `SeedProvider` that `GameSession` will use isn't wired yet (that's Task 8). For now, leave a `TODO` comment and pass `seedProvider: undefined` (the game loop will skip the async loop, preserving the old manual-driven behavior used by existing flow tests).

- [ ] **Step 7: Run client tests — expect pass**

```bash
cd client && npm test 2>&1 | tail -10
```

- [ ] **Step 8: Commit**

```bash
git add packages/kingdomino-engine/src/ client/src/game/state/game.flow.ts
git commit -m "feat(engine): internal game loop in GameSession via SeedProvider; startGame() takes no args

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7: Create CommitmentSeedProvider (kingdomino-commitment)

Extract the commit/reveal seed-exchange logic from `ConnectionManager.buildTrustedSeed()` into `CommitmentSeedProvider` in the commitment package. Also create `RandomSeedProvider` for solo/test use.

**Files:**
- Create: `packages/kingdomino-commitment/src/CommitmentTransport.ts`
- Create: `packages/kingdomino-commitment/src/CommitmentSeedProvider.ts`
- Create: `packages/kingdomino-commitment/src/CommitmentSeedProvider.test.ts`
- Create: `packages/kingdomino-commitment/src/RandomSeedProvider.ts`
- Create: `packages/kingdomino-commitment/src/RandomSeedProvider.test.ts`
- Modify: `packages/kingdomino-commitment/src/index.ts`

- [ ] **Step 1: Write failing test for RandomSeedProvider**

```ts
// packages/kingdomino-commitment/src/RandomSeedProvider.test.ts
import { describe, it, expect } from "vitest";
import { RandomSeedProvider } from "./RandomSeedProvider";

describe("RandomSeedProvider", () => {
  it("returns a string from nextSeed()", async () => {
    const provider = new RandomSeedProvider();
    const seed = await provider.nextSeed();
    expect(typeof seed).toBe("string");
    expect(seed.length).toBeGreaterThan(0);
  });

  it("deterministic mode returns the same seed each time", async () => {
    const provider = new RandomSeedProvider({ fixed: "test-seed" });
    expect(await provider.nextSeed()).toBe("test-seed");
    expect(await provider.nextSeed()).toBe("test-seed");
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/kingdomino-commitment && npm test 2>&1 | head -10
```
Expected: FAIL — cannot find `RandomSeedProvider`.

- [ ] **Step 3: Create CommitmentTransport.ts**

```ts
// packages/kingdomino-commitment/src/CommitmentTransport.ts

/**
 * Narrow transport interface for the commitment/reveal seed exchange.
 * IGameConnection in the client satisfies this shape — no adapter needed.
 */
export interface CommitmentTransport {
  send(message: { type: string; content?: unknown }): void;
  waitFor<T>(messageType: string): Promise<T>;
}
```

- [ ] **Step 4: Create RandomSeedProvider.ts**

```ts
// packages/kingdomino-commitment/src/RandomSeedProvider.ts
import type { SeedProvider } from "kingdomino-engine";
import seedrandom from "seedrandom"; // if available, or use Math.random

export class RandomSeedProvider implements SeedProvider {
  private readonly _fixed?: string;

  constructor(options: { fixed?: string } = {}) {
    this._fixed = options.fixed;
  }

  async nextSeed(): Promise<string> {
    if (this._fixed !== undefined) return this._fixed;
    return String(seedrandom().int32());
  }
}
```

> **Note:** `RandomSeedProvider` depends on `kingdomino-engine` for the `SeedProvider` interface. `kingdomino-commitment/package.json` already lists `kingdomino-engine` as a dependency.

- [ ] **Step 5: Run RandomSeedProvider tests — expect pass**

```bash
cd packages/kingdomino-commitment && npm test 2>&1 | tail -5
```

- [ ] **Step 6: Write failing test for CommitmentSeedProvider**

```ts
// packages/kingdomino-commitment/src/CommitmentSeedProvider.test.ts
import { describe, it, expect } from "vitest";
import { CommitmentSeedProvider } from "./CommitmentSeedProvider";
import type { CommitmentTransport } from "./CommitmentTransport";

/** Simple in-process transport: messages go directly between two sides */
const makeLinkedPair = (): [CommitmentTransport, CommitmentTransport] => {
  type Resolver = (v: unknown) => void;
  const waiters: Map<string, Resolver[]> = new Map();
  const queued: Map<string, unknown[]> = new Map();

  const enqueue = (type: string, msg: unknown) => {
    const resolvers = waiters.get(type);
    if (resolvers?.length) {
      resolvers.shift()!(msg);
    } else {
      if (!queued.has(type)) queued.set(type, []);
      queued.get(type)!.push(msg);
    }
  };

  const makeTransport = (sendQueue: (t: string, m: unknown) => void): CommitmentTransport => ({
    send(msg) { sendQueue(msg.type, msg); },
    waitFor<T>(type: string) {
      const q = queued.get(type);
      if (q?.length) return Promise.resolve(q.shift() as T);
      return new Promise<T>((resolve) => {
        if (!waiters.has(type)) waiters.set(type, []);
        waiters.get(type)!.push(resolve as Resolver);
      });
    },
  });

  const qA: (t: string, m: unknown) => void = (t, m) => enqueue(t, m); // A→B
  const qB: (t: string, m: unknown) => void = (t, m) => enqueue(t, m); // B→A
  // Wire: A sends → B receives; B sends → A receives
  const queuesAB = new Map<string, unknown[]>();
  const queuesBA = new Map<string, unknown[]>();
  // ... (implement properly with two separate inbound queues)
  // Simplified: for test purposes use two separate CommitmentSeedProvider instances
  // sharing a deterministic in-process message passing channel

  return [makeTransport(qB), makeTransport(qA)];
};

describe("CommitmentSeedProvider", () => {
  it("two peers with linked transports produce the same seed", async () => {
    const [transportA, transportB] = makeLinkedPair();
    const providerA = new CommitmentSeedProvider(transportA);
    const providerB = new CommitmentSeedProvider(transportB);

    const [seedA, seedB] = await Promise.all([
      providerA.nextSeed(),
      providerB.nextSeed(),
    ]);
    expect(seedA).toBe(seedB);
    expect(typeof seedA).toBe("string");
  });
});
```

> **Note:** The `makeLinkedPair` helper needs to route A→B and B→A independently. The sketch above shows the concept — implement with two separate inbound message queues so A's `send()` delivers to B's `waitFor()` and vice versa.

- [ ] **Step 7: Create CommitmentSeedProvider.ts**

Extract `buildTrustedSeed()` logic from `client/src/game/state/ConnectionManager.ts`. The algorithm:
1. Generate a random local secret (hex string) using `crypto.getRandomValues`
2. Hash it via `commit(secret)` to get commitment
3. Send `{ type: "COMMITTMENT", content: { committment } }` via transport
4. Await `{ type: "COMMITTMENT" }` from peer
5. Send `{ type: "REVEAL", content: { secret } }`
6. Await `{ type: "REVEAL" }` from peer
7. Verify peer's commitment matches their revealed secret via `verify(theirSecret, theirCommittment)`
8. Combine both secrets via `combine(mySecret, theirSecret)` and return as seed string

Note: The new engine `commit`/`verify`/`combine` signatures (from Task 2 Step 5) are:
- `commit(secret: string): Promise<string>` — takes a pre-generated secret, returns hash
- `verify(secret: string, commitment: string): Promise<boolean>`
- `combine(a: string, b: string): string` — synchronous XOR of hex strings

```ts
// packages/kingdomino-commitment/src/CommitmentSeedProvider.ts
import { commit, verify, combine } from "kingdomino-engine";
import type { SeedProvider } from "kingdomino-engine";
import type { CommitmentTransport } from "./CommitmentTransport";

const randomHex = (): string => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
};

export class CommitmentSeedProvider implements SeedProvider {
  constructor(private readonly transport: CommitmentTransport) {}

  async nextSeed(): Promise<string> {
    const mySecret = randomHex();
    const myCommittment = await commit(mySecret);
    this.transport.send({ type: "COMMITTMENT", content: { committment: myCommittment } });

    const { committment: theirCommittment } = await this.transport.waitFor<{ committment: string }>("COMMITTMENT");
    this.transport.send({ type: "REVEAL", content: { secret: mySecret } });

    const { secret: theirSecret } = await this.transport.waitFor<{ secret: string }>("REVEAL");
    const isValid = await verify(theirSecret, theirCommittment);
    if (!isValid) throw new Error("Remote commitment verification failed");

    return combine(mySecret, theirSecret);
  }
}
```

- [ ] **Step 8: Run commitment tests — expect pass**

```bash
cd packages/kingdomino-commitment && npm test 2>&1 | tail -10
```

- [ ] **Step 9: Update commitment barrel**

```ts
// packages/kingdomino-commitment/src/index.ts
export type { CommitmentTransport } from "./CommitmentTransport";
export { CommitmentSeedProvider } from "./CommitmentSeedProvider";
export { RandomSeedProvider } from "./RandomSeedProvider";
```

- [ ] **Step 10: Commit**

```bash
git add packages/kingdomino-commitment/src/
git commit -m "feat(commitment): add CommitmentSeedProvider and RandomSeedProvider

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 8: Wire SeedProvider into Client; Simplify ConnectionManager

Update `SoloConnection`, `TestConnection`, and `ConnectionManager` to use the new packages. Remove `buildTrustedSeed()` from `ConnectionManager` (now in `CommitmentSeedProvider`). Wire `RandomSeedProvider` into solo and test connections.

**Files:**
- Modify: `client/src/game/state/ConnectionManager.ts`
- Modify: `client/src/game/state/connection.solo.ts`
- Modify: `client/src/game/state/connection.testing.ts`
- Modify: `client/src/game/state/game.flow.ts`

- [ ] **Step 1: Verify client tests are green**

```bash
cd client && npm test 2>&1 | tail -5
```

- [ ] **Step 2: Remove `buildTrustedSeed()` from ConnectionManager**

In `client/src/game/state/ConnectionManager.ts`:
- Remove: `buildTrustedSeed()`, `sendCommittment()`, `waitForCommittment()`, `sendReveal()`, `waitForReveal()`, `resetTrustedSeedHandshake()`, `assertHandshakeReady()`, `trustedSeedState` field
- Remove: `commit`, `verify`, `combine` imports and `TrustedSeedDependencies` type
- Remove: `COMMITTMENT`, `REVEAL` imports from `game.messages.ts`
- Keep: all control message methods (`sendPauseRequest/Ack`, `sendResumeRequest/Ack`, `sendExitRequest/Ack`, `waitFor*`)
- Keep: `sendStart()`, `sendMove()`, `waitForMove()` (these will change further in Task 9)

- [ ] **Step 3: Wire CommitmentSeedProvider into LobbyFlow**

In `client/src/game/state/game.flow.ts`, import and use `CommitmentSeedProvider`:

```ts
import { CommitmentSeedProvider } from "kingdomino-commitment";

// In runFlow():
const session = new GameSession({
  variant: this.variant,
  bonuses: this.bonuses,
  localPlayerId: connection.peerIdentifiers.me,
  seedProvider: new CommitmentSeedProvider(connection), // connection satisfies CommitmentTransport
});
```

Now `session.startGame()` will call `seedProvider.nextSeed()` for both pick-order and each round.

- [ ] **Step 4: Wire RandomSeedProvider into SoloConnection**

In `client/src/game/state/connection.solo.ts`, if `SoloConnection` currently drives seed exchange, replace with `RandomSeedProvider`. The solo game doesn't need the commit/reveal ceremony — both "peers" are in the same process.

Update the `SoloConnection` to implement `CommitmentTransport` (send/waitFor) so it can still be passed to `CommitmentSeedProvider`, OR pass a `RandomSeedProvider` directly to `GameSession` when creating a solo session.

In `LobbyFlow.ReadySolo()`:
```ts
ReadySolo() {
  this.aiPlayer = new RandomAIPlayer("them", "me", this.variant);
  this.soloConnection = new SoloConnection(this.aiPlayer);
  // For solo play, use a simple random seed (no commit/reveal needed)
  // Pass RandomSeedProvider directly to session in runFlow
  void this.runFlow(this.soloConnection, new RandomSeedProvider());
}
```

Update `runFlow` signature to accept optional `SeedProvider` override:
```ts
private async runFlow(connection: IGameConnection, seedProvider?: SeedProvider) {
  const session = new GameSession({
    ...,
    seedProvider: seedProvider ?? new CommitmentSeedProvider(connection),
  });
  ...
}
```

- [ ] **Step 5: Wire RandomSeedProvider into TestConnection**

`TestConnection` is used in unit/flow tests and drives the game with scripted moves. For tests that test `LobbyFlow` (not the engine loop), pass a `RandomSeedProvider` with a fixed seed so tests are deterministic:

In `game.flow.test.ts`, update test setup to pass a fixed seed provider:
```ts
const flow = new LobbyFlow({
  adapter: new AppFlowAdapter(),
  seedProvider: new RandomSeedProvider({ fixed: "test-seed" }),
});
```

Or: `TestConnection` can implement `CommitmentTransport` directly by responding to COMMITTMENT/REVEAL messages from its scripted scenario.

- [ ] **Step 6: Run client tests — expect pass**

```bash
cd client && npm test 2>&1 | tail -15
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add client/src/game/state/ package-lock.json
git commit -m "feat: wire CommitmentSeedProvider + RandomSeedProvider into client; simplify ConnectionManager

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 9: Simplify game.messages.ts → MoveMessage + ControlMessage

Replace the old opaque `MOVE` / `MoveGameMessage` with typed `MoveMessage` union. Rename remaining types to `ControlMessage`. Update `ConnectionManager`, connections, and `LobbyFlow`.

**Files:**
- Modify: `client/src/game/state/game.messages.ts`
- Modify: `client/src/game/state/ConnectionManager.ts`
- Modify: `client/src/game/state/game.flow.ts`
- Modify: `client/src/game/state/connection.testing.ts`

- [ ] **Step 1: Verify tests are green**

```bash
cd client && npm test 2>&1 | tail -5
```

- [ ] **Step 2: Rewrite game.messages.ts**

```ts
// client/src/game/state/game.messages.ts
import type { PlayerId, CardId, Direction } from "kingdomino-engine";

// ── Move messages (player actions over the wire) ──────────────────────────────

export const PICK    = "pick:made";
export const PLACE   = "place:made";
export const DISCARD = "discard:made";

export type PickMessage    = { type: typeof PICK;    playerId: PlayerId; cardId: CardId };
export type PlaceMessage   = { type: typeof PLACE;   playerId: PlayerId; x: number; y: number; direction: Direction };
export type DiscardMessage = { type: typeof DISCARD; playerId: PlayerId };
export type MoveMessage    = PickMessage | PlaceMessage | DiscardMessage;

// ── Control messages (session control over the wire) ─────────────────────────

export const START          = "START";
export const COMMITTMENT    = "COMMITTMENT";
export const REVEAL         = "REVEAL";
export const PAUSE_REQUEST  = "CONTROL_PAUSE_REQUEST";
export const PAUSE_ACK      = "CONTROL_PAUSE_ACK";
export const RESUME_REQUEST = "CONTROL_RESUME_REQUEST";
export const RESUME_ACK     = "CONTROL_RESUME_ACK";
export const EXIT_REQUEST   = "CONTROL_EXIT_REQUEST";
export const EXIT_ACK       = "CONTROL_EXIT_ACK";

export type StartGameMessage      = { type: typeof START };
export type CommittmentGameMessage = { type: typeof COMMITTMENT; content: { committment: string } };
export type RevealGameMessage     = { type: typeof REVEAL; content: { secret: string | number } };
export type PauseRequestMessage   = { type: typeof PAUSE_REQUEST };
export type PauseAckMessage       = { type: typeof PAUSE_ACK };
export type ResumeRequestMessage  = { type: typeof RESUME_REQUEST };
export type ResumeAckMessage      = { type: typeof RESUME_ACK };
export type ExitRequestMessage    = { type: typeof EXIT_REQUEST };
export type ExitAckMessage        = { type: typeof EXIT_ACK };

export type ControlMessage =
  | StartGameMessage | CommittmentGameMessage | RevealGameMessage
  | PauseRequestMessage | PauseAckMessage
  | ResumeRequestMessage | ResumeAckMessage
  | ExitRequestMessage | ExitAckMessage;

export type WireMessage = MoveMessage | ControlMessage;
export type WireMessageType = WireMessage["type"];
export type WireMessagePayload<T extends WireMessageType> =
  Extract<WireMessage, { type: T }> extends { content: infer C } ? C : undefined;

// ── Factory helpers ──────────────────────────────────────────────────────────

export const pickMessage    = (playerId: PlayerId, cardId: CardId): PickMessage    => ({ type: PICK, playerId, cardId });
export const placeMessage   = (playerId: PlayerId, x: number, y: number, direction: Direction): PlaceMessage => ({ type: PLACE, playerId, x, y, direction });
export const discardMessage = (playerId: PlayerId): DiscardMessage => ({ type: DISCARD, playerId });
export const startMessage           = (): StartGameMessage       => ({ type: START });
export const committmentMessage     = (committment: string)      => ({ type: COMMITTMENT, content: { committment } } as CommittmentGameMessage);
export const revealMessage          = (secret: string | number)  => ({ type: REVEAL, content: { secret } } as RevealGameMessage);
export const pauseRequestMessage    = (): PauseRequestMessage    => ({ type: PAUSE_REQUEST });
export const pauseAckMessage        = (): PauseAckMessage        => ({ type: PAUSE_ACK });
export const resumeRequestMessage   = (): ResumeRequestMessage   => ({ type: RESUME_REQUEST });
export const resumeAckMessage       = (): ResumeAckMessage       => ({ type: RESUME_ACK });
export const exitRequestMessage     = (): ExitRequestMessage     => ({ type: EXIT_REQUEST });
export const exitAckMessage         = (): ExitAckMessage         => ({ type: EXIT_ACK });
```

- [ ] **Step 3: Update ConnectionManager to use MoveMessage types**

Replace `sendMove(move: PlayerMoveMessage)` with three typed methods:

```ts
sendPick(playerId: PlayerId, cardId: CardId)   { this.send(pickMessage(playerId, cardId)); }
sendPlace(playerId: PlayerId, x: number, y: number, direction: Direction) { this.send(placeMessage(playerId, x, y, direction)); }
sendDiscard(playerId: PlayerId)                { this.send(discardMessage(playerId)); }

waitForPick()    { return this.waitFor(PICK); }
waitForPlace()   { return this.waitFor(PLACE); }
waitForDiscard() { return this.waitFor(DISCARD); }
```

- [ ] **Step 4: Update LobbyFlow to use new ConnectionManager methods**

In `game.flow.ts` — replace `connectionManager.sendMove(...)` with three separate calls for pick, place, discard events. Replace `connectionManager.waitForMove()` with three separate `await` calls:

```ts
// Sending (after local player picks):
session.events.on("pick:made", (e) => {
  if (e.player.id === localId) connectionManager.sendPick(e.player.id, e.cardId);
});
// ... etc for place, discard

// Receiving remote moves:
const move = await Promise.race([
  connectionManager.waitForPick().then(m => ({ kind: "pick" as const, m })),
  connectionManager.waitForPlace().then(m => ({ kind: "place" as const, m })),
  connectionManager.waitForDiscard().then(m => ({ kind: "discard" as const, m })),
]);
if (move.kind === "pick")    session.handlePick(move.m.playerId, move.m.cardId);
if (move.kind === "place")   session.handlePlacement(move.m.playerId, move.m.x, move.m.y, move.m.direction);
if (move.kind === "discard") session.handleDiscard(move.m.playerId);
```

- [ ] **Step 5: Run client tests — expect pass**

```bash
cd client && npm test 2>&1 | tail -15
```

- [ ] **Step 6: Commit**

```bash
git add client/src/game/state/
git commit -m "refactor: replace MOVE wire message with typed PickMessage/PlaceMessage/DiscardMessage

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 10: Trim LobbyFlow to Lobby-Only; Update store.ts

Simplify `LobbyFlow` so it only handles the lobby phase (connect, join, await start/leave). The engine's game loop now drives all round sequencing. Update `store.ts` to subscribe using the `GameEvent` union (without `player:joined`). Clean up `FlowAdapter` — remove pause/resume/phase management that is now engine-owned.

**Files:**
- Modify: `client/src/game/state/game.flow.ts`
- Modify: `client/src/App/store.ts`
- Modify: `client/src/game/state/game.flow.test.ts`

- [ ] **Step 1: Verify tests are green**

```bash
cd client && npm test 2>&1 | tail -5
```

- [ ] **Step 2: Slim down LobbyFlow**

The new `runFlow()` should be approximately:

```ts
private async runFlow(connection: IGameConnection, seedProvider?: SeedProvider) {
  const session = new GameSession({
    variant: this.variant,
    bonuses: this.bonuses,
    localPlayerId: connection.peerIdentifiers.me,
    seedProvider: seedProvider ?? new CommitmentSeedProvider(connection),
  });

  session.addPlayer(new Player(connection.peerIdentifiers.me));
  session.addPlayer(new Player(connection.peerIdentifiers.them));
  this.adapter.setSession(session);
  this.adapter.setPhase("lobby");

  // Wire pause/resume from UI adapter → session commands
  void this.adapter.awaitPause().then(() => session.pause());
  void this.adapter.awaitResume().then(() => session.resume());

  // Wire exit: send exit request to peer and reset
  void this.adapter.awaitLeave().then(async () => {
    this.connectionManager?.sendExitRequest();
    this.adapter.reset();
  });

  // Wire incoming control messages
  void this.listenForControlMessages(session, connection);

  const lobbyResult = await Promise.race([
    this.adapter.awaitStart().then(() => "start" as const),
    waitForEvent(session.events, "game:ended").then(() => "ended" as const),
  ]);

  if (lobbyResult === "ended") {
    this.adapter.setPhase("ended");
    return;
  }

  this.adapter.setPhase("game");
  session.startGame(); // engine drives all rounds

  // Relay local moves to peer via connection
  session.events.on("pick:made",   (e) => { if (e.player.id === connection.peerIdentifiers.me) this.connectionManager!.sendPick(e.player.id, e.cardId); });
  session.events.on("place:made",  (e) => { if (e.player.id === connection.peerIdentifiers.me) this.connectionManager!.sendPlace(e.player.id, e.x, e.y, e.direction); });
  session.events.on("discard:made",(e) => { if (e.player.id === connection.peerIdentifiers.me) this.connectionManager!.sendDiscard(e.player.id); });

  // Feed remote moves into engine
  void this.relayRemoteMoves(session, connection);

  await waitForEvent(session.events, "game:ended");
  this.adapter.setPhase("ended");
}

/** Receive loop: pull incoming move messages from the peer and push them into the engine. */
private async relayRemoteMoves(session: GameSession, connection: IGameConnection): Promise<void> {
  const remoteId = connection.peerIdentifiers.them;
  while (session.phase === "playing" || session.phase === "paused") {
    const msg = await this.connectionManager!.waitForNextMoveMessage();
    if (!msg) break; // connection closed
    if (msg.type === "pick")    session.handlePick(remoteId, msg.cardId);
    if (msg.type === "place")   session.handlePlacement(remoteId, msg.x, msg.y, msg.direction);
    if (msg.type === "discard") session.handleDiscard(remoteId);
  }
}
```

> **Note on `listenForControlMessages`:** The existing `listenForControlMessages()` complex method handled both control messages AND round coordination. After this task, a **simplified** `listenForControlMessages()` survives — containing only the exit/pause/resume receive loops (these are still needed). The round-sequencing logic inside the old version is deleted (the engine loop handles that now). The simplified version looks like:
> ```ts
> private async listenForControlMessages(session: GameSession, connection: IGameConnection): Promise<void> {
>   // Handle remote pause request
>   void this.connectionManager!.waitForPauseRequest().then(() => session.pause());
>   // Handle remote resume request
>   void this.connectionManager!.waitForResumeRequest().then(() => session.resume());
>   // Handle remote exit request
>   void this.connectionManager!.waitForExitRequest().then(() => this.adapter.reset());
> }
> ```

Remove: `playRound()`, `handleLocalPauseRequest()`, `handleLocalResumeRequest()`, and the **complex** body of `listenForControlMessages()` (replaced with the simplified version above). Also add `waitForNextMoveMessage()` to `ConnectionManager` — it should await the next `MoveMessage` from the peer's data channel (this is a thin wrapper over the existing receive infrastructure).


- [ ] **Step 3: Update store.ts**

Change `ALL_EVENTS` to use `GameEvent["type"]` values (remove `"player:joined"`):

```ts
import type { GameEvent } from "kingdomino-engine";

const ALL_EVENTS: ReadonlyArray<GameEvent["type"]> = [
  "game:started",
  "round:started",
  "pick:made",
  "place:made",
  "discard:made",
  "round:complete",
  "game:paused",
  "game:resumed",
  "game:ended",
];
```

Also update `GameEventMap` references to `GameEvent` in the import and type annotations.

- [ ] **Step 4: Update game.flow.test.ts**

Update tests to match the new LobbyFlow API — no more `shouldContinuePlaying` callback, no `createConnectionManager` override for seed exchange. Update tests that previously verified round sequencing via the flow to instead verify events from the session.

- [ ] **Step 5: Run all tests**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | tail -5
cd ../../packages/kingdomino-commitment && npm test 2>&1 | tail -5
cd ../../client && npm test 2>&1 | tail -10
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add client/src/ packages/
git commit -m "refactor: trim LobbyFlow to lobby-only; update store.ts for GameEvent union

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 11: Final Verification

Run all tests, check package boundaries, update docs.

**Files:**
- Modify: `README.md` (mark TODO as done)
- Modify: `docs/superpowers/README.md` (mark spec/plan status)

- [ ] **Step 1: Run all package tests**

```bash
cd packages/kingdomino-engine && npm test 2>&1 | tail -5
cd ../../packages/kingdomino-commitment && npm test 2>&1 | tail -5
cd ../../client && npm test 2>&1 | tail -10
```
Expected: all pass.

- [ ] **Step 2: Verify engine has no client imports**

```bash
grep -r "from.*client\|from.*App\|from.*game/state" packages/kingdomino-engine/src/ || echo "CLEAN"
```
Expected: `CLEAN`.

- [ ] **Step 3: Verify commitment has no client imports**

```bash
grep -r "from.*client\|from.*App" packages/kingdomino-commitment/src/ || echo "CLEAN"
```
Expected: `CLEAN` (engine imports are fine).

- [ ] **Step 4: Verify endGame() and beginRound() are not unintentionally public**

```bash
grep -n "^\s*public beginRound\|^\s*public endGame" packages/kingdomino-engine/src/GameSession.ts
```
Expected: no results (or only `beginRound` with `@internal` JSDoc comment if Option B was chosen in Task 6 — that is acceptable).

If Option B was chosen, also verify it has the `@internal` tag:
```bash
grep -B1 "beginRound(" packages/kingdomino-engine/src/GameSession.ts | grep "@internal"
```
Expected: one line with `@internal`.

- [ ] **Step 5: Mark TODO done in README**

In `README.md`, move item 6 from the `NEXT` section to `Current state` (or remove it from the TODO list).

- [ ] **Step 6: Run root lint**

```bash
cd /path/to/repo/root && npm run lint && npm run fmt:check
```
Expected: no errors.

- [ ] **Step 7: Final commit**

```bash
git add README.md docs/
git commit -m "docs: mark game engine package extraction as complete

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Test Command Reference

| Location | Command | What it runs |
|----------|---------|-------------|
| Engine package | `cd packages/kingdomino-engine && npm test` | Vitest unit tests for game logic + state |
| Commitment package | `cd packages/kingdomino-commitment && npm test` | Vitest unit tests for seed protocol |
| Client | `cd client && npm test` | Vitest unit + Storybook browser tests |

---

## Key Invariants to Maintain

- `packages/kingdomino-engine` imports nothing from `client/` or `packages/kingdomino-commitment`
- `packages/kingdomino-commitment` imports nothing from `client/`; may import from `kingdomino-engine`
- `Player` has no `isLocal` field anywhere
- `GameSession.beginRound()` is private (prefixed `_beginRound`), or `@internal` if Option B escape hatch was chosen in Task 6
- `GameSession.endGame()` is private (prefixed `_endGame`)
- `GameSession.startGame()` takes zero arguments
- `store.ts` `ALL_EVENTS` does not include `"player:joined"`
- All wire messages for player moves use `PickMessage | PlaceMessage | DiscardMessage`, not the old `MoveGameMessage`
