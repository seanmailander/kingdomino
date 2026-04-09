# Scoped GameStore Design

**Date:** 2026-04-09  
**Status:** Draft  
**Problem:** Story tests are non-deterministic because module-level singleton state in `store.ts` leaks between stories. Async flows from previous stories race with new story setup on shared signals and resolver arrays.

---

## Root Cause

`store.ts` holds all app state (signals, promise resolver queues, event subscriptions) at **module scope**. Every consumer — production App, Storybook stories, test harnesses — shares the same mutable state. When a story unmounts, async flows (`LobbyFlow.runFlowWithFactory()`) are still in-flight, writing to the same signals the next story reads.

Cleanup functions (`resetAppState()`) attempt to drain resolver queues by resolving pending promises, which triggers `.then()` chains in old flows that compete with new story setup. The fundamental problem: **state lifetime is tied to the JS module, not to any logical owner.**

## Design Principle

**Isolation by unreachability, not by cleanup.**

Replace module-level singleton state with instance-scoped state owned by the React component tree. When a component tree unmounts, its state instance becomes unreachable — old async flows can keep writing to it harmlessly since no subscribers exist. No cleanup functions, no cancellation tokens, no promise rejection needed.

## Architecture

### GameStore class

A plain class (no React dependency) holding everything currently at module scope:

- **Signals:** `session`, `room`, `version`, `gameOverScores` (alien-signals)
- **Resolver queues:** `lobbyStart`, `lobbyLeave`, `pause`, `resume`, `exitConfirm`
- **Methods:** `setSession()`, `setRoom()`, `bumpVersion()`, `awaitLobbyStart()`, `triggerLobbyStart()`, etc. — same API as today's exported functions, but instance methods
- **`dispose()`:** Unsubscribes session events, clears references. Nice-to-have for faster GC, not a correctness requirement.

`resetAppState()` is **eliminated**. There is no equivalent.

### React Context

```
GameStoreProvider ──creates──▸ GameStore instance
        │
   React Context
        │
   useGameStore() ──returns──▸ GameStore
   useApp()       ──reads──▸  session, room, hint (backed by context)
```

- `GameStoreProvider` creates a `GameStore` on mount (or accepts one via prop), disposes on unmount.
- Production `main.tsx` wraps `<App />` in `<GameStoreProvider>`.
- Stories wrap in `<GameStoreProvider>` via decorators or harness components — each story gets a fresh instance.

### AppFlowAdapter receives GameStore

Constructor injection replaces module imports:

```ts
class AppFlowAdapter implements FlowAdapter {
  constructor(private readonly store: GameStore) {}
  // Methods delegate to store instance
}
```

### Flow creation moves into the component tree

`gameLobby.ts` (the singleton factory) is **deleted**. `App.tsx` creates the flow where the store is available:

```
App (reads store from context)
  └─ useMemo: new AppFlowAdapter(store) → new LobbyFlow({ adapter, rosterFactory })
```

### Story isolation

**RealGameRuleHarness:** Wraps its tree in `<GameStoreProvider>`. No cleanup code — unmount = isolation.

**SoloGameVisualTdd:** Decorator wraps each story in `<GameStoreProvider>`. `beforeEach: resetAppState()` is removed.

Old flows that outlive their story write to a disconnected `GameStore` instance — harmless, GC'd when the promise chain completes.

## Scope

### Changed files

| File | Change |
|------|--------|
| `store.ts` | Extract into `GameStore` class. Export `GameStoreProvider`, `useGameStore()`, `useApp()`. Remove module-level state and `resetAppState()`. |
| `AppFlowAdapter.ts` | Constructor takes `GameStore`. |
| `gameLobby.ts` | **Delete.** |
| `App.tsx` | Create flow from context-provided store. Remove trigger/reset imports. |
| `Game.tsx` | Trigger functions from `useGameStore()`. |
| `Card.tsx`, `BoardArea.tsx` | No change — `useApp()` API unchanged. |
| `main.tsx` | Wrap `<App />` in `<GameStoreProvider>`. |
| `GameRulesVisualTdd.shared.tsx` | Wrap harness in `<GameStoreProvider>`. Remove cleanup code. |
| `SoloGameVisualTdd.stories.tsx` | Decorator provides `<GameStoreProvider>`. Remove `beforeEach`. |
| `docs/ARCHITECTURE.md` | Add state ownership guidance. |

### Not in scope

- AI determinism (`Math.random()` in `AIPlayerActor`) — separate concern, separate change.
- All game logic (`gamelogic/`), game state classes, `LobbyFlow`, `FlowAdapter` interface, unit tests — untouched.

## Acceptance Criteria

1. `npm test` in `packages/client` passes — all unit and storybook tests green.
2. `store.ts` has no module-level mutable state (no `let` declarations at file scope).
3. `resetAppState()` does not exist.
4. Running storybook tests 5 times in sequence produces consistent results.
5. `ARCHITECTURE.md` documents the state ownership principle.
