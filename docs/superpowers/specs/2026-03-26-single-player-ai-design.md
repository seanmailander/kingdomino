# Single-Player AI Opponent Design

**Date:** 2026-03-26
**Status:** Approved

## Problem

`SoloConnection.emitOpponentMove()` returns a hardcoded move (`card: 0, x: 0, y: 0, direction: up`) every turn. This makes solo play impossible — the AI never picks a real card or places it on a valid position. The game cannot progress past the first move.

## Approach

Implement a `RandomAIPlayer` class that owns a second `GameSession` instance (the AI's session), mirroring the human's session from the opposite perspective. `SoloConnection` delegates opponent move generation to `RandomAIPlayer` instead of using the hardcoded stub.

This approach is consistent with the Player-Agnostic GameSession Principle: `GameSession` behaves like a server-side game engine handling all players uniformly. In solo mode, the AI is simply the other side of the connection, backed by its own session instance.

## Architecture

### Components

**`RandomAIPlayer`** (new — `client/src/game/state/ai.player.ts`)

Owns a `GameSession` where `me = "ai"` and `them = "human"` — the mirror of the human's session. The AI session tracks the AI's board state, deal picks, and pick order using the same game engine as the human side.

Public API:
- `beginRound(cardIds: CardId[])` — initializes the AI session's round with the same 4 cards as the human session
- `receiveHumanMove(card: CardId, x: number, y: number, dir: Direction)` — feeds the human's completed pick+placement into the AI session so it tracks which deal cards are taken and maintains correct pick order for the next round
- `generateMove(): PlayerMoveMessage` — queries the AI session for available cards and board state, picks randomly, validates placement, returns a complete move
- `destroy()` — tears down the AI session and cleans up subscriptions

**`SoloConnection`** (modified — `client/src/game/state/connection.solo.ts`)

Gains an optional `aiPlayer: RandomAIPlayer` constructor parameter. `emitOpponentMove()` delegates to `aiPlayer.generateMove()` when an AI player is present. When processing a human `MOVE` message, calls `aiPlayer.receiveHumanMove()` before generating the AI response.

**`LobbyFlow` / `game.flow.ts`** (minor modification)

In solo mode, after calling `humanSession.beginRound(cardIds)`, also calls `aiPlayer.beginRound(cardIds)`. This keeps both sessions synchronized on the current round's card deal.

## Data Flow

### Round Initialization

1. `connectionManager.buildTrustedSeed()` computes shared seed from commit/reveal exchange
2. `cardIds` derived from seed → `humanSession.beginRound(cardIds)` (unchanged)
3. `aiPlayer.beginRound(cardIds)` called immediately after — AI session initializes with the same 4 cards

### When the AI Needs to Move

Triggered by `SoloConnection.emitOpponentMove()` (once after `REVEAL`, once per human `MOVE`):

1. `aiPlayer.generateMove()` is called
2. `aiSession.currentRound.deal.snapshot()` → filter for unpicked slots → random selection
3. `aiSession.handleLocalPick(randomCardId)` — AI session records the pick
4. `getEligiblePositions(aiSession.boardFor("ai"), randomCardId)` → list of valid `(x, y, dir)` placements
5. If positions exist: pick one at random → `aiSession.handleLocalPlacement(x, y, dir)` → return that move
6. If no positions: `aiSession.handleLocalDiscard()` → return discard sentinel
7. `SoloConnection` emits the returned `PlayerMoveMessage` as an incoming MOVE → human game flow proceeds

### When Human Sends a MOVE

1. `SoloConnection.respondToMessage(MOVE)` receives the full `PlayerMoveMessage`
2. `aiPlayer.receiveHumanMove(card, x, y, dir)`:
   - `aiSession.handlePick("human", card)`
   - `aiSession.handlePlacement("human", x, y, dir)`
3. `emitOpponentMove()` → `aiPlayer.generateMove()` as above

## Error Handling & Edge Cases

**Discard:**
`getEligiblePositions()` returns empty → `aiSession.handleLocalDiscard()` is called (validates internally that no placement exists, matching the human discard path). The MOVE returned uses a sentinel placement. This matches the existing behavior for the remote-player discard limitation documented in the prior spec.

**Pick order correctness:**
`SoloConnection.emitOpponentMove()` is called once after `REVEAL` and once per human `MOVE`. The AI session's `deal.snapshot()` reflects what has been picked so far at each call, so random selection is always from genuinely available cards regardless of which player goes first in the round.

**Session teardown:**
`RandomAIPlayer.destroy()` destroys the AI's `GameSession` and cleans up event subscriptions. Called by `SoloConnection.destroy()`.

**Variant awareness:**
`RandomAIPlayer` is constructed with the board variant (5×5 default, 7×7 for Mighty Duel). `generateMove()` uses `getEligiblePositions()` which respects the session's configured bounds.

## Testing

### Unit Tests (`client/src/game/state/ai.player.test.ts`)

- Given a known deal and empty AI board → `generateMove()` returns a card from the deal at a valid position
- Given a board with limited space → returns only valid placements
- Given a fully trapped board → returns discard sentinel
- `receiveHumanMove()` marks the human's card as taken so AI never picks the same card

### Integration

Solo game flows end-to-end through the full `LobbyFlow` game flow: human picks, AI picks, human places, AI places, round completes, scoring is correct. Uses `SoloConnection` + `RandomAIPlayer` together.

### Storybook Story

A `SoloGame` story that runs a complete solo game to completion and asserts the final state renders correctly (scores, winner, board layouts). Uses the real `SoloConnection` + `RandomAIPlayer` — no scripted scenarios needed since moves are random but always legal.

## Files Changed

| File | Change |
|------|--------|
| `client/src/game/state/ai.player.ts` | New — `RandomAIPlayer` class |
| `client/src/game/state/connection.solo.ts` | Modified — delegate `emitOpponentMove()` to `RandomAIPlayer`; relay human moves |
| `client/src/game/state/game.flow.ts` | Modified — call `aiPlayer.beginRound(cardIds)` alongside `session.beginRound()` in solo mode |
| `client/src/game/state/ai.player.test.ts` | New — unit tests for `RandomAIPlayer` |

## Out of Scope

- Strategic AI (greedy, look-ahead, minimax) — the random baseline is the goal for this phase
- Difficulty levels or AI personality
- Full removal of `isLocal` convenience methods from `GameSession` (deferred per the Player-Agnostic principle note)
- Encoding AI discards in the peer protocol (existing known limitation, not addressed here)
