# Solo Game Story E2E Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `SoloGameVisualTdd.stories.tsx`'s session/flow-internal harness with a pure `<App />`-rendered e2e story that drives the full solo game via `userEvent.click` and `data-testid` locators.

**Architecture:** Wire `setRoom(GameEnded)` into `LobbyFlow` so the app surfaces a real "game over" DOM node; add `data-testid` locators to interactive Card and BoardArea components; rewrite the story to click through Splash → Lobby → Game → GameEnded using only the rendered App DOM.

**Tech Stack:** React 18, TypeScript 5, Vite, Storybook 10 (`@storybook/react-vite`), Vitest 4, `@vitest/browser-playwright`, alien-signals, Testing Library utilities (`userEvent`, `waitFor`, `expect`, `within` from `storybook/test`)

---

## File Map

| File | Change |
|------|--------|
| `client/src/game/state/game.flow.ts` | Add `setRoom(GameEnded)` after `session.endGame()` |
| `client/src/App/App.tsx` | Render `<div data-testid="game-over">` for `GameEnded` room |
| `client/src/game/visuals/Card.tsx` | Add `data-testid="available-card"` when card is pickable |
| `client/src/game/visuals/BoardArea.tsx` | Thread `data-testid="valid-placement"` through `BoardSquare` |
| `client/src/game/visuals/SoloGameVisualTdd.stories.tsx` | Full rewrite — single `SoloGamePlaysToCompletion` story |

---

## Task 1: Wire `setRoom(GameEnded)` in LobbyFlow

**Files:**
- Modify: `client/src/game/state/game.flow.ts` (around line 286)
- Test: `client/src/game/state/game.flow.test.ts`

### Background

`LobbyFlow.runFlow()` calls `session.endGame()` but leaves `room` as `Game`
forever. `GameEnded` already exists in `AppExtras.ts` as a constant but is never
set by the flow. After this task, `getRoom()` will return `"GameEnded"` when a
game completes normally.

The existing guard in `runFlow()` already reads:

```ts
if (getRoom() === Game) {
  this.session.endGame();
}
```

We add `setRoom(GameEnded)` on the next line.

- [ ] **Step 1: Read the current flow test to understand existing coverage**

  Open `client/src/game/state/game.flow.test.ts`. Note which tests exercise the
  end-of-game path — look for uses of `"game:ended"` event or `endGame`. This
  tells you what already exists so the new test doesn't duplicate it.

- [ ] **Step 2: Write a failing test — room transitions to GameEnded after the game ends**

  In `client/src/game/state/game.flow.test.ts`, add a new test (near the
  existing game-end tests). The test must **fail** before the implementation:

  ```ts
  it("transitions room to GameEnded after the game ends", async () => {
    // Arrange: start and play a minimal one-round solo game
    // (mirror the pattern already used in the file for solo game tests)
    // At the end, assert room === "GameEnded"
    expect(getRoom()).toBe("GameEnded");
  });
  ```

  Look at the existing test helpers in the file — there is likely a helper that
  starts a full solo game; reuse it.

- [ ] **Step 3: Run the new test to confirm it fails**

  ```bash
  cd client && npx vitest run --reporter=verbose src/game/state/game.flow.test.ts
  ```

  Expected: the new test fails with something like `expected 'Game' to be 'GameEnded'`.

- [ ] **Step 4: Implement — add `setRoom(GameEnded)` in `game.flow.ts`**

  Locate this block in `client/src/game/state/game.flow.ts`:

  ```ts
  if (getRoom() === Game) {
    this.session.endGame();
  }
  ```

  Change it to:

  ```ts
  if (getRoom() === Game) {
    this.session.endGame();
    setRoom(GameEnded);
  }
  ```

  No other changes needed in this file.

- [ ] **Step 5: Run the tests — new test plus the full flow test suite**

  ```bash
  cd client && npx vitest run --reporter=verbose src/game/state/game.flow.test.ts
  ```

  Expected: all tests in the file pass, including the new one.

- [ ] **Step 6: Commit**

  ```bash
  cd client && git add src/game/state/game.flow.ts src/game/state/game.flow.test.ts
  git commit -m "feat: transition to GameEnded room after game completes

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 2: Render `data-testid="game-over"` in App for GameEnded room

**Files:**
- Modify: `client/src/App/App.tsx`

### Background

`App.tsx` currently renders nothing for `room === "GameEnded"`. After this task,
the DOM will contain a `<div data-testid="game-over">` so story tests (and future
UI) can detect game completion.

Current `App.tsx` for reference:

```tsx
export function App() {
  const { session, room, hint } = useApp();
  return (
    <div className="App">
      <h1>Kingdomino</h1>
      <p>{hint}</p>
      {room === "Splash" && <SplashComponent />}
      {room === "Lobby" && <LobbyComponent session={session} />}
      {(room === "Game" || room === "GamePaused") && session && <GameComponent session={session} />}
    </div>
  );
}
```

- [ ] **Step 1: Add the `GameEnded` branch to `App.tsx`**

  After the `GamePaused` line, add:

  ```tsx
  {room === "GameEnded" && (
    <div data-testid="game-over">
      <h2>Game over</h2>
    </div>
  )}
  ```

  The full updated `App.tsx` should look like:

  ```tsx
  import React from "react";

  import "./App.css";
  import { Splash as SplashComponent } from "../Splash/Splash";
  import { Lobby as LobbyComponent } from "../Lobby/Lobby";
  import { Game as GameComponent } from "../game/visuals/Game";
  import { useApp } from "./store";

  export function App() {
    const { session, room, hint } = useApp();

    return (
      <div className="App">
        <h1>Kingdomino</h1>
        <p>{hint}</p>
        {room === "Splash" && <SplashComponent />}
        {room === "Lobby" && <LobbyComponent session={session} />}
        {(room === "Game" || room === "GamePaused") && session && <GameComponent session={session} />}
        {room === "GameEnded" && (
          <div data-testid="game-over">
            <h2>Game over</h2>
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Run the full client test suite to confirm nothing broke**

  ```bash
  cd client && npm test
  ```

  Expected: all tests pass (this is a purely additive change with no existing
  tests for GameEnded rendering — the flow test from Task 1 already verifies the
  room transition).

- [ ] **Step 3: Commit**

  ```bash
  git add client/src/App/App.tsx
  git commit -m "feat: render game-over element when game ends

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 3: Add `data-testid="available-card"` to `Card.tsx`

**Files:**
- Modify: `client/src/game/visuals/Card.tsx`

### Background

`Card.tsx` renders a `div.card` (no disabled class) when `isMyTurn && isActive`.
The story's play function needs to find a pickable card without knowing card IDs.
We add `data-testid="available-card"` only when the card is genuinely clickable.
Disabled cards get no testid, preventing the play function from clicking them.

Current `Card.tsx`:

```tsx
export function Card({ card, isMyTurn, session }: CardProps) {
  const { room } = useApp();
  const { id, tiles } = card;

  const isActive = room === GameRoom;
  const className = `card${isMyTurn && isActive ? "" : " disabled"}`;

  return (
    <div className={className} key={id} onClick={() => isMyTurn && isActive && session.handleLocalPick(id)}>
      {tiles.map(({ tile, value }, index) => (
        <Tile key={index} tile={tile} value={value} />
      ))}
    </div>
  );
}
```

- [ ] **Step 1: Add `data-testid` to the card div**

  Update `client/src/game/visuals/Card.tsx`:

  ```tsx
  export function Card({ card, isMyTurn, session }: CardProps) {
    const { room } = useApp();
    const { id, tiles } = card;

    const isActive = room === GameRoom;
    const className = `card${isMyTurn && isActive ? "" : " disabled"}`;

    return (
      <div
        className={className}
        key={id}
        data-testid={isMyTurn && isActive ? "available-card" : undefined}
        onClick={() => isMyTurn && isActive && session.handleLocalPick(id)}
      >
        {tiles.map(({ tile, value }, index) => (
          <Tile key={index} tile={tile} value={value} />
        ))}
      </div>
    );
  }
  ```

- [ ] **Step 2: Run the full client test suite**

  ```bash
  cd client && npm test
  ```

  Expected: all tests pass (additive change).

- [ ] **Step 3: Commit**

  ```bash
  git add client/src/game/visuals/Card.tsx
  git commit -m "feat: add data-testid to available deal cards

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 4: Add `data-testid="valid-placement"` to `BoardArea.tsx`

**Files:**
- Modify: `client/src/game/visuals/BoardArea.tsx`

### Background

`BoardArea.tsx` renders a grid of `BoardSquare` divs. The story's play function
needs to find a valid placement position without knowing board coordinates or card
IDs. We thread a `data-testid` prop through `BoardSquare` and pass
`"valid-placement"` on positions where `isMe && isMyPlace && isValidTile(x, y) &&
isValidDirection(x, y, direction)`.

`BoardSquare` currently has this signature:

```tsx
type BoardSquareProps = {
  handleClick: () => void;
  children: React.ReactNode;
};

function BoardSquare({ handleClick, children }: BoardSquareProps) {
  return <div onClick={handleClick}>{children}</div>;
}
```

- [ ] **Step 1: Update `BoardSquare` to accept and forward `data-testid`**

  Replace the `BoardSquare` type and function in
  `client/src/game/visuals/BoardArea.tsx`:

  ```tsx
  type BoardSquareProps = {
    handleClick: () => void;
    children: React.ReactNode;
    "data-testid"?: string;
  };

  function BoardSquare({ handleClick, children, "data-testid": testId }: BoardSquareProps) {
    return <div onClick={handleClick} data-testid={testId}>{children}</div>;
  }
  ```

- [ ] **Step 2: Pass `data-testid` in the board grid map**

  In the grid render inside `BoardArea`, locate the `BoardSquare` usage and add
  the `data-testid` prop:

  ```tsx
  {myBoard.map((row, y) =>
    row.map(({ tile, value }, x) => (
      <BoardSquare
        key={`${y},${x}`}
        handleClick={handleClick(x, y)}
        data-testid={
          isMe && isMyPlace && isValidTile(x, y) && isValidDirection(x, y, direction)
            ? "valid-placement"
            : undefined
        }
      >
        <Tile
          tile={tile}
          value={value}
          disabled={!isMe || !isMyPlace || !isValidTile(x, y)}
          allowHighlight={isValidDirection(x, y, direction)}
        />
      </BoardSquare>
    )),
  )}
  ```

- [ ] **Step 3: Run the full client test suite**

  ```bash
  cd client && npm test
  ```

  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add client/src/game/visuals/BoardArea.tsx
  git commit -m "feat: add data-testid to valid board placement squares

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Task 5: Rewrite `SoloGameVisualTdd.stories.tsx`

**Files:**
- Modify: `client/src/game/visuals/SoloGameVisualTdd.stories.tsx`

### Background

The current story uses `LocalAutoDriver`, `SoloGameHarness`, `LobbyFlow`,
`GameSession`, and `findPlacementWithin5x5` — all internal APIs. It also renders
an artificial `game-ended-indicator` outside `<App />`.

The new story:
- Uses `App` as the component (no wrapper harness)
- Imports nothing from `game.flow`, `GameSession`, or game logic
- Calls `resetAppState()` in `beforeEach` for story isolation
- Drives the full game in `play()` using `userEvent.click` and `data-testid` locators

The `waitFor` loop is intentional: it retries until `data-testid="game-over"` is
visible, clicking any available card or valid placement on each attempt. This
works because alien-signals state updates are synchronous — the DOM is immediately
consistent after each click.

`canvas.queryAllByTestId("available-card")[0]` is safe because the `data-testid`
is only present when `isMyTurn && isActive`, so disabled cards are never returned.

**Button label reference** (so the play function finds the right buttons):
- Splash: `<button aria-label="Start solo">Ready for a game on your own?</button>`
  → use `getByRole("button", { name: /start solo/i })` (matches `aria-label`)
- Lobby: `<button aria-label="Start game">Start game</button>`
  → use `findByRole("button", { name: /start game/i })`

- [ ] **Step 1: Check the Storybook story instructions**

  Before modifying the story file, run:

  ```
  storybook-get-storybook-story-instructions
  ```

  This provides the required import paths and meta conventions for this Storybook
  setup. Confirm: framework package is `@storybook/react-vite`; test utilities
  come from `storybook/test`.

- [ ] **Step 2: Run the existing story tests to establish the failing baseline**

  ```bash
  cd client && npx storybook test --story "Game/Solo AI Visual TDD" --no-coverage 2>&1 | tail -30
  ```

  Or use the `storybook-run-story-tests` tool with the story ID
  `game-solo-ai-visual-tdd--solo-game-completes-one-round`.

  Note the current failure mode (if any) — this tells you what "red" looks like.

- [ ] **Step 3: Replace the full file contents**

  Overwrite `client/src/game/visuals/SoloGameVisualTdd.stories.tsx` with:

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
    // Navigate through Splash and Lobby via real UI buttons
    await userEvent.click(canvas.getByRole("button", { name: /start solo/i }));
    await userEvent.click(await canvas.findByRole("button", { name: /start game/i }));

    // Auto-play until the App renders the game-over element.
    // waitFor retries the entire callback on each failure; clicking inside is safe
    // because alien-signals state is synchronous — DOM is consistent after each click.
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

  export const SoloGamePlaysToCompletion: Story = {
    play: async ({ canvas }) => {
      await playSoloGameToEnd(canvas, 60000);
      await expect(canvas.getByText(/Kingdomino/i)).toBeVisible();
    },
  };
  ```

- [ ] **Step 4: Run the new story test — expect it to pass**

  Use `storybook-run-story-tests` with story ID
  `game-solo-ai-visual-tdd--solo-game-plays-to-completion`.

  Or via CLI:

  ```bash
  cd client && npx storybook test --story "Game/Solo AI Visual TDD" --no-coverage 2>&1 | tail -40
  ```

  Expected: `SoloGamePlaysToCompletion` passes within the 60-second timeout.

  If it times out, check:
  1. Does `data-testid="available-card"` appear during the pick phase? (Verify
     Tasks 3 and 4 were applied correctly.)
  2. Does `data-testid="valid-placement"` appear during the place phase?
  3. Does `data-testid="game-over"` appear after all rounds? (Verify Tasks 1 and
     2 were applied correctly.)

- [ ] **Step 5: Run the full story test suite to confirm no regressions**

  Run `storybook-run-story-tests` with no story filter (all stories).

  Or via CLI:

  ```bash
  cd client && npx storybook test --no-coverage 2>&1 | tail -50
  ```

  Expected: all existing story tests (`PlayRulesVisualTdd`, `SetupRulesVisualTdd`,
  `ScoringRulesVisualTdd`) remain green.

- [ ] **Step 6: Run the full unit + integration test suite**

  ```bash
  cd client && npm test
  ```

  Expected: all tests pass.

- [ ] **Step 7: Commit**

  ```bash
  git add client/src/game/visuals/SoloGameVisualTdd.stories.tsx
  git commit -m "refactor: rewrite SoloGameVisualTdd as pure App e2e story

  Remove LocalAutoDriver, SoloGameHarness, and all session/flow imports.
  Drive the full solo game via userEvent.click on data-testid locators.
  Merge one-round and two-round stories into SoloGamePlaysToCompletion.

  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
  ```

---

## Verification Checklist

After all tasks are complete:

- [ ] `getRoom()` returns `"GameEnded"` after a game ends (covered by Task 1 test)
- [ ] `<div data-testid="game-over">` is present in the DOM when `room === "GameEnded"`
- [ ] `data-testid="available-card"` appears on cards only during the pick phase
- [ ] `data-testid="valid-placement"` appears on valid board squares only during the place phase
- [ ] `SoloGamePlaysToCompletion` story test passes
- [ ] All other story tests remain green
- [ ] `cd client && npm test` passes with no failures
- [ ] Story file imports: no `GameSession`, no `LobbyFlow`, no game logic imports
