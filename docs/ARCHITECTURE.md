# Kingdomino Architecture

A browser-based P2P board game. The server handles only signaling (WebRTC/mDNS). All game logic, state, and trust live in client code. Two browsers play directly — neither is authoritative over the other, which drives most of the architectural choices below.

---

## The One-Way Dependency Rule

The client is organized in three strict layers. Dependencies flow downward only:

```
visuals/      ← React components, Storybook stories
    ↓
state/        ← OOP orchestration: GameSession, LobbyFlow, connections
    ↓
gamelogic/    ← Pure functions: deck, scoring, placement validation, seed utils
```

Each layer has a different reason to change:
- **visuals** changes when UX changes
- **state** changes when game flow or coordination changes
- **gamelogic** changes only when game rules change

Pure functions belong in `gamelogic/`. Classes that own lifecycle or coordinate across time belong in `state/`. Components that render belong in `visuals/`.

---

## Package Map

Five published packages, each with a distinct consumer set:

```
chacha-rng                    (zero deps)
  └── deterministic seeded RNG; no game knowledge

kingdomino-engine             (depends on: chacha-rng)
  └── game domain: rules, board, cards, session state machine, events
      needed by: all clients, bots, observers, tests

kingdomino-commitment         (depends on: kingdomino-engine)
  └── cryptographic seed commitment/reveal protocol
      needed by: game participants only — not observers

kingdomino-protocol           (depends on: kingdomino-engine)
  └── wire message vocabulary, ConnectionManager, PlayerActor interface,
      RemotePlayerActor, GameDriver (turn-level actor coordinator)
      needed by: all active game clients (UI, bots)

kingdomino-lobby              (depends on: kingdomino-protocol)
  └── PeerJS client, peer discovery, WebRTC connection establishment
      needed by: any client finding games on the network

──── client application (depends on all packages above) ────
  LocalPlayerActor    — bridges PlayerActor to React input events
  CouchPlayerActor    — adds HandoffGate for shared-screen play
  LobbyFlow           — app-specific game lifecycle state machine
  AppFlowAdapter      — bridges LobbyFlow to alien-signals store
  store.ts            — reactive signals, resolver queues
  React components    — visuals
```

### Why this split?

Ask: *would a completely different Kingdomino client need this?*

A **bot client** (no UI, auto-plays): needs engine + commitment + protocol + lobby.  
An **observer client** (watches but doesn't play): needs engine + protocol, but NOT commitment.  
An **alternative UI client** (terminal, native): needs all packages, but writes its own `LocalPlayerActor`.  

Anything all three consumers need is a universal package. Anything specific to one client's tech stack stays in that client.

---

## GameSession: The Player-Agnostic Engine

`GameSession` is the game engine. It should not grant special treatment to any player — it processes all players uniformly.

The distinction between "local" and "remote" lives outside the session, at the UI and actor boundary. `GameSession` accepts a `localPlayerId` at construction time only to power UI-convenience queries (`isMyTurn()`, `localCardToPlace()` etc.) — these are projections onto the game state, not special treatment in the state machine itself.

### GameSession API surface

**Commands (mutations):**

| Method | Phase | Description |
|--------|-------|-------------|
| `addPlayer(player)` | lobby | Register a participant |
| `startGame()` | lobby → playing | Begin; engine seeds pick order, drives round loop internally via SeedProvider |
| `handlePick(playerId, cardId)` | playing | Record a pick |
| `handlePlacement(playerId, x, y, direction)` | playing | Record a placement |
| `handleDiscard(playerId)` | playing | Record a discard |
| `pause()` | playing → paused | Suspend |
| `resume()` | paused → playing | Continue |

`beginRound()` and `endGame()` are **internal** — the engine drives them.

**Queries (reads):** `phase`, `players`, `currentRound`, `pickOrder`, `isMyTurn()`, `localCardToPlace()`, `localEligiblePositions()`, `hasLocalValidPlacement()`, `boardFor(playerId)`, `deal()`.

**Observe (events):**
```ts
session.events.on("pick:made", ({ player, cardId }) => { ... });
```

### Internal game loop

```
seed₀ = await seedProvider.nextSeed()       // determines pick order
emit game:started

while (remainingDeck not empty):
  seedₙ = await seedProvider.nextSeed()
  deal 4 cards
  await round:complete
  [if paused: suspend until resumed]

emit game:ended
```

### GameEvent: the complete typed vocabulary

```ts
type GameEvent =
  | { type: "game:started";   players: ReadonlyArray<Player>; pickOrder: ReadonlyArray<Player> }
  | { type: "round:started";  round: Round }
  | { type: "pick:made";      player: Player; cardId: CardId }
  | { type: "place:made";     player: Player; cardId: CardId; x: number; y: number; direction: Direction }
  | { type: "discard:made";   player: Player; cardId: CardId }
  | { type: "round:complete"; nextPickOrder: ReadonlyArray<Player> }
  | { type: "game:paused" }
  | { type: "game:resumed" }
  | { type: "game:ended";     scores: GameScore[] }
```

### Round sequencing

Players are processed **sequentially and interleaved** — pick then immediately place, before the next player picks. This is not batch (all pick then all place).

---

## PlayerActor: The Missing Abstraction

`IGameConnection` was a 1:1 binary pipe that hardcoded exactly two participants. It could not extend to 3–4 players, and it bundled four unrelated concerns: player identity, seed exchange, move transport, and control protocol.

The replacement: each player slot has exactly one **source of moves**, expressed as a `PlayerActor`:

| Actor | Source of moves |
|-------|----------------|
| `LocalPlayerActor` | UI input on this device |
| `CouchPlayerActor` | UI input, after a device-handoff step |
| `RemotePlayerActor` | Network messages from a peer |
| `AIPlayerActor` | Computed from board state |

The engine doesn't need to know how a move was produced. It just needs the move. Actor types encapsulate that knowledge; the engine and driver are entirely ignorant of actor implementations.

`LocalPlayerActor` and `CouchPlayerActor` are necessarily client-specific (coupled to the UI framework's input system). The others are in `kingdomino-protocol`.

---

## GameDriver: The Turn Loop

`GameDriver` drives actor decisions within each round. When the session starts a new round, the driver asks each actor for their pick and placement in turn order and feeds results back into the session. That's its entire job — nothing else.

The driver does **not** own the outer game loop. Deck generation, seed management, round creation, pause/resume, and game lifecycle all belong to `GameSession`. The driver is a pure turn-level coordinator, completely ignorant of how any actor works.

---

## RosterFactory: Assembling a Game Configuration

The lobby collects a player configuration — how many players, and what kind each is (local, couch, remote, AI). A `RosterFactory` takes that configuration and produces everything needed to start a game:

```ts
type RosterResult = {
  players: Array<{ id: PlayerId; actor: PlayerActor }>
  seedProvider: SeedProvider
}
```

`LobbyFlow` is completely ignorant of game mode specifics. New game modes (new AI difficulty, spectator slot, async-turn mode) are new factory implementations, not new branches in `LobbyFlow`.

### Seed provider selection

| Roster contains | Seed provider |
|-----------------|--------------|
| All local (local, couch, AI) | `RandomSeedProvider` |
| Any remote player | `CommitmentSeedProvider` |

---

## Trust Boundary and Seed Commitment

The commitment protocol prevents any participant from biasing the shared seed. It is only needed between **untrusted** participants.

| Actor type | Trust level | Rationale |
|------------|-------------|-----------|
| Local | Trusted | Same device, same operator |
| Couch | Trusted | Same device — cannot independently observe the seed |
| AI | Trusted | Locally computed, deterministic |
| Remote | **Untrusted** | Different device, different operator |

With N remote peers, the protocol generalises: each commits to a secret, all reveal, and the shared seed is derived from all secrets combined. No single party can bias the result without aborting.

---

## Object Ownership Hierarchy

```
Browser / PeerJS
  └─ App.tsx (React root)
        └─ store.ts (alien-signals reactive layer)
              ├─ roomSignal: Room           ← current UI screen
              ├─ sessionSignal: GameSession ← reference to engine session
              ├─ versionSignal              ← pulse: bumped on every engine event → triggers re-render
              └─ Promise resolver queues    ← UI intent signals
                    │
                    ▼ (adapter bridge)
            AppFlowAdapter (implements FlowAdapter)
                    │
                    ▼ (injected)
            LobbyFlow (orchestrator — owns game lifecycle)
              ├─ FlowAdapter (injected)
              ├─ RosterFactory (injected; produces PlayerActors + SeedProvider)
              ├─ GameDriver (subscribes to round:started, drives actor decisions)
              └─ GameSession (from kingdomino-engine; owns game loop, seeds, rounds)
                    ├─ GameEventBus (typed pub/sub)
                    ├─ Player[] → Board (per player)
                    └─ SeedProvider
```

### UI ↔ Engine communication

**UI → Engine** (via Promise resolver queues in store.ts):
```
Button click → triggerLobbyStart(config)
  → resolves lobbyStartResolvers[] with RosterConfig
  → LobbyFlow.awaitLobbyStart() continues
  → rosterFactory.build(config) → session.startGame()
```

**Engine → UI** (via GameEventBus → signals):
```
session.handlePlacement()
  → fires "place:made" event
  → store.ts listener bumps versionSignal
  → React useApp() hook sees new version → re-render
```

React components read live game state directly off `session` via `getCurrentSession()`. The signal is an invalidation ping, not a state container.

---

## Disconnection Handling by Layer

Disconnection means different things at different stages:

| Stage | Who detects | Who decides outcome |
|-------|-------------|---------------------|
| Pre-game (lobby/factory) | `RosterFactory.build()` rejects | `LobbyFlow` → return to lobby |
| In-game, move transport | `RemotePlayerActor` rejects | `GameDriver` surfaces to `LobbyFlow` |
| In-game, control channel | `ControlChannel` signals | `LobbyFlow` → end or error state |
| Clean exit (by peer choice) | `ControlChannel` receives exit request | `LobbyFlow` → agreed teardown |

No single module handles all disconnection cases. Each module handles exactly the disconnection it can observe.

---

## Signaling Server Role

The server runs a PeerJS server (WebRTC signaling) and advertises via mDNS so clients reach it at `kingdomino.local` without internet. The moment two clients have each other's peer IDs, the server's involvement ends. All game messages are direct peer-to-peer WebRTC. The server never sees game messages.

The lobby phase is a **signaling phase**, not a game phase. Its job:
1. Register this client with the PeerJS server (receive a peer ID)
2. Discover other waiting clients
3. Establish direct WebRTC connections
4. Hand live connections to `RosterFactory`

Player IDs in the game engine are PeerJS peer IDs — they originate from the signaling layer and flow into the roster. The lobby is the single place where "network peer" and "game player" are equated.

For all-local games (solo, couch, AI), no signaling server contact is required. The factory generates synthetic player IDs locally.

---

## Open Application-Layer Seams

These are genuine client app concerns that packaging alone cannot solve:

| Priority | Seam | Pattern to apply |
|----------|------|------------------|
| 1 | **UI directly calls session mutation methods** — components reach into `GameSession` bypassing any interceptor | `GameCommands` dispatch interface: `pick()`, `place()`, `discard()` |
| 2 | **Global resolver arrays in store.ts** — 5 mutable `resolve[]` arrays as async bridges between clicks and flow logic | `UIIntentBus` event emitter: flow subscribes, UI emits |
| 3 | **Inconsistent subscription cleanup** — some `off()` calls captured, others not, causing listener accumulation on restart | `SubscriptionScope`: all subscriptions added to a scope, one `disposeAll()` on teardown |
| 4 | **Phase state triplicated** — `GamePhase` (engine) → `FlowPhase` (orchestration) → `Room` (UI) kept in sync manually | Single source of truth (engine) with pure projection functions |
| 5 | **Components check global room state** — leaf components read `room === GameRoom` to decide interactivity | Prop/context capability flag passed from parent `<GameScreen>` |

---

## Code Conventions

**TypeScript:**
- Minimize explicit type annotations; prefer inference
- Named exports only — no default exports
- One primary responsibility per file

**OOP vs. pure functions:**
- **Classes** for game state: sessions, rounds, players, connections, flow orchestration
- **Pure functions** for game logic: card manipulation, board scoring, deck operations, seed/order calculations

**No magic strings between packages:** the owner of a string used as a key must export it for consumers.

---

## Testing Strategy

**Unit tests** (`*.test.ts`): pure game logic — scoring, placement validation, deck operations. Use `RandomSeedProvider` for deterministic seeds.

**Integration/flow tests** (`state/*.test.ts`): use `TestConnection` (in `kingdomino-protocol`) for scripted deterministic scenarios. No network, no React.

**Visual TDD** (`*.stories.tsx`): Storybook stories with `play()` functions assert on real rendered DOM. `RealGameRuleHarness` wraps `GameSession` + `TestConnection` to run full game flows through the real UI.

**Brittleness is a feature** for integration stories. If a story fails because the game no longer proceeds correctly through lobby → pick → place → scoring, that failure is desirable — the story is providing high-friction confirmation that the end-to-end system works. Do not paper over failures with abstraction.

**Storybook/UI rule:** production components must not contain Storybook-specific branches. All scenario configuration belongs in story support code.

**Error policy:** invalid scripted moves from `TestConnection` should fail immediately. Missing scenario setup should fail immediately. Story helpers must not silently repair broken state.
