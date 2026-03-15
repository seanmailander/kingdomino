# `src/game` Overview

This directory contains all game-specific code for Kingdomino. It is organized to keep **rules**, **state**, and **visual rendering** separate so features can be changed safely and tested independently.

## Goals

- Keep game rules deterministic and UI-agnostic.
- Keep state transitions centralized and predictable.
- Keep visual components focused on rendering and input handling.

---

## Recommended Layout

```text
src/game/
	logic/            # Pure game rules and domain logic
	state/           # Game state model, reducers/actions/selectors
	visuals/              # React components and visual presentation
```

If your current folder names differ, keep the same architectural boundaries.

---

## Isolation Boundaries

### 1) Game Logic (`logic/`)

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
- State layer may call `logic/` logic, but should not depend on UI.
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
visuals -> state -> logic
```

- `logic` depends on nothing above it.
- `state` can depend on `logic`.
- `visuals` can depend on both `state` and `logic` types, but not reimplement logic.

Avoid reverse dependencies (e.g., `logic` importing from `visuals`).

---

## Testing Strategy

- **logic:** exhaustive unit tests for rule correctness.
- **state:** reducer/state-machine transition tests.
- **visuals:** component interaction/rendering tests with mocked state.

Most game correctness should be proven in `logic` and `state`, not in visuals tests.

---

## Practical Guidelines

- Add new rules in `logic` first.
- Expose rule outcomes through `state` transitions/selectors.
- Render outcomes in `visuals` without embedding rule math.
- Keep side effects (timers, network, persistence) in orchestration layers, not `logic`.

This structure preserves clear ownership: **logic decides**, **state records**, **visuals display**.
