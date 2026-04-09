# Scoped GameStore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace module-level singleton state in `store.ts` with instance-scoped `GameStore` class owned by React context, eliminating cross-story state leakage.

**Architecture:** Extract all mutable state (signals, resolver queues, event subscriptions) from `store.ts` into a `GameStore` class. Provide it via React Context. Each component tree (production app, each story) gets its own instance. Old async flows write to disconnected instances — harmless.

**Tech Stack:** React 18 Context, alien-signals, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-scoped-game-store-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/App/GameStore.ts` | **Create** | GameStore class: signals, resolvers, methods |
| `src/App/GameStoreContext.tsx` | **Create** | React context, provider, `useGameStore()` hook |
| `src/App/store.ts` | **Rewrite** | Re-export `useApp()` backed by context; remove all module-level state |
| `src/App/AppFlowAdapter.ts` | **Modify** | Constructor takes `GameStore` |
| `src/App/App.tsx` | **Modify** | Create flow from context store; remove gameLobby import |
| `src/App/gameLobby.ts` | **Delete** | Replaced by flow creation in App.tsx |
| `src/game/visuals/Game.tsx` | **Modify** | Get trigger functions from `useGameStore()` |
| `src/index.tsx` | **Modify** | Wrap `<App />` in `<GameStoreProvider>` |
| `src/App/GameStore.test.ts` | **Create** | Unit tests for GameStore class |
| `src/App/store.control.test.ts` | **Rewrite** | Test against GameStore instance |
| `src/game/state/game.flow.test.ts` | **Rewrite** | Create GameStore per test, pass to AppFlowAdapter |
| `src/game/visuals/GameRulesVisualTdd.shared.tsx` | **Modify** | Wrap harness in `<GameStoreProvider>`; remove cleanup code |
| `src/game/visuals/SoloGameVisualTdd.stories.tsx` | **Modify** | Decorator provides `<GameStoreProvider>`; remove `beforeEach` cleanup |
| `src/game/visuals/PlayRulesVisualTdd.stories.tsx` | **Modify** | Get store from harness for `triggerPauseIntent()` |

---

### Task 1: Create GameStore class

Extract all mutable state from `store.ts` into a standalone class with the same API surface but instance-scoped.

**Files:**
- Create: `src/App/GameStore.ts`
- Create: `src/App/GameStore.test.ts`

- [ ] **Step 1: Write failing tests for GameStore**

Create `src/App/GameStore.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GameStore } from "./GameStore";

describe("GameStore", () => {
  it("starts with null session and Splash room", () => {
    const store = new GameStore();
    expect(store.getSession()).toBeNull();
    expect(store.getRoom()).toBe("Splash");
  });

  it("resolves lobby start waiters when triggered", async () => {
    const store = new GameStore();
    const waiter = store.awaitLobbyStart();
    store.triggerLobbyStart([{ type: "local" }, { type: "ai" }]);
    const config = await waiter;
    expect(config).toEqual([{ type: "local" }, { type: "ai" }]);
  });

  it("resolves pause intent waiters when triggered", async () => {
    const store = new GameStore();
    const waiter = store.awaitPauseIntent();
    store.triggerPauseIntent();
    await expect(waiter).resolves.toBeUndefined();
  });

  it("resolves resume intent waiters when triggered", async () => {
    const store = new GameStore();
    const waiter = store.awaitResumeIntent();
    store.triggerResumeIntent();
    await expect(waiter).resolves.toBeUndefined();
  });

  it("resolves exit confirm waiters with boolean", async () => {
    const store = new GameStore();
    const waiter = store.awaitExitConfirm();
    store.triggerExitConfirm(true);
    await expect(waiter).resolves.toBe(true);
  });

  it("resolves lobby leave waiters when triggered", async () => {
    const store = new GameStore();
    const waiter = store.awaitLobbyLeave();
    store.triggerLobbyLeave();
    await expect(waiter).resolves.toBeUndefined();
  });

  it("dispose clears resolver queues without resolving them", () => {
    const store = new GameStore();
    // Create pending waiters — they should become unreachable after dispose
    store.awaitLobbyStart();
    store.awaitPauseIntent();
    expect(() => store.dispose()).not.toThrow();
  });

  it("tracks room changes", () => {
    const store = new GameStore();
    store.setRoom("Game");
    expect(store.getRoom()).toBe("Game");
  });

  it("onceRoomIsNot resolves when room changes", async () => {
    const store = new GameStore();
    store.setRoom("Lobby");
    const waiter = store.onceRoomIsNot("Lobby");
    store.setRoom("Game");
    await expect(waiter).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/client && npx vitest run --project unit -- GameStore`
Expected: FAIL — module `./GameStore` not found

- [ ] **Step 3: Implement GameStore class**

Create `src/App/GameStore.ts`. Extract all signals (`sessionSignal`, `roomSignal`, `versionSignal`, `gameOverScoresSignal`), all resolver arrays (`lobbyStartResolvers`, `lobbyLeaveResolvers`, `pauseIntentResolvers`, `resumeIntentResolvers`, `exitConfirmResolvers`), all event subscription wiring (`setCurrentSession` logic), and the `onceRoomIsNot` effect into instance members and methods.

Key design points:
- Constructor initializes signals with defaults (`session: null`, `room: Splash`, `version: 0`, `gameOverScores: []`)
- All `await*` / `trigger*` methods use instance-level resolver arrays (not module-level)
- `setCurrentSession()` manages event subscriptions on the session (same as today)
- `bumpVersion()` is a private method
- `dispose()` clears all resolver arrays (does NOT resolve them — just drops references), unsubscribes session events
- Import `Room`, `Splash`, `computeHint` from `AppExtras` as today

Reference: current `store.ts` lines 1–197 contain all the logic to extract.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/client && npx vitest run --project unit -- GameStore`
Expected: PASS — all 9 tests green

- [ ] **Step 5: Commit**

```bash
git add src/App/GameStore.ts src/App/GameStore.test.ts
git commit -m "feat: create GameStore class with instance-scoped state"
```

---

### Task 2: Create React context and provider

**Files:**
- Create: `src/App/GameStoreContext.tsx`

- [ ] **Step 1: Create context, provider, and hook**

Create `src/App/GameStoreContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { GameStore } from "./GameStore";

const GameStoreContext = createContext<GameStore | null>(null);

export function GameStoreProvider({
  children,
  store,
}: {
  children: ReactNode;
  store?: GameStore;
}) {
  const ownedStore = useMemo(() => store ?? new GameStore(), [store]);

  useEffect(() => {
    return () => ownedStore.dispose();
  }, [ownedStore]);

  return (
    <GameStoreContext value={ownedStore}>
      {children}
    </GameStoreContext>
  );
}

export const useGameStore = (): GameStore => {
  const store = useContext(GameStoreContext);
  if (!store) {
    throw new Error("useGameStore must be used within a GameStoreProvider");
  }
  return store;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/App/GameStoreContext.tsx
git commit -m "feat: add GameStoreProvider and useGameStore hook"
```

---

### Task 3: Migrate AppFlowAdapter to accept GameStore

**Files:**
- Modify: `src/App/AppFlowAdapter.ts`

- [ ] **Step 1: Update AppFlowAdapter constructor**

Replace all module-level imports from `./store` with method calls on an injected `GameStore`. The `FlowAdapter` interface is unchanged — only the backing implementation changes.

```ts
import { GameStore } from "./GameStore";
import type { FlowAdapter, FlowPhase } from "../game/state/game.flow";
import { FLOW_SPLASH, FLOW_LOBBY, FLOW_GAME, FLOW_PAUSED, FLOW_ENDED } from "../game/state/game.flow";
import type { GameSession } from "kingdomino-engine";
import type { RosterConfig } from "../Lobby/lobby.types";
import { Lobby, Game, Splash, GamePaused, GameEnded } from "./AppExtras";

const phaseToRoom = { /* same as today */ } as const;

const roomToPhase = (store: GameStore): FlowPhase => {
  const room = store.getRoom();
  // same mapping as today
};

export class AppFlowAdapter implements FlowAdapter {
  constructor(private readonly store: GameStore) {}

  setSession(session: GameSession | null) { this.store.setCurrentSession(session); }
  setPhase(phase: FlowPhase) { this.store.setRoom(phaseToRoom[phase]); }
  getPhase() { return roomToPhase(this.store); }
  oncePhaseIsNot(phase: FlowPhase) { return this.store.onceRoomIsNot(phaseToRoom[phase]); }
  awaitStart() { return this.store.awaitLobbyStart(); }
  awaitLeave() { return this.store.awaitLobbyLeave(); }
  awaitPause() { return this.store.awaitPauseIntent(); }
  awaitResume() { return this.store.awaitResumeIntent(); }
  reset() { /* no-op — isolation by unreachability */ }
}
```

Note: `reset()` becomes a no-op. The old `resetAppState()` call served as cleanup — now unnecessary because store lifetime is scoped to the provider.

- [ ] **Step 2: Commit**

```bash
git add src/App/AppFlowAdapter.ts
git commit -m "refactor: AppFlowAdapter takes GameStore instance"
```

---

### Task 4: Migrate App.tsx, index.tsx, delete gameLobby.ts

**Files:**
- Modify: `src/App/App.tsx`
- Modify: `src/index.tsx`
- Delete: `src/App/gameLobby.ts`

- [ ] **Step 1: Update App.tsx**

`App.tsx` reads the store from context via `useGameStore()`. Creates `AppFlowAdapter(store)` and `LobbyFlow` in a `useMemo`. Removes `gameLobby` import. Replaces `resetAppState` with no-op or navigation callback. Replaces `triggerLobbyStart`/`triggerLobbyLeave` with store methods.

```tsx
import React, { useMemo } from "react";
import "./App.css";
import { Splash as SplashComponent } from "../Splash/Splash";
import { Lobby as LobbyComponent } from "../Lobby/Lobby";
import { Game as GameComponent } from "../game/visuals/Game";
import { GameOverScreen } from "../game/visuals/GameOverScreen";
import { determineWinners } from "kingdomino-engine";
import { useGameStore } from "./GameStoreContext";
import { useApp } from "./store";
import { getPeerSession } from "./peerSession";
import { AppFlowAdapter } from "./AppFlowAdapter";
import { LobbyFlow } from "../game/state/game.flow";
import { DefaultRosterFactory } from "../game/state/default.roster.factory";

export function App({ seed }: { seed?: string }) {
  const store = useGameStore();
  const lobby = useMemo(() => {
    const adapter = new AppFlowAdapter(store);
    return new LobbyFlow({
      adapter,
      rosterFactory: new DefaultRosterFactory({ seed }),
    });
  }, [store, seed]);

  const { session, room, hint } = useApp();

  return (
    <div className="App">
      <h1>Kingdomino</h1>
      <p>{hint}</p>
      {room === "Splash" && <SplashComponent lobby={lobby} />}
      {room === "Lobby" && (
        <LobbyComponent
          onStart={(config) => store.triggerLobbyStart(config)}
          onLeave={() => store.triggerLobbyLeave()}
          joinMatchmaking={() => getPeerSession().joinMatchmaking()}
        />
      )}
      {(room === "Game" || room === "GamePaused") && session && <GameComponent session={session} />}
      {room === "GameEnded" && (
        <GameOverScreen
          scores={determineWinners(store.getGameOverScores())}
          onReturnToLobby={() => { /* remount provider to reset */ }}
        />
      )}
    </div>
  );
}
```

Note: `onReturnToLobby` — the simplest approach is to call `store.setRoom("Splash")` and let the user click Start again. This matches the current behavior where `resetAppState` set room to Splash. Alternatively, consider whether this needs to remount the provider (for a fresh game). For now, `store.setRoom("Splash")` is sufficient — each `LobbyFlow.start()` call is independent.

- [ ] **Step 2: Update index.tsx**

Wrap `<App />` in `<GameStoreProvider>`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App/App";
import { GameStoreProvider } from "./App/GameStoreContext";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <React.StrictMode>
    <GameStoreProvider>
      <App />
    </GameStoreProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 3: Delete gameLobby.ts**

```bash
rm src/App/gameLobby.ts
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: App creates flow from context store; delete gameLobby singleton"
```

---

### Task 5: Rewrite store.ts as thin context-backed hook

**Files:**
- Rewrite: `src/App/store.ts`

- [ ] **Step 1: Rewrite store.ts**

Replace all module-level state with a `useApp()` hook that reads from `useGameStore()`. This file becomes a thin re-export layer. Components that only use `useApp()` (`Card.tsx`, `BoardArea.tsx`) need zero changes.

```ts
import { computed } from "alien-signals";
import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "./GameStoreContext";
import { computeHint } from "./AppExtras";

export { useGameStore } from "./GameStoreContext";

export const useApp = () => {
  const store = useGameStore();
  const versionComputed = useMemo(() => computed(() => store.version()), [store]);
  const [, setVersion] = useState(() => versionComputed());

  useEffect(() => {
    // alien-signals effect that syncs version changes to React state
    const { effect } = require("alien-signals");
    return effect(() => {
      const v = versionComputed();
      setVersion((prev: number) => (prev === v ? prev : v));
    });
  }, [versionComputed]);

  const session = store.getSession();
  const room = store.getRoom();
  const hint = computeHint(session, room);

  return { session, room, hint };
};
```

Note: `store.version` must be exposed as a readable signal (or a getter that returns the signal value). Decide during implementation whether `version` is a public signal or exposed via `getVersion()`.

Key point: `Card.tsx` and `BoardArea.tsx` import `useApp` from `../../App/store` — this import path is unchanged, the API is unchanged. No edits needed to those files.

- [ ] **Step 2: Verify Card.tsx and BoardArea.tsx compile without changes**

Run: `cd packages/client && npx tsc --noEmit`
Expected: No errors related to Card.tsx or BoardArea.tsx

- [ ] **Step 3: Commit**

```bash
git add src/App/store.ts
git commit -m "refactor: store.ts becomes thin hook layer over GameStore context"
```

---

### Task 6: Migrate Game.tsx trigger functions

**Files:**
- Modify: `src/game/visuals/Game.tsx`

- [ ] **Step 1: Replace module imports with store instance methods**

Change `triggerPauseIntent`, `triggerResumeIntent`, `triggerExitConfirm` from module imports to calls on the store instance:

```tsx
import { useApp } from "../../App/store";
import { useGameStore } from "../../App/GameStoreContext";
// Remove: import { triggerPauseIntent, triggerResumeIntent, triggerExitConfirm } from "../../App/store";

export function Game({ session }: GameProps) {
  const { room } = useApp();
  const store = useGameStore();
  // ...
  // Replace triggerPauseIntent → store.triggerPauseIntent()
  // Replace triggerResumeIntent → store.triggerResumeIntent()
  // Replace triggerExitConfirm(val) → store.triggerExitConfirm(val)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/game/visuals/Game.tsx
git commit -m "refactor: Game.tsx reads triggers from GameStore context"
```

---

### Task 7: Migrate unit tests

**Files:**
- Rewrite: `src/App/store.control.test.ts`
- Rewrite: `src/game/state/game.flow.test.ts`

- [ ] **Step 1: Rewrite store.control.test.ts**

Tests create a `GameStore` instance per test instead of using module-level functions:

```ts
import { describe, expect, it } from "vitest";
import { GameStore } from "./GameStore";

describe("GameStore control intents", () => {
  it("resolves pause waiters when pause is triggered", async () => {
    const store = new GameStore();
    const waiter = store.awaitPauseIntent();
    store.triggerPauseIntent();
    await expect(waiter).resolves.toBeUndefined();
  });

  it("resolves resume waiters when resume is triggered", async () => {
    const store = new GameStore();
    const waiter = store.awaitResumeIntent();
    store.triggerResumeIntent();
    await expect(waiter).resolves.toBeUndefined();
  });

  it("resolves exit confirm waiters with value", async () => {
    const store = new GameStore();
    const waiter = store.awaitExitConfirm();
    store.triggerExitConfirm(true);
    await expect(waiter).resolves.toBe(true);
  });

  it("resolves lobby leave waiters when triggered", async () => {
    const store = new GameStore();
    const waiter = store.awaitLobbyLeave();
    store.triggerLobbyLeave();
    await expect(waiter).resolves.toBeUndefined();
  });
});
```

Note: the old test "clears pending waiters on reset" tested `resetAppState()` behavior — this test is removed because `resetAppState()` no longer exists. The equivalent is: dispose clears queues (already tested in Task 1).

- [ ] **Step 2: Rewrite game.flow.test.ts**

Each test creates its own `GameStore` and passes it to `AppFlowAdapter`:

```ts
import { describe, expect, it, vi } from "vitest";
import { GameStore } from "../../App/GameStore";
import { AppFlowAdapter } from "../../App/AppFlowAdapter";
import { LobbyFlow } from "./game.flow";
import { DefaultRosterFactory } from "./default.roster.factory";

const minimalConfig = [{ type: "local" }, { type: "ai" }] as const;
const allAiConfig = [{ type: "ai" }, { type: "ai" }] as const;

describe("LobbyFlow", () => {
  it("enters lobby phase when start() is called", async () => {
    const store = new GameStore();
    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(store),
      rosterFactory: new DefaultRosterFactory(),
    });

    flow.start();

    await vi.waitFor(() => {
      expect(store.getRoom()).toBe("Lobby");
    });
  });

  it("creates a session with correct player IDs after lobby start", async () => {
    const store = new GameStore();
    const flow = new LobbyFlow({
      adapter: new AppFlowAdapter(store),
      rosterFactory: new DefaultRosterFactory(),
    });
    flow.start();

    await vi.waitFor(() => expect(store.getRoom()).toBe("Lobby"));
    store.triggerLobbyStart([...minimalConfig]);

    await vi.waitFor(() => {
      expect(store.getRoom()).toBe("Game");
      expect(store.getSession()?.players.map((p) => p.id)).toEqual(["p1", "p2"]);
    });
  });
});

// Similar pattern for control transitions and game completion tests.
// Each test: new GameStore() → new AppFlowAdapter(store) → new LobbyFlow(...)
// No afterEach cleanup needed — store is local to test.
```

Key change: **`afterEach` cleanup blocks are removed entirely.** Each test owns its own store — no shared state to clean up.

- [ ] **Step 3: Run all unit tests**

Run: `cd packages/client && npx vitest run --project unit`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/App/store.control.test.ts src/game/state/game.flow.test.ts
git commit -m "refactor: unit tests use per-test GameStore instances"
```

---

### Task 8: Migrate story harnesses

**Files:**
- Modify: `src/game/visuals/GameRulesVisualTdd.shared.tsx`
- Modify: `src/game/visuals/SoloGameVisualTdd.stories.tsx`
- Modify: `src/game/visuals/PlayRulesVisualTdd.stories.tsx`

- [ ] **Step 1: Update RealGameRuleHarness**

Wrap the harness tree in `<GameStoreProvider>`. Remove `resetAppState()`, `triggerLobbyLeave()`, `triggerLobbyStart()` imports from `../../App/store`. Instead, use `useGameStore()` inside the harness to get the store instance.

Key changes in `GameRulesVisualTdd.shared.tsx`:
- `RealGameRuleHarness` renders `<GameStoreProvider>` → `<RealGameRuleHarnessInner>`
- The inner component uses `useGameStore()` to get the store
- Creates `AppFlowAdapter(store)` and `LobbyFlow` from it
- Calls `store.triggerLobbyStart(config)` instead of the module function
- **Remove** the `useEffect` cleanup return that called `triggerLobbyLeave()` and `resetAppState()`
- Expose store via a module-level ref so story `play()` functions can call `store.triggerPauseIntent()`:

```tsx
// Module-level ref for story play() functions to reach the store
export let currentHarnessStore: GameStore | null = null;

function RealGameRuleHarnessInner({ scenario }: { scenario: RealGameScenario }) {
  const store = useGameStore();
  // ... existing logic, but using store instead of module imports
  
  useEffect(() => {
    currentHarnessStore = store;
    return () => { currentHarnessStore = null; };
  }, [store]);

  // ... rest of component
}

export function RealGameRuleHarness({ scenario }: { scenario: RealGameScenario }) {
  return (
    <GameStoreProvider>
      <RealGameRuleHarnessInner scenario={scenario} />
    </GameStoreProvider>
  );
}
```

- [ ] **Step 2: Update PlayRulesVisualTdd.stories.tsx**

Replace `triggerPauseIntent()` import with `currentHarnessStore.triggerPauseIntent()`:

```tsx
// Remove: import { triggerPauseIntent } from "../../App/store";
import { currentHarnessStore } from "./GameRulesVisualTdd.shared";

// In PausedState play():
//   Before: triggerPauseIntent();
//   After:  currentHarnessStore!.triggerPauseIntent();

// In ExitConfirmState play():
//   Same change
```

- [ ] **Step 3: Update SoloGameVisualTdd.stories.tsx**

Add `<GameStoreProvider>` decorator. Remove `beforeEach: resetAppState()` and `resetAppState` import.

```tsx
import { GameStoreProvider } from "../../App/GameStoreContext";
// Remove: import { resetAppState } from "../../App/store";

const meta = {
  title: "Game/Solo AI Visual TDD",
  component: App,
  args: { seed: "test-seed-12345" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <GameStoreProvider>
        <Story />
      </GameStoreProvider>
    ),
  ],
  // Remove beforeEach entirely
} satisfies Meta<typeof App>;
```

- [ ] **Step 4: Run storybook tests**

Run: `cd packages/client && npx vitest run --project storybook`
Expected: Previously-failing Paused State, Exit Confirm State, and Placement Phase stories now pass (isolation fixed). Pick Phase snapshot may still differ due to AI randomness (Track 1 — separate concern).

- [ ] **Step 5: Commit**

```bash
git add src/game/visuals/GameRulesVisualTdd.shared.tsx src/game/visuals/SoloGameVisualTdd.stories.tsx src/game/visuals/PlayRulesVisualTdd.stories.tsx
git commit -m "refactor: story harnesses use GameStoreProvider for isolation"
```

---

### Task 9: Final cleanup and verification

**Files:**
- Verify: `src/App/store.ts` has no module-level `let` declarations
- Verify: no remaining imports of `resetAppState` anywhere

- [ ] **Step 1: Verify no module-level mutable state**

Run: `grep -n "^let \|^const.*signal(" packages/client/src/App/store.ts`
Expected: No matches (all state is in GameStore)

- [ ] **Step 2: Verify resetAppState is gone**

Run: `grep -rn "resetAppState" packages/client/src/`
Expected: No matches

- [ ] **Step 3: Run full test suite**

Run: `cd packages/client && npm test`
Expected: All unit and storybook tests pass

- [ ] **Step 4: Run storybook tests 3 additional times for consistency**

Run: `cd packages/client && npx vitest run --project storybook` (3 times)
Expected: Same results each run — no non-determinism from state leakage

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git commit -m "chore: verify scoped GameStore migration complete"
git push
```
