# Game Over Score Display — Design Spec

**Date:** 2026-03-28  
**Status:** Approved

---

## Problem

The game-over screen is a placeholder (`<h2>Game over</h2>`). Players have no way to see their final scores after a game ends.

---

## Goal

Display final scores — with bonus breakdown and winner highlighted — on the game-over screen, plus a "Return to Lobby" button.

---

## Scope

**In scope:**
- New `GameOverScreen` React component
- Ranked score display: base score + middle kingdom bonus + harmony bonus = total
- Winner highlighted (1st place)
- "Return to Lobby" button
- Storybook stories + play-function tests
- Wiring in `App.tsx` via a new `gameOverScores` signal

**Out of scope:**
- Per-terrain breakdown (e.g. Forest: 3×2=6)
- Animations or confetti
- Score persistence / history

---

## Architecture

### Data Flow

```
game:ended event  →  gameOverScores signal (App.tsx)  →  GameOverScreen props
```

`GameSession.endGame()` emits `game:ended` with a `scores` array, pre-sorted by rank:

```
score DESC → largestPropertySize DESC → totalCrowns DESC
```

`App.tsx` already registers a `game:ended` listener (via `store.ts`). A new `gameOverScores` signal captures the payload and passes it to `GameOverScreen`.

### Files Changed / Created

| File | Change |
|------|--------|
| `client/src/game/visuals/GameOverScreen.tsx` | **New** — display component |
| `client/src/game/visuals/GameOverScreen.stories.tsx` | **New** — Storybook stories + play tests |
| `client/src/App/store.ts` | Add `gameOverScores` signal, populate on `game:ended` |
| `client/src/App/App.tsx` | Pass `scores` + `onReturnToLobby` to `GameOverScreen` |

---

## Component API

```tsx
// From GameSession.endGame() — already typed in GameSession.ts
interface ScoreEntry {
  player: Player;
  score: number;           // total score (base + bonuses)
  bonuses: {
    middleKingdom: number; // 10 if castle centred, else 0
    harmony: number;       // 5 if no discards, else 0
  };
}

interface GameOverScreenProps {
  scores: ScoreEntry[];        // sorted rank 1 first
  onReturnToLobby: () => void;
}
```

`baseScore = score − bonuses.middleKingdom − bonuses.harmony`

---

## Display Layout (per player, ranked)

```
🏆  Alice          ← highlighted if rank 1
    Base score:    18
    Middle Kingdom: +10
    Harmony:        +5
    ──────────────────
    Total:         33

    Bob
    Base score:    21
    ──────────────────
    Total:         21

[ Return to Lobby ]
```

- Middle Kingdom row only shown if `bonuses.middleKingdom > 0`
- Harmony row only shown if `bonuses.harmony > 0`
- Winner (rank 1) visually distinguished (e.g. trophy icon, bold name, or highlighted card)

---

## Storybook Stories

| Story | Purpose |
|-------|---------|
| `SoloWin` | 1 player, no bonuses — basic score render |
| `TwoPlayerClear` | 2 players, clear score difference |
| `WithBonuses` | Winner has both middle kingdom + harmony bonuses |

Each story includes a `play` function asserting:
- Winner is highlighted
- All player scores render
- Bonus rows appear when bonus > 0, hidden when bonus = 0
- "Return to Lobby" button is present

---

## Error Handling

- If `scores` is empty, render a fallback ("No score data available") — defensive only; shouldn't occur in practice.
- `onReturnToLobby` callback is always provided by `App.tsx`.

---

## Testing Strategy

1. **Visual TDD** — Write story + play assertions first (red), then implement component (green).
2. No new unit test files needed; scoring logic is already unit-tested in `scoring.test.ts`.
3. Run `cd client && npm test` to confirm no regressions.

---

## Constraints & Conventions

- Named exports only (no default exports) — per `client/src/CLAUDE.md`
- One primary responsibility per file
- Minimise explicit TypeScript annotations; prefer inference
- Follow existing patterns in `client/src/game/visuals/`
