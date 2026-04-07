# Design: Replace `waitFor` with `waitForOneOf` as the Unified Connection API

## Problem

`IGameConnection` currently exposes two overlapping methods:

- `waitFor(type)` — waits for exactly one message type; **racy** (no cancellation)
- `waitForOneOf(...types)` — waits for any of N types with cancellation-aware resolver cleanup

`ConnectionManager` is constructed with both, using `waitFor` for single-type calls and the optional `waitForOneOfFn` for multi-type races. This means single-type calls throughout `ConnectionManager` (e.g. `waitForPick`, `waitForWithTimeout`) still register stale resolvers when they're used in a racing context — and the `waitForOneOfFn` is only injected for `MultiplayerConnection`, leaving `SoloConnection` and `TestConnection` on the racy fallback path.

The root issue: `waitForOneOf(type)` with a single type is functionally identical to `waitFor(type)` — no companion resolvers exist to cancel. There is no reason to keep both.

## Approach

Replace `waitFor` with `waitForOneOf` as the single connection primitive, everywhere:

1. **`IGameConnection` interface**: remove `waitFor`, add `waitForOneOf`
2. **`ConnectionManager`**: constructor takes `waitForOneOf` only (drop the second `waitFor` param and `waitForOneOfFn` third param); replace all `this.waitFor(x)` call sites with `this.waitForOneOf(x)`
3. **`game.flow.ts` factory**: drop the `instanceof MultiplayerConnection` guard; always inject `connection.waitForOneOf.bind(connection)`
4. **All three connection classes** (`MultiplayerConnection`, `SoloConnection`, `TestConnection`): remove the `waitFor` method entirely (each already has `waitForOneOf`)
5. **`default.roster.factory.ts`**: update `ConnectionManager` construction to pass `conn.waitForOneOf.bind(conn)`
6. **Tests**: update the ~5 direct call sites that use `.waitFor(type)` to `.waitForOneOf(type)` — mechanically equivalent

## Data Flow

Before:
```
IGameConnection → { send, waitFor, waitForOneOf, destroy }
ConnectionManager(send, waitFor, waitForOneOfFn?)
  waitForPick()       → waitFor(PICK)      ← racy for SoloConnection/TestConnection
  waitForWithTimeout  → waitFor(type)      ← racy for SoloConnection/TestConnection
  waitForNextMoveMessage → waitForOneOfFn? ?? Promise.race(waitFor×3)  ← racy fallback
```

After:
```
IGameConnection → { send, waitForOneOf, destroy }
ConnectionManager(send, waitForOneOf)
  waitForPick()       → waitForOneOf(PICK)    ← always cancellation-safe
  waitForWithTimeout  → waitForOneOf(type)    ← always cancellation-safe
  waitForNextMoveMessage → waitForOneOf(PICK, PLACE, DISCARD)  ← always cancellation-safe
```

## Interface Change

```ts
// game.flow.ts
export interface IGameConnection {
  readonly peerIdentifiers: { me: string; them: string };
  send: (message: WireMessage) => void;
  waitForOneOf: <Types extends WireMessageType[]>(
    ...types: Types
  ) => Promise<WireMessagePayload<Types[number]>>;
  destroy: () => void;
}
```

`WaitForOneOfFn` is currently defined privately in `ConnectionManager.ts`. It should be exported from that file and re-exported via `packages/kingdomino-protocol/src/index.ts` (which already re-exports `ConnectionManager`). Since `IGameConnection` lives in `game.flow.ts` in the `client` package which already imports from `"kingdomino-protocol"`, this avoids any circular import concern — the type flows: `ConnectionManager.ts` → `index.ts` → `game.flow.ts`.

`IGameConnection.waitForOneOf` should be typed using `WaitForOneOfFn` by name (imported from `"kingdomino-protocol"`), not inlined, so the interface and `ConnectionManager` constructor share an exact type:

```ts
// game.flow.ts
import type { WaitForOneOfFn } from "kingdomino-protocol";

export interface IGameConnection {
  readonly peerIdentifiers: { me: string; them: string };
  send: (message: WireMessage) => void;
  waitForOneOf: WaitForOneOfFn;
  destroy: () => void;
}
```

## `ConnectionManager` Constructor

```ts
// Before
constructor(send: SendWireMessage, waitFor: WaitForWireMessage, waitForOneOfFn?: WaitForOneOfFn)

// After
constructor(send: SendWireMessage, waitForOneOf: WaitForOneOfFn)
```

All internal `this.waitFor(x)` calls become `this.waitForOneOf(x)`.

## Injection Site

```ts
// game.flow.ts — before
((connection) => new ConnectionManager(
  connection.send,
  connection.waitFor,
  connection instanceof MultiplayerConnection
    ? connection.waitForOneOf.bind(connection)
    : undefined,
))

// game.flow.ts — after
((connection) => new ConnectionManager(
  connection.send,
  connection.waitForOneOf.bind(connection),
))
```

## Affected Files

| File | Change |
|------|--------|
| `packages/client/src/game/state/game.flow.ts` | Remove `waitFor` from `IGameConnection`; add `waitForOneOf`; simplify factory |
| `packages/kingdomino-protocol/src/ConnectionManager.ts` | Drop `waitFor` param; drop `waitForOneOfFn` param; replace all internal `waitFor` calls |
| `packages/kingdomino-protocol/src/connection.multiplayer.ts` | Remove `waitFor` method |
| `packages/client/src/game/state/connection.solo.ts` | Remove `waitFor` method |
| `packages/kingdomino-protocol/src/connection.testing.ts` | Remove `waitFor` method |
| `packages/client/src/game/state/default.roster.factory.ts` | Update `ConnectionManager` construction |
| `packages/kingdomino-protocol/src/remote.player.actor.test.ts` | Replace all 6 `local.waitFor` usages (lines 25, 37, 48, 59, 68, 87) with `local.waitForOneOf.bind(local)`; new constructor is single-arg `new ConnectionManager(local.send, local.waitForOneOf.bind(local))` |
| `packages/kingdomino-protocol/src/connection.testing.test.ts` | Replace 4 direct `.waitFor(x)` calls with `.waitForOneOf(x)` |
| `packages/client/src/game/state/connection.solo.test.ts` | Replace 4 direct `.waitFor(x)` calls with `.waitForOneOf(x)` |
| `packages/kingdomino-lobby/src/peer.session.test.ts` | Replace 2 direct `mc.waitFor(x)` calls with `mc.waitForOneOf(x)` |
| `packages/client/src/game/state/game.flow.test.ts` | Update mock `IGameConnection` at line 36: replace `waitFor` method with `waitForOneOf` |

## `CommitmentTransport` Adapter

`game.flow.ts:238` currently casts the connection directly to `CommitmentTransport`:
```ts
?? new CommitmentSeedProvider(connection as unknown as CommitmentTransport);
```

`CommitmentTransport` requires `waitFor<T>(messageType: string): Promise<T>`. After removing `waitFor` from the concrete connection classes, this cast silently breaks at runtime — TypeScript doesn't catch it due to `as unknown as`.

The fix: replace the cast with an explicit inline adapter in `runFlow`:

```ts
// game.flow.ts — runFlow (line ~236)
const commitmentTransport: CommitmentTransport = {
  send: connection.send,
  waitFor: (type: string) =>
    connection.waitForOneOf(type as WireMessageType) as Promise<never>,
};
const seedProvider =
  seedProviderOverride ?? new CommitmentSeedProvider(commitmentTransport);
```

`COMMITTMENT` and `REVEAL` are already members of `WireMessageType` (defined in `game.messages.ts` lines 18-19), so the cast is safe. Add `game.flow.ts` to the affected files table for this change.

## Out of Scope

- `CommitmentTransport.waitFor` — unrelated interface in a separate package with its own semantics
- The existing `waitForPlaceOrDiscard` convenience method on `MultiplayerConnection` — not part of `IGameConnection`, can be left or removed separately

## Testing

No new tests required. The existing suites fully cover the behavior:
- `connection.multiplayer.test.ts` — 7 tests for `waitForOneOf` (single, multi, queue drain, cancellation)
- `remote.player.actor.test.ts` — stale-waiter regression + loop regression
- `connection.solo.test.ts`, `connection.testing.test.ts` — updated call sites become trivially equivalent

Run: `cd packages/kingdomino-protocol && npm test && cd ../client && npm test`
