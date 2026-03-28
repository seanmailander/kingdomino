# `src/game` Overview

This directory contains all game-specific code for Kingdomino. It is organized to keep **rules**, **state**, and **visual rendering** separate so features can be changed safely and tested independently.

## Goals

- Keep game rules deterministic and UI-agnostic.
- Keep state transitions centralized and predictable.
- Keep visual components focused on rendering and input handling.

---

## Actual Layout

```text
src/game/
  gamelogic/   # Pure game rules and domain logic (note: not "logic/")
  state/       # Game state model: GameSession, Player, Board, Round, Deal
  visuals/     # React components, Storybook stories, CSS
  tests/       # Integration and unit tests
```

---

## Isolation Boundaries

### 1) Game Logic (`gamelogic/`)

Contains pure, side-effect-free functions for:

- tile placement validation
- scoring rules
- turn legality
- end-of-game conditions

**Rules:**

- No React imports.
- No direct network/storage access.
- Input and output should be plain data structures.

This makes logic easy to unit test and reusable across UI implementations.

### 2) Game State (`state/`)

Contains canonical game state and transitions:

- state types/interfaces
- actions/events
- reducers/state machines
- selectors/derived values

**Rules:**

- State updates should be driven by events/signals.
- State layer may call `gamelogic/` logic, but should not depend on UI.
- Derived values should be computed in domain language, not display components.

This keeps behavior predictable and debugging straightforward.

### 3) Visuals (`visuals/`)

Contains rendering and interaction:

- board/hand/kingdom components
- animations and transitions
- click/drag/hover handlers

**Rules:**

- UI reads from game state directly.
- UI dispatches events; it does not implement rules.
- Prefer presentational components that receive prepared props.

This keeps components simple and avoids logic duplication.

---

## Dependency Direction

Use one-way dependencies:

```text
visuals -> state -> gamelogic
```

- `gamelogic` depends on nothing above it.
- `state` can depend on `gamelogic`.
- `visuals` can depend on both `state` and `gamelogic` types, but not reimplement logic.

Avoid reverse dependencies (e.g., `gamelogic` importing from `visuals`).

---

## GameEventMap — Event Payloads

All game events are typed in `GameEventMap` (exported from `state/GameSession.ts`).
Subscribe via `session.events.on(event, handler)`.

```typescript
export type GameEventMap = {
  "player:joined":  { player: Player };
  "game:started":   { players: ReadonlyArray<Player>; pickOrder: ReadonlyArray<Player> };
  "round:started":  { round: Round };
  "pick:made":      { player: Player; cardId: CardId };
  "place:made":     { player: Player; cardId: CardId; x: number; y: number; direction: Direction };
  "discard:made":   { player: Player; cardId: CardId };
  "round:complete": { nextPickOrder: ReadonlyArray<Player> };
  "game:ended": {
    scores: Array<{
      player: Player;
      score: number;                              // total = base + bonuses
      bonuses: { middleKingdom: number; harmony: number };
    }>;
    // scores is pre-sorted: score DESC → player.board.largestPropertySize() DESC → player.board.totalCrowns() DESC
  };
};
```

### Key Player / Board methods used at game-end

| Method | Returns | Notes |
|--------|---------|-------|
| `player.id` | `string` | Display name / unique ID |
| `player.isLocal` | `boolean` | True for the local player |
| `player.board.score()` | `number` | BFS terrain-region scoring |
| `player.board.largestPropertySize()` | `number` | Tiebreaker #1: largest contiguous region |
| `player.board.totalCrowns()` | `number` | Tiebreaker #2: sum of all crowns |
| `player.board.isCastleCentered()` | `boolean` | Used for Middle Kingdom bonus |

---

## Testing Strategy

- **gamelogic:** exhaustive unit tests for rule correctness.
- **state:** reducer/state-machine transition tests.
- **visuals:** component interaction/rendering tests with mocked state.

Most game correctness should be proven in `gamelogic` and `state`, not in visuals tests.

---

## Practical Guidelines

- Add new rules in `gamelogic` first.
- Expose rule outcomes through `state` transitions/selectors.
- Render outcomes in `visuals` without embedding rule math.
- Keep side effects (timers, network, persistence) in orchestration layers, not `gamelogic`.

This structure preserves clear ownership: **logic decides**, **state records**, **visuals display**.
