# Discard Protocol Design

**Date:** 2026-03-26
**Status:** Approved
**Related spec:** `2026-03-26-single-player-ai-design.md` (updates the AI discard fallback)

## Problem

Discarding is broken in two distinct places:

**Local player flow** — `game.flow.ts` waits only for `place:made` after a player picks a card. If the player cannot place and calls `handleLocalDiscard()`, that emits `discard:made` — an event the flow never observes. The flow hangs indefinitely waiting for a `place:made` that will never arrive. Discarding by a human player in the current game flow is a deadlock.

**Peer protocol** — `MovePayload` has no discard field. When a remote player discards, no signal reaches the peer. The receiving flow calls `handlePlacement()` unconditionally, which either throws on invalid coordinates or silently corrupts game state. Consequences: the Harmony bonus is incorrectly awarded to remote players who discard, and pick order for the following round is wrong because `recordDiscard()` is never called to dequeue the player.

The gap is documented explicitly in `GameSession.ts` (lines 245–250) and in `connection.solo.ts`.

## Approach

Add a `DISCARD` message type to the peer protocol. Fix the local player flow to handle `discard:made`. Fix the remote player flow to branch on the action type. Update all connection implementations and the `TestConnection` scripted scenario type.

## Schema

### New `DISCARD` message type (`game.messages.ts`)

```
DISCARD constant: "discard"
DiscardPayload: { playerId: PlayerId; card: CardId }
discardMessage(payload: DiscardPayload): GameMessage helper
```

`GameMessageType` becomes a union of five types: `START | COMMITTMENT | REVEAL | MOVE | DISCARD`. All exhaustive `switch` statements on `GameMessageType` must add a `DISCARD` case.

### New `RemoteAction` discriminated union (`types.ts`)

```typescript
type RemoteAction =
  | { kind: "move";    move: PlayerMoveMessage                    }
  | { kind: "discard"; playerId: PlayerId; card: CardId }
```

This is the return type of `waitForAction()` — used wherever the game flow waits for an opponent's turn.

### Updated `TestConnection` scripted scenario type

`ScriptedMove` (currently `Omit<PlayerMoveMessage, "playerId">`) is replaced by `ScriptedAction`:

```typescript
type ScriptedAction =
  | { kind: "placement"; card: CardId; x: number; y: number; direction: Direction }
  | { kind: "discard";   card: CardId }
```

The `kind` discriminant ensures scripted discards cannot carry coordinates and scripted placements must carry them. TypeScript exhaustiveness checking catches unhandled cases.

## `IGameConnection` Interface

One new method is added:

```typescript
waitForAction(): Promise<RemoteAction>
```

This replaces `waitFor(MOVE)` in game turn loops. `waitFor(MOVE)` is retained for the commitment protocol handshake and remains on the interface. All three implementations (Solo, Multiplayer, Test) must implement `waitForAction()`.

## `ConnectionManager`

Two additions:

- `sendDiscard(playerId: PlayerId, card: CardId)` — wraps `discardMessage()` and calls `connection.send()`
- `waitForAction(): Promise<RemoteAction>` — delegates to `connection.waitForAction()`

`sendMove()` and `waitForMove()` are retained for the commitment handshake. `waitForMove()` callers in the game turn loop switch to `waitForAction()`.

## Game Flow (`game.flow.ts`)

### Local player path

**Before:** waits only for `place:made` → sends MOVE unconditionally.

**After:** waits for `place:made` **or** `discard:made` for the current actor, whichever fires first. Then branches:

- `place:made` → `connectionManager.sendMove({ playerId, card, x, y, direction })` (unchanged)
- `discard:made` → `connectionManager.sendDiscard(playerId, card)`

### Remote player path

**Before:** `connectionManager.waitForMove()` → `session.handlePick()` + `session.handlePlacement()` unconditionally.

**After:** `connectionManager.waitForAction()` → branch on `kind`:

- `"move"` → `session.handlePick(move.playerId, move.card)` + `session.handlePlacement(move.playerId, move.x, move.y, move.direction)` (unchanged)
- `"discard"` → `session.handlePick(playerId, card)` + `session.handleDiscard(playerId)`

`handleDiscard()` validates internally that no valid placement exists for the picked card and throws if one does — keeping both peers honest about claimed discards.

## Connection Implementations

### `SoloConnection`

- `respondToMessage()` gains a `DISCARD` case (no-op — the solo opponent never sends discards to itself via the local-player path)
- `emitOpponentAction()` (renamed from `emitOpponentMove()`) emits either a MOVE or DISCARD into the appropriate queue based on `AIPlayer.generateAction()`
- `waitForAction()` returns whichever of the MOVE or DISCARD queues has a pending message

### `MultiplayerConnection`

- `handleIncomingMessage()` gains a `DISCARD` case that routes the payload to the DISCARD queue
- `waitForAction()` returns whichever of the MOVE or DISCARD queues resolves first

### `TestConnection`

- `ScriptedAction` union replaces `ScriptedMove` in `TestConnectionScenario`
- When replaying scenarios, emits a MOVE or DISCARD message depending on the scripted action's `kind`
- `waitForAction()` returns the scripted result directly, typed as `RemoteAction`

### `RandomAIPlayer` (from `2026-03-26-single-player-ai-design.md`)

`generateMove(): PlayerMoveMessage` is replaced by `generateAction(): RemoteAction`:

- Returns `{ kind: "move", move: { playerId, card, x, y, direction } }` when a valid in-bounds placement exists
- Returns `{ kind: "discard", playerId, card }` when no available card has a valid in-bounds placement

The `(0,0,up)` fallback and `console.warn` described in the AI spec are removed. The degenerate discard edge case is now properly handled end-to-end.

## Testing

### Game flow unit tests

- Local player path: when `discard:made` fires before `place:made`, `connectionManager.sendDiscard()` is called and `sendMove()` is not
- Remote player path: receiving `{ kind: "discard" }` calls `session.handleDiscard()` and not `session.handlePlacement()`

### `TestConnection` story tests (new scenarios now expressible)

- Scripted opponent discards a card → Harmony bonus is correctly withheld from the discarding player
- Scripted opponent discards a card → pick order is correct in the following round
- Human player discards a card → game flow proceeds (no deadlock), peer receives DISCARD, peer session calls `handleDiscard()` correctly

### `GameSession.ts` cleanup

The NOTE comment at lines 245–250 ("Only local player discards reach this path…") is removed. The gap it documents is fixed by this design.

## Files Changed

| File | Change |
|------|--------|
| `client/src/game/state/game.messages.ts` | Add `DISCARD` constant, `DiscardPayload`, `discardMessage()` |
| `client/src/game/state/types.ts` | Add `RemoteAction` discriminated union |
| `client/src/game/state/game.flow.ts` | Local path: handle `discard:made`; remote path: use `waitForAction()` and branch |
| `client/src/game/state/ConnectionManager.ts` | Add `sendDiscard()` and `waitForAction()` |
| `client/src/game/state/connection.solo.ts` | Add DISCARD case; rename `emitOpponentMove()` → `emitOpponentAction()`; implement `waitForAction()` |
| `client/src/game/state/connection.multiplayer.ts` | Add DISCARD routing in `handleIncomingMessage()`; implement `waitForAction()` |
| `client/src/game/state/connection.testing.ts` | Replace `ScriptedMove` with `ScriptedAction` union; implement `waitForAction()` |
| `client/src/game/state/IGameConnection.ts` (or `game.flow.ts`) | Add `waitForAction()` to `IGameConnection` interface |
| `client/src/game/state/GameSession.ts` | Remove the NOTE comment at lines 245–250 |
| `client/src/game/state/ai.player.ts` | Rename `generateMove()` → `generateAction()` returning `RemoteAction` |

## Out of Scope

- Validation that `DiscardPayload.card` matches what was actually picked (handled by `handleDiscard()` which already verifies a pick exists)
- Harmony bonus tracking for TestConnection scripted scenarios that don't exercise the full game end
