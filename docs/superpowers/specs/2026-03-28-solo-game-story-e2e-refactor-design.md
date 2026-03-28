# Design: Refactor SoloGameVisualTdd to Pure App/UI e2e Story

## Problem

`client/src/game/visuals/SoloGameVisualTdd.stories.tsx` is an integration/e2e
Storybook story that violates test-isolation principles:

1. **Session insider knowledge** — `LocalAutoDriver` calls `session.isMyTurn()`,
   `session.currentRound`, `session.handleLocalPick()`, `session.isMyPlace()`,
   `session.localCardToPlace()`, `session.myPlayer()`, `session.boardFor()`, and
   `session.handleLocalPlacement()`. These are internal `GameSession` API calls.

2. **Flow/store insider knowledge** — `SoloGameHarness` imports `LobbyFlow` (the
   game orchestration class) and calls `resetAppState()`, `triggerLobbyStart()`
   directly, bypassing the real Splash UI button.

3. **Artificial DOM node** — A `<p data-testid="game-ended-indicator">` is
   rendered _outside_ `<App />` purely to satisfy the test assertion. It has no
   connection to what the real app shows users.

The story should behave like a real user: click buttons, observe rendered output,
and assert on the app's own DOM — never touching session or flow internals.

## Proposed Changes

### 1. Wire the `GameEnded` room in `LobbyFlow` (`game.flow.ts`)

`LobbyFlow.runFlow()` currently calls `session.endGame()` but leaves the room as
`Game` forever. The `GameEnded` constant already exists in `AppExtras.ts` but is
never set by the flow.

**Change:** In `runFlow()`, immediately after `this.session.endGame()`, call
`setRoom(GameEnded)`:

```ts
if (getRoom() === Game) {
  this.session.endGame();
  setRoom(GameEnded);   // ← new
}
```

### 2. Render a game-over element in `App.tsx`

**Change:** Add a branch for the `GameEnded` room that renders a visible element
the test (and future players) can observe:

```tsx
{room === "GameEnded" && (
  <div data-testid="game-over">
    <h2>Game over</h2>
  </div>
)}
```

### 3. Add `data-testid="available-card"` to `Card.tsx`

The pick phase requires the test to find a clickable card without knowing which
card IDs are in the deal.

**Change:** Add `data-testid="available-card"` to the card `<div>` only when
`isMyTurn && isActive` (the card is genuinely pickable). Disabled cards get no
testid:

```tsx
<div
  className={className}
  data-testid={isMyTurn && isActive ? "available-card" : undefined}
  onClick={() => isMyTurn && isActive && session.handleLocalPick(id)}
>
```

### 4. Add `data-testid="valid-placement"` to `BoardArea.tsx`

The placement phase requires the test to find a valid board position without
knowing coordinates or card IDs.

**Change:** Thread a `data-testid` prop through `BoardSquare` and pass
`"valid-placement"` on tiles where `isMe && isMyPlace && isValidTile(x, y) &&
isValidDirection(x, y, direction)`:

```tsx
// BoardSquare updated signature:
function BoardSquare({
  handleClick,
  children,
  "data-testid": testId,
}: BoardSquareProps) {
  return <div onClick={handleClick} data-testid={testId}>{children}</div>;
}

// In the map:
<BoardSquare
  key={`${y},${x}`}
  handleClick={handleClick(x, y)}
  data-testid={
    isMe && isMyPlace && isValidTile(x, y) && isValidDirection(x, y, direction)
      ? "valid-placement"
      : undefined
  }
>
```

### 5. Rewrite `SoloGameVisualTdd.stories.tsx`

Replace the entire file with a story that:

- Uses `App` as the component — no wrapper, no harness
- Imports nothing from `game.flow`, `GameSession`, or game logic utilities
- Calls `resetAppState()` in `beforeEach` for story isolation (store-level
  housekeeping, not session knowledge)
- Drives the game in the `play()` function via `userEvent.click` and DOM queries:

```tsx
import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { App } from "../../App/App";
import { resetAppState } from "../../App/store";

const meta = {
  title: "Game/Solo AI Visual TDD",
  component: App,
  tags: ["autodocs"],
  beforeEach: resetAppState,
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

async function playSoloGameToEnd(
  canvas: ReturnType<typeof within>,
  timeout: number,
) {
  // 1. Start a solo game via the real Splash button
  await userEvent.click(canvas.getByRole("button", { name: /Start solo/i }));

  // 2. Confirm in the Lobby
  await userEvent.click(await canvas.findByRole("button", { name: /Start game/i }));

  // 3. Auto-play until the game ends.
  //    waitFor retries the entire callback until it passes or times out.
  //    Clicking inside waitFor is safe here because alien-signals state updates
  //    are synchronous — the DOM reflects the new state immediately after each
  //    click, so each retry sees a fresh, consistent snapshot.
  await waitFor(
    async () => {
      const card = canvas.queryAllByTestId("available-card")[0];
      if (card) await userEvent.click(card);

      const tile = canvas.queryAllByTestId("valid-placement")[0];
      if (tile) await userEvent.click(tile);

      await expect(canvas.getByTestId("game-over")).toBeVisible();
    },
    { timeout },
  );
}

// Both the former one-round and two-round stories are merged here.
// Without the old `roundLimit` harness arg the game always runs until the
// 48-card deck is exhausted (~12 rounds). A single story that asserts
// completion is equivalent to — and cleaner than — two stories that were
// behaviourally identical after the refactor.
export const SoloGamePlaysToCompletion: Story = {
  play: async ({ canvas }) => {
    await playSoloGameToEnd(canvas, 60000);
    await expect(canvas.getByText(/Kingdomino/i)).toBeVisible();
  },
};
```

**Note on `resetAppState` and `gameLobby.isRunning`:** `resetAppState()` resets
the store signals and resolver queues. `gameLobby.isRunning` is reset in
`LobbyFlow.runFlow`'s `finally` block once the game ends (including the new
`setRoom(GameEnded)` path). Consecutive story runs are therefore safe as long as
the previous story has played to completion — which `SoloGamePlaysToCompletion`
guarantees by waiting for `data-testid="game-over"` before returning.

## Constraints

- Do NOT import `GameSession`, `LobbyFlow`, `findPlacementWithin5x5`, or any
  game logic from the story file.
- Do NOT call `session.xxx()` methods from the story.
- `resetAppState()` is the only store import permitted (it is app-level cleanup,
  not session-level).
- The `<App />` component must be the sole rendered component (no wrapper
  harness).

## Files Changed

| File | Change type |
|------|-------------|
| `client/src/game/state/game.flow.ts` | Small addition: `setRoom(GameEnded)` |
| `client/src/App/App.tsx` | Small addition: render `game-over` for GameEnded room |
| `client/src/game/visuals/Card.tsx` | Small addition: `data-testid` on available card |
| `client/src/game/visuals/BoardArea.tsx` | Small change: thread `data-testid` through BoardSquare |
| `client/src/game/visuals/SoloGameVisualTdd.stories.tsx` | Full rewrite (two stories merged into `SoloGamePlaysToCompletion`) |

## Testing

- Story tests in `SoloGameVisualTdd.stories.tsx` must pass.
- Existing story tests in `PlayRulesVisualTdd.stories.tsx`, `SetupRulesVisualTdd.stories.tsx`,
  `ScoringRulesVisualTdd.stories.tsx` must remain green.
- `client/src/game/state/game.flow.test.ts` must remain green (the new
  `setRoom(GameEnded)` call is already guarded by the existing `if (getRoom() === Game)` check).
- Run all client tests with `cd client && npm test`.
