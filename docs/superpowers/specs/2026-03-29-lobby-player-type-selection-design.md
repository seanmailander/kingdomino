# Lobby Player-Type Selection — Design Spec

_2026-03-29_

---

## Problem

`Lobby.tsx` is a bare placeholder: eight lines of raw JSON output and two buttons. It communicates nothing about who is playing or what kind of player each slot is. The architecture report (Section 8) describes a richer model — configurable player slots (Local, Couch, AI, Remote), a `RosterFactory` that converts the user's selection into typed `PlayerActor` objects, and a `GameDriver` that drives the game loop without knowing how actors produce moves.

This spec describes the full implementation: UI first, public contracts second, concrete implementations last.

---

## Scope

- Redesign `Lobby.tsx` into a proper lobby with 2–4 configurable player slots
- Define `RosterConfig`, `RosterFactory`, and `RosterResult` types in the client
- Implement `LocalPlayerActor`, `CouchPlayerActor`, `AIPlayerActor`, and `RemotePlayerActor` adapter (stubs clearly marked where wiring is incomplete)
- Wire `LobbyFlow` to consume a `RosterFactory` (receives config from the lobby, produces actors)
- Write Storybook stories for visual TDD
- Write a unit test for `DefaultRosterFactory` using `TestConnection`

**Not in scope:** actual WebRTC peer discovery UI (search/browse peers); couch handoff screen; AI strategy improvements; spectator slots.

---

## Package Split

| Artifact | Package | Status |
|---|---|---|
| `PlayerActor` interface | `kingdomino-protocol` | ✅ already exists |
| `RemotePlayerActor` | `kingdomino-protocol` | ✅ already exists |
| `GameDriver` | `kingdomino-protocol` | ✅ already exists |
| `PeerSession` (WebRTC) | `kingdomino-lobby` | ✅ already exists |
| `RosterConfig`, `RosterFactory` interface | `client/src/Lobby/` | 🆕 new |
| `LocalPlayerActor` | `client/src/game/state/` | 🆕 new |
| `CouchPlayerActor` | `client/src/game/state/` | 🆕 new |
| `AIPlayerActor` | `client/src/game/state/` | 🆕 new (wraps `RandomAIPlayer`) |
| `DefaultRosterFactory` | `client/src/game/state/` | 🆕 new |

---

## Phase 1: The UI

### Component: `Lobby.tsx`

Manages local React state:
```ts
type RosterConfig = [PlayerSlotConfig, PlayerSlotConfig, ...PlayerSlotConfig[]]  // 2–4 entries
type PlayerSlotType = 'local' | 'couch' | 'ai' | 'remote'
type PlayerSlotConfig = { type: PlayerSlotType; peerId?: string }
```

**Props:**
```ts
type LobbyProps = {
  onStart: (config: RosterConfig) => void
  onLeave: () => void
}
```
The component calls `onStart` and `onLeave` rather than importing store actions directly, making it fully testable in isolation. (The `session` prop is not needed for the lobby UI — the lobby operates before a session is created.)

**UI zones:**

1. **Player count selector** — buttons for 2, 3, 4. Adjusting adds/removes slots at the end. No slot is pre-locked.

2. **Slot list** — one row per slot. Each row has:
   - Slot label ("Player 1", "Player 2", etc.)
   - Type picker: segmented control or radio buttons with labels Local / Couch / AI / Remote
   - If `type === 'remote'`: a text input for peer code (placeholder: "Peer ID…")

3. **Footer:**
   - "Start game" — enabled when every Remote slot has a non-empty `peerId`; disabled otherwise
   - "Leave" — always enabled

### Stories (`Lobby.stories.tsx`)

| Story | Config |
|---|---|
| `TwoPlayerDefault` | [Local, AI] |
| `FourPlayerMixed` | [Local, Couch, AI, Remote (with peer code)] |
| `RemoteSlotPending` | [Local, Remote (empty peer code)] — Start disabled |
| `AllAI` | [AI, AI, AI, AI] |

---

## Phase 2: Public Contracts

### `lobby.types.ts` (new, `client/src/Lobby/`)

```ts
export type PlayerSlotType = 'local' | 'couch' | 'ai' | 'remote'

export type PlayerSlotConfig = {
  type: PlayerSlotType
  /** Required when type === 'remote' */
  peerId?: string
}

/** Minimum 2, maximum 4 players */
export type RosterConfig = [PlayerSlotConfig, PlayerSlotConfig, ...PlayerSlotConfig[]]
```

### `RosterFactory.ts` (new, `client/src/game/state/`)

```ts
import type { SeedProvider } from 'kingdomino-engine'
import type { PlayerActor } from 'kingdomino-protocol'
import type { PlayerId } from 'kingdomino-engine'
import type { RosterConfig } from '../../Lobby/lobby.types'

export type RosterResult = {
  players: Array<{ id: PlayerId; actor: PlayerActor }>
  seedProvider: SeedProvider
}

export interface RosterFactory {
  build(config: RosterConfig): Promise<RosterResult>
}
```

### Changes to `FlowAdapter` and `store.ts`

`FlowAdapter.awaitStart()` return type changes from `Promise<void>` to `Promise<RosterConfig>`.

In `store.ts`:
- `triggerLobbyStart` signature changes from `() => void` to `(config: RosterConfig) => void`
- Resolvers now resolve with `config` (not `undefined`)
- `AppFlowAdapter.awaitStart()` resolves from the same resolver queue, returning the `RosterConfig`

### Changes to `LobbyFlow` constructor

The existing `LobbyFlowOptions` fields:

| Field | Change |
|---|---|
| `adapter` | Retained (unchanged) |
| `rosterFactory` | **NEW** — replaces `createConnectionManager` and `createSeedProvider` |
| `variant` | Retained — passed through to `GameSession` via `rosterFactory.build()` result |
| `bonuses` | Retained — same |
| `createConnectionManager` | **Removed** — superseded by `rosterFactory` |
| `createSeedProvider` | **Removed** — superseded by `rosterFactory` (factory selects `RandomSeedProvider` vs `CommitmentSeedProvider`) |

Updated type:
```ts
type LobbyFlowOptions = {
  adapter: FlowAdapter
  rosterFactory: RosterFactory   // NEW
  variant?: GameVariant          // retained
  bonuses?: GameBonuses          // retained
}
```

`LobbyFlow` calls `this.adapter.awaitStart()` → receives `RosterConfig` → calls `rosterFactory.build(config)` → uses result to initialise the game.

---

## Phase 3: Implementations

### `LocalPlayerActor`

Implements `PlayerActor`. Bridges `awaitPick` and `awaitPlacement` to UI intent signals. The actor registers with a `UIIntentBus` and resolves when the user clicks a card or places it.

> **Stub note:** The `UIIntentBus` (Seam 7 from the architecture report) does not yet exist. The initial implementation will use the same resolver-array pattern as the current store.ts and leave a `// TODO: replace with UIIntentBus` comment.

### `CouchPlayerActor`

Same as `LocalPlayerActor`, plus a `HandoffGate` call before each turn that pauses and signals the UI to show a "Pass the device to Player N" screen.

> **Stub note:** The `HandoffGate` interface and its React implementation are not in scope. The initial stub calls `HandoffGate.handoff()` against a no-op implementation and leaves a `// TODO: implement HandoffGate UI` comment.

### `AIPlayerActor`

Wraps the existing `RandomAIPlayer` (in `kingdomino-protocol`) to conform to the `PlayerActor` interface. The shadow-`GameSession` design inside `RandomAIPlayer` is preserved in the wrapper and marked `// TODO: refactor to stateless strategy per architecture report §8.5`.

### `RemotePlayerActor`

Already implemented in `kingdomino-protocol`. The `DefaultRosterFactory` constructs it by calling `PeerSession.connect(peerId)` from `kingdomino-lobby`.

> **Stub note:** `PeerSession.connect()` may not yet be fully implemented. The factory catches connection errors and rejects its build promise with a descriptive message.

### `DefaultRosterFactory`

The concrete implementation living in the client. For each slot:
- `'local'` → `new LocalPlayerActor(generatedId, ...)`
- `'couch'` → `new CouchPlayerActor(generatedId, ...)`
- `'ai'` → `new AIPlayerActor(generatedId, new RandomAIPlayer(...))`
- `'remote'` → `await peerSession.connect(slot.peerId!)` → `new ConnectionManager(conn)` → `new RemotePlayerActor(slot.peerId!, manager)`
  - `PlayerId` for a remote player is their PeerJS peer ID — the value typed into the UI's peer-code input
  - `MultiplayerConnection` (returned by `PeerSession.connect`) is wrapped with `new ConnectionManager(conn)` from `kingdomino-protocol` before passing to `RemotePlayerActor`

> **Note:** `PeerSession.connect()` is fully implemented in `kingdomino-lobby`. The factory catches its rejection and re-throws with a descriptive message.

Seed provider selection:
- Any remote slot present → `CommitmentSeedProvider`
- All-local roster → `RandomSeedProvider`

> **Known design hole:** `RandomAIPlayer(aiId, humanId, variant)` takes a `humanId`. In a 3–4 player game with multiple AI slots, "humanId" is ambiguous. The initial implementation passes the first non-AI player's ID and leaves a `// TODO: redesign AIPlayerActor for N-player games` comment.

---

## Data Flow Summary

```
Lobby.tsx (local React state)
  rosterConfig: RosterConfig   ← user configures slots
  onStart(config) ──────────────────────────────────────►

store.ts
  triggerLobbyStart(config)
  → resolves lobbyStartResolvers[] with config

LobbyFlow.awaitLobbyStart() → RosterConfig
  → rosterFactory.build(config) → RosterResult
  → session.addPlayer(id) for each player
  → new GameDriver(session, actorMap)
  → driver.run()
```

---

## Testing

### Storybook (visual TDD)
Four stories in `Lobby.stories.tsx` covering the key UI states (see Phase 1).

### Unit test: `DefaultRosterFactory`
In `client/src/game/state/RosterFactory.test.ts`:
- Build a roster with [Local, AI] — verify two players, correct actor types, `RandomSeedProvider`
- Build a roster with [Local, Remote] using a `TestConnection` transport — verify `RemotePlayerActor`, `CommitmentSeedProvider`

---

## Implementation Order

1. **Stories + Lobby.tsx** — visual TDD loop (story → red → green)
2. **`lobby.types.ts`** — define the config types
3. **`store.ts` + `LobbyFlow` contract changes** — thread `RosterConfig` through
4. **Actor stubs** — `LocalPlayerActor`, `CouchPlayerActor`, `AIPlayerActor`
5. **`DefaultRosterFactory`** — wires actors + seed provider
6. **`gameLobby.ts`** — inject `DefaultRosterFactory` into `LobbyFlow`
7. **Unit tests** — `RosterFactory.test.ts`

---

## Open Questions / Known Stubs

| Item | Status |
|---|---|
| `UIIntentBus` (Seam 7) | `LocalPlayerActor` uses resolver arrays with a TODO |
| `HandoffGate` UI screen | `CouchPlayerActor` uses a no-op gate with a TODO |
| `RosterConfig`'s TypeScript type `[PlayerSlotConfig, PlayerSlotConfig, ...PlayerSlotConfig[]]` does not enforce the max-4 upper bound. Add a runtime guard in `DefaultRosterFactory.build()` that throws if `config.length > 4`. |
| AI shadow-session refactor | Wrapped as-is in `AIPlayerActor` with a TODO |
| 3–4 player engine support | `GameSession.addPlayer()` accepts N players; untested beyond 2 |
