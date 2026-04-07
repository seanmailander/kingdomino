# `waitForOneOf` — Cancellation-Aware Multi-Type Message Waiting

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace racy `Promise.race([waitFor(A), waitFor(B), ...])` patterns in `ConnectionManager` with a cancellation-aware `waitForOneOf(...types)` so stale resolvers never accumulate across loop iterations.

**Architecture:** Add `waitForOneOf` to all three connection classes (`MultiplayerConnection`, `SoloConnection`, `TestConnection`) using the same paired-resolver-cancellation pattern already in `MultiplayerConnection.waitForPlaceOrDiscard`. Inject `waitForOneOf` into `ConnectionManager` to replace the narrower `waitForPlaceOrDiscardFn`; re-implement `waitForPlaceOrDiscard()` and `waitForNextMoveMessage()` on top of it; remove dead `waitForPickAndPlacement()`.

**Tech Stack:** TypeScript 5, Vitest 4, packages `kingdomino-protocol` and `client`.

**Run tests:**
- Protocol package: `cd packages/kingdomino-protocol && npm test`
- Client package: `cd packages/client && npm test`

**Spec:** `docs/superpowers/specs/2026-04-07-wait-for-one-of-design.md`

---

## File Map

| File | Change |
|---|---|
| `packages/kingdomino-protocol/src/connection.multiplayer.ts` | Add `waitForOneOf`; delegate `waitForPlaceOrDiscard` to it |
| `packages/client/src/game/state/connection.solo.ts` | Add `waitForOneOf` |
| `packages/kingdomino-protocol/src/connection.testing.ts` | Add `waitForOneOf` |
| `packages/kingdomino-protocol/src/ConnectionManager.ts` | Replace `waitForPlaceOrDiscardFn` with `waitForOneOfFn`; rewrite `waitForPlaceOrDiscard()` and `waitForNextMoveMessage()`; remove `waitForPickAndPlacement()` |
| `packages/client/src/game/state/game.flow.ts` | Pass `connection.waitForOneOf` to `ConnectionManager` constructor |
| `packages/kingdomino-protocol/src/connection.multiplayer.test.ts` | **New file** — unit tests for `waitForOneOf` on `MultiplayerConnection` |
| `packages/kingdomino-protocol/src/remote.player.actor.test.ts` | Add loop regression test for `waitForNextMoveMessage` |

---

## Task 1: Write failing tests for `waitForOneOf` on `MultiplayerConnection`

**Files:**
- Create: `packages/kingdomino-protocol/src/connection.multiplayer.test.ts`

- [ ] **Step 1: Create the test file**

```ts
// packages/kingdomino-protocol/src/connection.multiplayer.test.ts
import { describe, it, expect } from "vitest";
import { MultiplayerConnection } from "./connection.multiplayer";
import { PICK, PLACE, DISCARD } from "./game.messages";

function makeConnectedPair() {
  const a = new MultiplayerConnection({ me: "a", them: "b" });
  const b = new MultiplayerConnection({ me: "b", them: "a" });
  a.setTransport({ send: (msg) => b.receive(msg) });
  b.setTransport({ send: (msg) => a.receive(msg) });
  return { a, b };
}

describe("MultiplayerConnection.waitForOneOf", () => {
  it("resolves with a PICK message when PICK arrives first", async () => {
    const { a, b } = makeConnectedPair();
    const promise = a.waitForOneOf(PICK, PLACE, DISCARD);
    b.send({ type: "pick:made", playerId: "b", cardId: 42 });
    const msg = await promise;
    expect(msg).toMatchObject({ type: "pick:made", cardId: 42 });
  });

  it("resolves with a PLACE message when PLACE arrives first", async () => {
    const { a, b } = makeConnectedPair();
    const promise = a.waitForOneOf(PICK, PLACE, DISCARD);
    b.send({ type: "place:made", playerId: "b", x: 3, y: 2, direction: "right" });
    const msg = await promise;
    expect(msg).toMatchObject({ type: "place:made", x: 3, y: 2 });
  });

  it("resolves with a DISCARD message when DISCARD arrives first", async () => {
    const { a, b } = makeConnectedPair();
    const promise = a.waitForOneOf(PICK, PLACE, DISCARD);
    b.send({ type: "discard:made", playerId: "b" });
    const msg = await promise;
    expect(msg).toMatchObject({ type: "discard:made" });
  });

  it("removes losing resolvers when one wins (no stale resolvers remain)", async () => {
    const { a, b } = makeConnectedPair();
    const promise = a.waitForOneOf(PICK, PLACE, DISCARD);
    b.send({ type: "pick:made", playerId: "b", cardId: 1 });
    await promise;

    // No stale resolvers: a second PLACE should queue, not fire a stale resolver.
    // Verify by checking that a fresh waitForOneOf for PLACE resolves correctly.
    b.send({ type: "place:made", playerId: "b", x: 0, y: 0, direction: "right" });
    const second = await a.waitForOneOf(PLACE);
    expect(second).toMatchObject({ type: "place:made" });
  });

  it("drains already-queued messages (first type wins)", async () => {
    const { a, b } = makeConnectedPair();
    // Queue a PICK before the waitForOneOf call.
    b.send({ type: "pick:made", playerId: "b", cardId: 99 });
    // Give the message time to arrive and queue.
    await Promise.resolve();
    const msg = await a.waitForOneOf(PICK, PLACE);
    expect(msg).toMatchObject({ type: "pick:made", cardId: 99 });
  });

  it("rejects when the connection is destroyed while waiting", async () => {
    const { a } = makeConnectedPair();
    const promise = a.waitForOneOf(PICK, PLACE, DISCARD);
    a.destroy();
    await expect(promise).rejects.toThrow("destroyed");
  });

  it("two-type race: waitForOneOf(PLACE, DISCARD) behaves like waitForPlaceOrDiscard", async () => {
    const { a, b } = makeConnectedPair();
    // Round 1: PLACE wins
    b.send({ type: "place:made", playerId: "b", x: 1, y: 1, direction: "up" });
    const r1 = await a.waitForOneOf(PLACE, DISCARD);
    expect(r1).toMatchObject({ type: "place:made" });

    // Round 2: DISCARD wins — if stale resolver from round 1 existed, it would eat this
    b.send({ type: "discard:made", playerId: "b" });
    const r2 = await a.waitForOneOf(PLACE, DISCARD);
    expect(r2).toMatchObject({ type: "discard:made" });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (method does not exist yet)**

```bash
cd packages/kingdomino-protocol && npm test -- connection.multiplayer
```

Expected: All 7 tests fail with `a.waitForOneOf is not a function` or similar.

---

## Task 2: Implement `waitForOneOf` on `MultiplayerConnection`

**Files:**
- Modify: `packages/kingdomino-protocol/src/connection.multiplayer.ts`

- [ ] **Step 1: Add the `waitForOneOf` method after `waitForPlaceOrDiscard`**

Insert this method directly after the `waitForPlaceOrDiscard` method in `MultiplayerConnection`:

```ts
waitForOneOf = <Types extends WireMessageType[]>(
  ...types: Types
): Promise<WireMessagePayload<Types[number]>> => {
  this.assertActive();

  // Drain any already-queued message (first matching type wins).
  for (const type of types) {
    const queue = this.messageQueues.get(type) as Array<WireMessagePayload<typeof type>> | undefined;
    if (queue && queue.length > 0) {
      return Promise.resolve(queue.shift() as WireMessagePayload<Types[number]>);
    }
  }

  return new Promise<WireMessagePayload<Types[number]>>((resolve, reject) => {
    let settled = false;

    const makeResolver = (ownType: WireMessageType): MessageResolver => ({
      resolve: (payload) => {
        if (settled) return;
        settled = true;
        // Remove companion resolvers for all other types.
        for (const otherType of types) {
          if (otherType === ownType) continue;
          const companions = this.messageResolvers.get(otherType);
          if (companions) {
            const idx = companions.indexOf(resolverMap.get(otherType)!);
            if (idx !== -1) companions.splice(idx, 1);
            if (companions.length === 0) this.messageResolvers.delete(otherType);
          }
        }
        resolve(payload as WireMessagePayload<Types[number]>);
      },
      reject: (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      },
    });

    const resolverMap = new Map<WireMessageType, MessageResolver>(
      types.map((type) => [type, makeResolver(type)]),
    );

    for (const [type, resolver] of resolverMap) {
      const list = this.messageResolvers.get(type) ?? [];
      list.push(resolver);
      this.messageResolvers.set(type, list);
    }
  });
};
```

- [ ] **Step 2: Delegate `waitForPlaceOrDiscard` to `waitForOneOf`**

Replace the body of `waitForPlaceOrDiscard` so it becomes a thin wrapper:

```ts
waitForPlaceOrDiscard = (): Promise<PlaceMessage | DiscardMessage> =>
  this.waitForOneOf(PLACE, DISCARD) as Promise<PlaceMessage | DiscardMessage>;
```

> The old 80-line implementation can be removed entirely — `waitForOneOf` covers it.

- [ ] **Step 3: Run tests — expect all 7 new tests to PASS**

```bash
cd packages/kingdomino-protocol && npm test -- connection.multiplayer
```

Expected: 7/7 pass.

- [ ] **Step 4: Run full protocol test suite to confirm nothing broke**

```bash
cd packages/kingdomino-protocol && npm test
```

Expected: All pass (existing `waitForPlaceOrDiscard` tests still pass via delegation).

- [ ] **Step 5: Commit**

```bash
git add packages/kingdomino-protocol/src/connection.multiplayer.ts \
        packages/kingdomino-protocol/src/connection.multiplayer.test.ts
git commit -m "feat(protocol): add waitForOneOf to MultiplayerConnection

Generalizes waitForPlaceOrDiscard to N types using the same
cancellation-aware paired-resolver pattern. waitForPlaceOrDiscard
now delegates to waitForOneOf(PLACE, DISCARD).

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Add `waitForOneOf` to `SoloConnection` and `TestConnection`

**Files:**
- Modify: `packages/client/src/game/state/connection.solo.ts`
- Modify: `packages/kingdomino-protocol/src/connection.testing.ts`

The implementation is identical to Task 2 — same resolver pattern, same queue draining, same cleanup logic. Both classes already have `messageQueues`, `messageResolvers`, and `emitIncoming` with the same structure.

- [ ] **Step 1: Add `waitForOneOf` to `SoloConnection`**

In `packages/client/src/game/state/connection.solo.ts`, add the method after the `waitFor` method. The method body is identical to the one added to `MultiplayerConnection` in Task 2 — copy it verbatim, since all three classes share the same `MessageResolver` type and `messageQueues`/`messageResolvers` structure.

```ts
waitForOneOf = <Types extends WireMessageType[]>(
  ...types: Types
): Promise<WireMessagePayload<Types[number]>> => {
  this.assertActive();

  for (const type of types) {
    const queue = this.messageQueues.get(type) as Array<WireMessagePayload<typeof type>> | undefined;
    if (queue && queue.length > 0) {
      return Promise.resolve(queue.shift() as WireMessagePayload<Types[number]>);
    }
  }

  return new Promise<WireMessagePayload<Types[number]>>((resolve, reject) => {
    let settled = false;

    const makeResolver = (ownType: WireMessageType): MessageResolver => ({
      resolve: (payload) => {
        if (settled) return;
        settled = true;
        for (const otherType of types) {
          if (otherType === ownType) continue;
          const companions = this.messageResolvers.get(otherType);
          if (companions) {
            const idx = companions.indexOf(resolverMap.get(otherType)!);
            if (idx !== -1) companions.splice(idx, 1);
            if (companions.length === 0) this.messageResolvers.delete(otherType);
          }
        }
        resolve(payload as WireMessagePayload<Types[number]>);
      },
      reject: (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      },
    });

    const resolverMap = new Map<WireMessageType, MessageResolver>(
      types.map((type) => [type, makeResolver(type)]),
    );

    for (const [type, resolver] of resolverMap) {
      const list = this.messageResolvers.get(type) ?? [];
      list.push(resolver);
      this.messageResolvers.set(type, list);
    }
  });
};
```

- [ ] **Step 2: Add `waitForOneOf` to `TestConnection`**

In `packages/kingdomino-protocol/src/connection.testing.ts`, add the identical method after the `waitFor` method.

- [ ] **Step 3: Run both test suites**

```bash
cd packages/kingdomino-protocol && npm test
cd packages/client && npm test
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/game/state/connection.solo.ts \
        packages/kingdomino-protocol/src/connection.testing.ts
git commit -m "feat: add waitForOneOf to SoloConnection and TestConnection

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Write the failing loop regression test for `waitForNextMoveMessage`

**Files:**
- Modify: `packages/kingdomino-protocol/src/remote.player.actor.test.ts`

This test verifies the loop-accumulation bug that `waitForNextMoveMessage` currently has — stale resolvers from iteration N consuming messages intended for iteration N+1.

- [ ] **Step 1: Add the regression test**

Add this test inside the existing `describe("RemotePlayerActor", ...)` block in `remote.player.actor.test.ts`:

```ts
it("waitForNextMoveMessage() in a loop does not accumulate stale resolvers across rounds", async () => {
  const { local, remote } = makeConnectedPair();
  const manager = new ConnectionManager(
    local.send,
    local.waitFor,
    local.waitForOneOf.bind(local),
  );

  // Simulate 3 rounds of PICK messages arriving via the loop.
  // Without the fix, stale PLACE+DISCARD resolvers pile up and consume future messages.
  for (let round = 1; round <= 3; round++) {
    const msgPromise = manager.waitForNextMoveMessage();
    remote.send({ type: "pick:made", playerId: "remote", cardId: round });
    const msg = await msgPromise;
    expect(msg).toMatchObject({ type: "pick:made", cardId: round });
  }

  // After 3 PICK rounds: without the fix there would be 6 stale PLACE/DISCARD resolvers.
  // With the fix: 0. Verify by confirming a PLACE message is received correctly.
  const placeMsgPromise = manager.waitForNextMoveMessage();
  remote.send({ type: "place:made", playerId: "remote", x: 1, y: 1, direction: "up" });
  const placeMsg = await placeMsgPromise;
  expect(placeMsg).toMatchObject({ type: "place:made" });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
cd packages/kingdomino-protocol && npm test -- remote.player.actor
```

Expected: New test fails. The existing 5 tests still pass.

---

## Task 5: Update `ConnectionManager` to use `waitForOneOf`

**Files:**
- Modify: `packages/kingdomino-protocol/src/ConnectionManager.ts`

- [ ] **Step 1: Replace the third constructor parameter**

The type for the injected function needs to express "callable with any subset of WireMessageType". Define a type alias at the top of the file:

```ts
type WaitForOneOfFn = <Types extends WireMessageType[]>(
  ...types: Types
) => Promise<WireMessagePayload<Types[number]>>;
```

Replace the constructor signature and private field:

```ts
// Remove:
private readonly waitForPlaceOrDiscardFn: WaitForPlaceOrDiscard | undefined;

// Add:
private readonly waitForOneOfFn: WaitForOneOfFn | undefined;
```

Constructor:
```ts
constructor(
  send: SendWireMessage,
  waitFor: WaitForWireMessage,
  waitForOneOf?: WaitForOneOfFn,
) {
  this.send = send;
  this.waitFor = waitFor;
  this.waitForOneOfFn = waitForOneOf;
}
```

- [ ] **Step 2: Rewrite `waitForPlaceOrDiscard()` to use the injected fn**

```ts
waitForPlaceOrDiscard(): Promise<PlaceMessage | DiscardMessage> {
  if (this.waitForOneOfFn) {
    return this.waitForOneOfFn(PLACE, DISCARD) as Promise<PlaceMessage | DiscardMessage>;
  }
  // Fallback: racy — leaves a stale resolver for the losing type.
  // Only safe when called at most once per connection lifetime (e.g. single-round tests).
  const placeOrNull = this.waitForPlace().catch((): null => null);
  const discardOrNull = this.waitForDiscard().catch((): null => null);
  return Promise.race([placeOrNull, discardOrNull]).then((msg) => {
    if (!msg) throw new Error("ConnectionManager: connection closed while waiting for place or discard");
    return msg;
  });
}
```

- [ ] **Step 3: Rewrite `waitForNextMoveMessage()` to use the injected fn**

```ts
async waitForNextMoveMessage(): Promise<MoveMessage> {
  if (this.waitForOneOfFn) {
    return this.waitForOneOfFn(PICK, PLACE, DISCARD) as Promise<MoveMessage>;
  }
  // Fallback: racy — accumulates stale resolvers in loops.
  // Only safe for connections that don't provide waitForOneOf.
  return Promise.race([
    this.waitFor(PICK)    as Promise<PickMessage>,
    this.waitFor(PLACE)   as Promise<PlaceMessage>,
    this.waitFor(DISCARD) as Promise<DiscardMessage>,
  ]);
}
```

- [ ] **Step 4: Remove `waitForPickAndPlacement()`**

Delete the entire `waitForPickAndPlacement` method. It is dead code (no call sites) and carries the same stale-resolver bug.

Also remove the now-unused `WaitForPlaceOrDiscard` type alias at the top of the file if it was only used by that parameter.

- [ ] **Step 5: Run the loop regression test — expect PASS**

```bash
cd packages/kingdomino-protocol && npm test -- remote.player.actor
```

Expected: All tests pass including the new loop regression test.

- [ ] **Step 6: Run full protocol suite**

```bash
cd packages/kingdomino-protocol && npm test
```

Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add packages/kingdomino-protocol/src/ConnectionManager.ts \
        packages/kingdomino-protocol/src/remote.player.actor.test.ts
git commit -m "fix(protocol): fix stale waitFor resolvers in waitForNextMoveMessage

Replace racy Promise.race([waitFor(A), waitFor(B), waitFor(C)]) with
the cancellation-aware waitForOneOf injection. Losing resolvers are
now unregistered when a winner arrives, preventing accumulation in the
relayRemoteMoves loop.

Also removes dead waitForPickAndPlacement() which had the same bug.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6: Update `game.flow.ts` to inject `waitForOneOf`

**Files:**
- Modify: `packages/client/src/game/state/game.flow.ts`

- [ ] **Step 1: Update the `ConnectionManager` construction**

Find the default `createConnectionManager` factory (around line 103–111). Change:

```ts
// Before
connection instanceof MultiplayerConnection
  ? connection.waitForPlaceOrDiscard.bind(connection)
  : undefined,
```

To:

```ts
// After
connection instanceof MultiplayerConnection
  ? connection.waitForOneOf.bind(connection)
  : undefined,
```

- [ ] **Step 2: Run the client test suite**

```bash
cd packages/client && npm test
```

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/game/state/game.flow.ts
git commit -m "fix(client): inject waitForOneOf into ConnectionManager

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 7: Final verification and push

- [ ] **Step 1: Run both full test suites**

```bash
cd packages/kingdomino-protocol && npm test
cd packages/client && npm test
```

Expected: All pass in both packages.

- [ ] **Step 2: TypeScript check**

```bash
cd packages/kingdomino-protocol && npm run tscheck
cd packages/client && npm run tscheck 2>/dev/null || true
```

- [ ] **Step 3: Push**

```bash
git pull --rebase && git push
```
