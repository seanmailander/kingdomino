# Design: `waitForOneOf` — Cancellation-Aware Multi-Type Message Waiting

## Problem

`ConnectionManager` has two methods that race multiple `waitFor(type)` calls:

- **`waitForNextMoveMessage()`** — races `waitFor(PICK)`, `waitFor(PLACE)`, `waitFor(DISCARD)`. Called in a loop (`relayRemoteMoves`). Each iteration leaves 2 stale resolvers; over a multi-round game they accumulate and silently consume future messages, causing hangs.
- **`waitForPickAndPlacement()`** — same race pattern for PLACE vs DISCARD. Currently dead code (no call sites).

The fix already shipped for `waitForPlaceOrDiscard` (PR: fix/wait-for-place-or-discard-cancellation) uses paired resolvers that remove each other when one wins. That fix must be generalized.

## Solution

Add `waitForOneOf(...types)` to each connection class — a generalization of the `waitForPlaceOrDiscard` pattern that works for any N message types. Inject it into `ConnectionManager` to replace the narrower `waitForPlaceOrDiscardFn`.

## Design

### `waitForOneOf` on connection classes

Signature (added to `MultiplayerConnection`, `SoloConnection`, `TestConnection`):

```ts
waitForOneOf = <Types extends WireMessageType[]>(
  ...types: Types
): Promise<WireMessagePayload<Types[number]>> => { ... }
```

Implementation mirrors `waitForPlaceOrDiscard`:
1. Drain any already-queued message of a winning type (first-come wins).
2. Register one resolver per type, all linked by a shared `settled` flag.
3. When any resolver fires, mark settled and remove all companion resolvers from `messageResolvers`.

`waitForPlaceOrDiscard` on `MultiplayerConnection` becomes a thin wrapper:
```ts
waitForPlaceOrDiscard = () => this.waitForOneOf(PLACE, DISCARD);
```
(Kept for backward-compat with `IGameConnection`-shaped consumers.)

### `ConnectionManager` constructor changes

Replace the third constructor parameter:
```ts
// Before
constructor(send, waitFor, waitForPlaceOrDiscard?: () => Promise<PlaceMessage | DiscardMessage>)

// After
constructor(send, waitFor, waitForOneOf?: <Types extends WireMessageType[]>(...types: Types) => Promise<...>)
```

Named helpers in `ConnectionManager` are re-implemented on top of the injected `waitForOneOf`:
```ts
waitForPlaceOrDiscard() { return this.waitForOneOfFn(PLACE, DISCARD); }
waitForNextMoveMessage() { return this.waitForOneOfFn(PICK, PLACE, DISCARD); }
```

The racy fallback (used when no `waitForOneOf` is injected) is kept for backward-compat but clearly documented as unsafe for looped use.

### `game.flow.ts` injection site

Use duck-typing via `instanceof MultiplayerConnection` (same as the current check), since `MultiplayerConnection` is already imported at that site:

```ts
// Before
connection instanceof MultiplayerConnection
  ? connection.waitForPlaceOrDiscard.bind(connection)
  : undefined

// After
connection instanceof MultiplayerConnection
  ? connection.waitForOneOf.bind(connection)
  : undefined
```

### Dead code removal

`ConnectionManager.waitForPickAndPlacement()` — removed. `GameDriver` replaced its use case, and it carries the same stale-resolver bug.

## Affected Files

| File | Change |
|---|---|
| `connection.multiplayer.ts` | Add `waitForOneOf`; `waitForPlaceOrDiscard` delegates to it |
| `connection.solo.ts` | Add `waitForOneOf` |
| `connection.testing.ts` | Add `waitForOneOf` |
| `ConnectionManager.ts` | Replace `waitForPlaceOrDiscardFn` with `waitForOneOfFn`; rewrite `waitForPlaceOrDiscard` + `waitForNextMoveMessage` to use it; remove `waitForPickAndPlacement` |
| `game.flow.ts` | Update injection: pass `waitForOneOf` instead of `waitForPlaceOrDiscard` |

## Testing

- Unit tests for `waitForOneOf` on `MultiplayerConnection`: N-way race where each type wins; verify losing resolvers are unregistered; verify already-queued messages are drained.
- Regression test: `waitForNextMoveMessage()` in a loop does not accumulate stale resolvers (extend existing `remote.player.actor.test.ts` pattern).
- Existing tests for `waitForPlaceOrDiscard` continue to pass (no behavior change, just delegation).

## Out of Scope

Extracting a shared `MessageQueue` base class to eliminate the triplication of `messageQueues + messageResolvers + emitIncoming` across all three connection classes. Natural follow-up once `waitForOneOf` is stable.
