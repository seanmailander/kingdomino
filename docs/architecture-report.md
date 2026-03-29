# Kingdomino: Data Flow & Architecture Report

_Generated from codebase exploration, March 2026_

---

## 1. System Overview

Kingdomino is a peer-to-peer browser board game. The server handles only signaling (WebRTC/mDNS discovery). All game logic, state, and trust live in client code. Two browsers play directly against each other — neither is authoritative over the other, which drives most of the architectural choices below.

The client is organized in three strict layers, with a one-way dependency rule:

```
visuals/   ← React components, Storybook stories
    ↓
state/     ← OOP orchestration: GameSession, LobbyFlow, connections
    ↓
gamelogic/ ← Pure functions: deck, scoring, placement validation, seed utils
```

Three packages have been extracted into `packages/`: `chacha-rng` (deterministic RNG), `kingdomino-engine` (pure game domain), and `kingdomino-commitment` (seed commitment protocol). The analysis of what remains to be extracted, and what should stay in the client, is in Section 9.

---

## 2. Where Key Data Lives

### 2.1 Player ID (`PlayerId = string`)

| Aspect         | Detail                                                                        |
| -------------- | ----------------------------------------------------------------------------- |
| **Defined**    | `packages/kingdomino-engine/src/types.ts`                                     |
| **Created**    | Connection layer: `connection.peerIdentifiers.me` (PeerJS assigns peer IDs)   |
| **Owned**      | `Player` class holds it as `readonly id: PlayerId`                            |
| **Registered** | `GameSession._players[]` via `addPlayer()` during lobby phase                 |
| **Shared**     | Passed in all wire messages (`PickMessage`, `PlaceMessage`, `DiscardMessage`) |

The player ID is the PeerJS-assigned peer ID — it originates outside the game engine, from the network layer. This creates an implicit coupling: player identity is transport-derived, not game-generated.

### 2.2 Cryptographic Seed

The seed drives fair shuffling. Neither player can manipulate it unilaterally because of a commitment protocol:

```
Player A:  commit(Ra) → send Ha = H(Ra)
Player B:  commit(Rb) → send Hb = H(Rb)
           ← await both commitments
Player A:  reveal Ra
Player B:  reveal Rb  (verify: H(Rb) == Hb)
Shared:    seed = H(Ra || Rb)  [deterministic, same both sides]
```

| Aspect               | Detail                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------- |
| **Interface**        | `SeedProvider { nextSeed(): Promise<string> }`                                          |
| **Solo impl**        | `RandomSeedProvider` — local random hex, no exchange needed                             |
| **Multiplayer impl** | `CommitmentSeedProvider` — runs the commitment protocol over the wire                   |
| **Wire messages**    | `COMMITTMENT { committment: string }` / `REVEAL { secret: string }`                     |
| **Owned by**         | `GameSession` holds a reference; seed is consumed per-round in `_runGameLoop()`         |
| **Scope**            | One seed per round (re-committed every 4-card deal to prevent future-knowledge attacks) |

The seed is ephemeral — it's consumed to shuffle the deck, never stored long-term.

### 2.3 Board Placements

| Aspect         | Detail                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| **Type**       | `BoardPlacement = { card: CardId; x: number; y: number; direction: Direction }`                        |
| **Storage**    | `Board._placements: BoardPlacement[]` (append-only history) + `Board._board: 13×13 grid`               |
| **Owned by**   | Each `Player` owns exactly one `Board` instance                                                        |
| **Mutated by** | `GameSession.handlePlacement()` → `player.applyPlacement()` → `board.place()`                          |
| **Read by**    | `board.snapshot()` for visuals/AI; `board.score()` for scoring; `board.isCastleCentered()` for bonuses |

### 2.4 Deck State

| Aspect       | Detail                                                                            |
| ------------ | --------------------------------------------------------------------------------- |
| **Type**     | `CardId[]` (numbers)                                                              |
| **Owned by** | `GameSession._remainingDeck` (private) — sole owner                               |
| **Created**  | `generateDeck()` on `startGame()`                                                 |
| **Consumed** | 4 cards per round via `getNextFourCards(seed, remainingDeck)` in `_runGameLoop()` |
| **Exposed**  | Never directly; only the current round's `Deal` (4 slots) is visible externally   |

### 2.5 Game Phase

Phase state is mirrored at three layers — a key source of fragility:

| Layer         | Type                                                           | Owner                               |
| ------------- | -------------------------------------------------------------- | ----------------------------------- |
| Engine        | `"lobby" \| "playing" \| "paused" \| "finished"`               | `GameSession._phase`                |
| Orchestration | `"splash" \| "lobby" \| "game" \| "paused" \| "ended"`         | `LobbyFlow` (implicit, via adapter) |
| UI            | `"Splash" \| "Lobby" \| "Game" \| "GamePaused" \| "GameEnded"` | `store.ts` `roomSignal`             |

These three phase spaces are manually kept in sync through the `FlowAdapter` translation layer.

### 2.6 Current Round State

| Object        | Owns                              | Type                                           |
| ------------- | --------------------------------- | ---------------------------------------------- |
| `GameSession` | `_currentRound`                   | `Round \| null`                                |
| `Round`       | `_deal`, `_phase`, `_playerQueue` | Phase + 4-card deal + remaining-to-place queue |
| `Deal`        | `_slots[]`                        | `{ cardId, pickedBy: Player \| null }[]`       |

---

## 3. Object Ownership Hierarchy

```
Browser / PeerJS
  └─ App.tsx (React root)
        └─ store.ts (alien-signals reactive layer)
              ├─ roomSignal: Room           ← current UI screen
              ├─ sessionSignal: GameSession ← reference to engine session
              ├─ gameOverScoresSignal       ← final scores
              ├─ versionSignal              ← pulse: bumped on every engine event → triggers React re-render
              └─ Promise resolver queues    ← UI intent signals (pause, exit, lobby start/leave)
                    │
                    │  (adapter bridge)
                    ▼
           AppFlowAdapter (implements FlowAdapter)
                    │
                    │  (injected)
                    ▼
           LobbyFlow (orchestrator — owns game lifecycle)
              ├─ FlowAdapter (injected: AppFlowAdapter in prod, mock in tests)
              ├─ IGameConnection (injected/created)
              │     ├─ SoloConnection
              │     │     └─ RandomAIPlayer
              │     │           └─ GameSession (shadow/mirror — AI perspective)
              │     ├─ MultiplayerConnection  [stub — not yet wired]
              │     └─ TestConnection         [scripted scenario for testing]
              │
              ├─ ConnectionManager (thin protocol adapter over IGameConnection)
              │     ├─ sendPick / sendPlace / sendDiscard / sendDiscard
              │     ├─ waitForNextMoveMessage()
              │     └─ sendPauseRequest / waitForPauseAck / etc.
              │
              └─ GameSession (from kingdomino-engine)
                    ├─ localPlayerId: PlayerId
                    ├─ _phase: GamePhase
                    ├─ _remainingDeck: CardId[]
                    ├─ _pickOrder: Player[]
                    ├─ _currentRound: Round | null
                    │     └─ Deal
                    │           └─ PickSlot[] (4 per round)
                    ├─ GameEventBus
                    │     └─ typed pub/sub: game:started, round:started, pick:made,
                    │                       place:made, discard:made, round:complete,
                    │                       game:paused, game:resumed, game:ended
                    ├─ Player[] (registered during lobby)
                    │     └─ Board (per player)
                    │           ├─ _placements: BoardPlacement[]
                    │           └─ _board: 13×13 BoardGrid
                    └─ SeedProvider
                          ├─ RandomSeedProvider (solo)
                          └─ CommitmentSeedProvider (multiplayer, uses IGameConnection transport)
```

### UI↔Engine Communication Boundary

**UI → Engine** (via Promise resolver queues in store.ts):

```
Button click in Lobby component
  → triggerLobbyStart()  [store.ts]
  → resolves lobbyStartResolvers[] promise
  → LobbyFlow.awaitLobbyStart() continues
  → session.startGame()
```

**Engine → UI** (via GameEventBus → signals):

```
session.handlePlacement()
  → fires "place:made" event
  → store.ts listener bumps versionSignal
  → React useApp() hook sees new version
  → components re-render reading session.currentRound etc.
```

React components read live game state directly off `session` (via `getCurrentSession()`) — they do not receive game state as props. The signal acts as an invalidation ping, not a state container.

---

## 4. Coupling Seams That Should Be Separated

### Seam 1: Phase State Triplicated Across Three Layers

**Problem:** `GamePhase` (engine) → `FlowPhase` (orchestration) → `Room` (UI) are three separate enumerations kept manually in sync through `AppFlowAdapter`. Any new game state (e.g., "spectating", "reconnecting") requires changes in all three places.

**Pattern to apply: Single source of truth with projections**

The engine's `GamePhase` should be the authoritative source. The other two are _projections_ — computed views of that single truth. The adapter translation (`phaseToRoom`) should be a pure function, not mutable bridging code.

```typescript
// Proposed
interface PhaseProjection<T> {
  project(phase: GamePhase): T;
}
// AppFlowAdapter becomes a pure projection, not a mutable bridge
```

---

### Seam 2: Visual Components Directly Call `session.handleLocalPick()` etc.

**Problem:** React components in `visuals/` directly call mutation methods on `GameSession`. This makes the UI a direct actor in the game state machine, bypassing any opportunity to intercept, validate, log, or replay commands.

**Pattern to apply: Command object / dispatch layer**

Introduce a thin `GameCommands` interface that components dispatch to. The session (or a middleware in front of it) executes commands. This is the same boundary that Redux enforces with actions, or that domain-driven design calls the "application service layer."

```typescript
interface GameCommands {
  pick(cardId: CardId): void;
  place(x: number, y: number, direction: Direction): void;
  discard(): void;
}
```

Visual components depend only on `GameCommands` (a narrow contract), not `GameSession` (a wide object).

---

### Seam 3: Player Identity is Transport-Derived

This seam dissolves naturally once a dedicated lobby package is responsible for peer discovery. The lobby produces named connections; player identity flows from the lobby layer, not from the transport. The engine receives player IDs as plain values and never knows their origin.

See Section 9.5 (`kingdomino-lobby`) and Section 9.9 for full treatment.

---

### Seam 4: `SeedProvider` Transport Coupling in `CommitmentSeedProvider`

This seam is already largely resolved. The `kingdomino-commitment` package defines a narrow `CommitmentTransport` interface, and the commitment protocol depends only on that interface — not on `IGameConnection` or any lobby/transport code.

See Section 9.2 (`kingdomino-commitment`) and Section 9.9 for how this fits the full package map.

---

### Seam 5: `RandomAIPlayer` Creates Its Own `GameSession` (No Injection)

The shadow-`GameSession` pattern in `RandomAIPlayer` is an artefact of the 1:1 `IGameConnection` model. Under the `PlayerActor` model proposed in Section 8.2, an AI actor is a stateless strategy object that receives a game snapshot and returns a move — no internal session required. This becomes a first-class type in the protocol package.

See Section 8.2 (`AIPlayerActor`) and Section 9.4 (`kingdomino-protocol`) for full treatment.

---

### Seam 6: `LobbyFlow` Knows About `SoloConnection`, `RandomAIPlayer`, and Their Construction

This seam — and the `ConnectionFactory` pattern originally proposed here — is superseded by the deeper mixed-game-mode analysis. `LobbyFlow`'s construction responsibility is split across `RosterFactory` (which produces a typed roster of `PlayerActor` objects) and a lobby package that handles peer discovery. `LobbyFlow` itself becomes a thin consumer of both.

See Section 8.4 (`RosterFactory`), Section 9.4 (`kingdomino-protocol`), Section 9.5 (`kingdomino-lobby`), and Section 9.9 for full treatment.

---

### Seam 7: Global Mutable Resolver Arrays in `store.ts`

**Problem:** Five separate `Array<resolve fn>` arrays act as async bridges between UI intent (button clicks) and game flow logic. They are global mutable state: any module can push resolvers, `resetAppState()` manually clears them, and there is no central registry of pending promises.

**Pattern to apply: Event emitter (or reactive subject) for UI intents**

```typescript
interface UIIntentBus {
  on(
    intent:
      | "lobby:start"
      | "lobby:leave"
      | "pause"
      | "resume"
      | "exit-confirmed"
      | "exit-cancelled",
    cb: () => void,
  ): () => void;
  emit(intent: string, payload?: unknown): void;
}
```

`LobbyFlow` subscribes to `UIIntentBus` events instead of awaiting arbitrary promises. This is a clean inversion: the flow listens to the UI, rather than the UI resolving the flow's internal promises. Cleanup is a single `off()` call, not manual array clearing.

---

### Seam 8: Inconsistent Event Subscription Cleanup

**Problem:** In `LobbyFlow`, some event subscriptions capture and call the `off()` unsubscribe function; others (notably AI event subscriptions) do not. This creates listener accumulation if a game session is restarted.

**Pattern to apply: Lifecycle-scoped subscription registry**

```typescript
class SubscriptionScope {
  private subs: Array<() => void> = [];
  add(unsub: () => void): void {
    this.subs.push(unsub);
  }
  disposeAll(): void {
    this.subs.forEach((fn) => fn());
    this.subs = [];
  }
}
```

Every subscription in `LobbyFlow` goes through a scope object. On game teardown, one `scope.disposeAll()` call cleans everything up. This pattern is similar to RxJS `Subscription` or Angular's `takeUntil`.

---

### Seam 9: Visual Components Import `store.ts` for Room-Guard Logic

**Problem:** Every component checks `room === GameRoom` to decide if it should be interactive (e.g., `Card` disables click handlers when not in the "Game" room). This embeds display-mode logic in every leaf component and couples them all to the global store shape.

**Pattern to apply: Context/prop-based capability flags**

Components shouldn't need to know the global room state. A parent `<GameScreen>` can pass `interactive={room === GameRoom}` down the tree, or a `<InteractivityContext>` can provide a flag. Leaf components receive the capability as a prop or context value — they don't reach into global state.

---

### Seam 10: No Move Source Differentiation (Local vs. Remote vs. AI)

This seam dissolves under the `PlayerActor` model. Each actor type — `LocalPlayerActor`, `CouchPlayerActor`, `RemotePlayerActor`, `AIPlayerActor` — produces moves through its own path. Move origin is encoded in which actor type submitted the move, visible at construction time rather than by inspecting the move itself.

See Section 8.2 (`PlayerActor` model) and Section 9.4 (`kingdomino-protocol`) for full treatment.

---

## 5. Proposed Module Relationship Map

This section's original content — a four-layer diagram showing engine → commitment → state → visuals — was written before the full package analysis. It is superseded by the complete five-package map in Section 9.8, which also accounts for the protocol, lobby, and actor model layers that the earlier diagram omitted.

See Section 9.8 for the authoritative module relationship map.

---

## 6. Priority Order for Reducing Coupling

Seams 3, 4, 5, 6, and 10 dissolve naturally through the package restructuring described in Sections 8 and 9. The remaining seams are genuine application-layer concerns that belong in the client and must be addressed there directly.

| Priority        | Seam                                      | Pattern                           | Benefit                                           |
| --------------- | ----------------------------------------- | --------------------------------- | ------------------------------------------------- |
| **1 — Highest** | Seam 2: UI directly calls session methods | `GameCommands` dispatch layer     | Enables logging, undo, replay, testing            |
| **2**           | Seam 7: Global resolver arrays            | `UIIntentBus` event emitter       | Eliminates hidden async state, simplifies cleanup |
| **3**           | Seam 8: Inconsistent subscription cleanup | `SubscriptionScope`               | Eliminates memory leaks, clarifies teardown       |
| **4**           | Seam 1: Phase triplicated across layers   | Single source + pure projections  | Eliminates sync bugs on new phase additions       |
| **5**           | Seam 9: Components check room state       | Prop/context capability flag      | Makes components reusable in Storybook and tests  |
| —               | Seams 3, 4, 5, 6, 10                      | Resolved by package restructuring | See Sections 8 and 9                              |

---

## 7. Summary

This section summarises the initial analysis of the codebase's coupling problems. The full picture — including the proposed package restructuring that resolves seams 3, 4, 5, 6, and 10 — is in Sections 8 and 9. The points below remain accurate as a description of the current state and the client-app concerns that packaging alone cannot solve.

The codebase has a well-conceived three-layer architecture (visuals / state / gamelogic) and a strong foundation in the three extracted packages. The primary coupling problems that remain in the client application are:

1. **The React UI and the game engine are not cleanly separated** — components reach into live game objects and call mutation methods rather than dispatching commands through a narrow interface (Seam 2).

2. **Phase state is duplicated three times** across the engine, orchestration, and UI layers, requiring manual synchronization (Seam 1).

3. **The store's async coordination model** (resolver arrays) is fragile global mutable state that should be replaced with an explicit intent event bus (Seam 7), with inconsistent subscription cleanup as a companion problem (Seam 8).

4. **Visual components check global room state** to decide interactivity, coupling them to the store shape and making them harder to reuse in isolation (Seam 9).

For the structural concerns — how game modes are assembled, how player identity flows, how move sources are distinguished, and how the commitment protocol is wired up — see Sections 8 and 9.

---

## 8. Deep Dive: Seam 6 and Mixed Game Modes

_This section explores what Seam 6 would need to become in order to support lobby-configurable game modes: 2–4 players, any mix of local, couch-local, remote, and AI._

### 8.1 The Root Problem: `IGameConnection` Is the Wrong Unit

The original Seam 6 framing was "LobbyFlow constructs connections directly — fix it with a `ConnectionFactory`." But looking at mixed game modes reveals a deeper structural mismatch.

`IGameConnection` is a **1:1 binary pipe**. It hardcodes exactly two participants (`me` and `them`). Solo mode works by pretending the AI is a peer at the other end of this pipe. This holds for 2-player games but cannot extend to 3 or 4 players — "exactly one opponent" is baked into the identity model.

More importantly, `IGameConnection` bundles four unrelated concerns into one interface:

| Concern              | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| **Player identity**  | Who the two participants are                               |
| **Seed exchange**    | Cryptographic commitment/reveal protocol                   |
| **Move transport**   | Delivering picks, placements, and discards for all players |
| **Control protocol** | Pause, resume, and exit handshakes                         |

These concerns have different lifetimes, different participants, and different reasons to change. Bundling them is what makes the factory approach insufficient on its own — you can't just swap out the whole connection for a different game mode; you need to compose independent pieces.

### 8.2 The Missing Abstraction: Per-Player Actor

In any game configuration, each player slot has exactly one source of moves:

- A **local player** produces moves from UI input on this device
- A **couch player** also produces moves from UI input, but only after a device-handoff step
- A **remote player** produces moves arriving over the network
- An **AI player** produces moves computed from board state

These are four implementations of the same contract: given "it's your turn, here are your options, produce a move." This **PlayerActor** contract is the missing unit of abstraction. It replaces the entire `IGameConnection` concern of "how does the non-local player move."

The key insight: the game engine doesn't need to know how a move was produced. It just needs the move. Encapsulating the source of each player's moves behind a uniform per-player interface is what makes mixed configurations composable.

### 8.3 The Turn Driver: Replacing Ad-Hoc Event Wiring

Currently, `LobbyFlow` has a tangle of event subscriptions to relay moves from various sources into the session — local pick handlers, remote move listeners, AI round-start hooks. These are all doing the same thing in different ways: asking a source for the next move and feeding it into the engine.

A **GameDriver** module formalises this. It owns a `GameSession` and a map of player IDs to their actors. It drives the game loop by asking each actor for their move in turn order and feeding the results into the session. This is the entire job — there is no other logic in the driver.

This replaces `LobbyFlow`'s scattered subscriptions with one explicit, readable ownership relationship: the driver owns the turn sequence, and the actors own the move production. The driver is completely ignorant of how any actor works.

### 8.4 The Roster: What a Factory Needs to Produce

The lobby collects a player configuration: how many players, and what kind each one is (local, couch, remote, AI). A **RosterFactory** takes that configuration and produces everything needed to start a game:

- A list of players, each with their assigned actor
- A seed provider (random for all-local games; commitment-based if any remote player is present)
- A control channel (only needed when a remote peer is present)

`LobbyFlow` hands the selection to the factory and receives the roster back. It creates the session, registers the players, hands the roster to the driver, and starts the game. `LobbyFlow` is now completely ignorant of game mode specifics.

New game modes — a new difficulty of AI, a spectator slot, an async-turn mode — are new factory implementations, not new branches in `LobbyFlow`.

### 8.5 Seed Commitment and the Trust Boundary

The purpose of the commitment protocol is to prevent any participant from biasing the shared seed after seeing what others have committed to. The protocol is only needed between **untrusted** participants.

This maps cleanly onto actor types:

| Actor type | Trust level   | Rationale                                                                       |
| ---------- | ------------- | ------------------------------------------------------------------------------- |
| Local      | Trusted       | Same device, same operator                                                      |
| Couch      | Trusted       | Same device — couch players cannot independently observe or manipulate the seed |
| AI         | Trusted       | Locally computed, deterministic — no separate agency                            |
| Remote     | **Untrusted** | Different device, different operator, could behave adversarially                |

The rule for seed selection therefore becomes: **use the commitment protocol if and only if the roster contains at least one remote actor.** All-local rosters (any combination of local, couch, and AI) use a simple local random source because there is no untrusted party to commit against.

In a 4-player all-remote game, the commitment protocol must still produce a seed that no single participant could have biased. With N remote peers, the commitment scheme generalises: each participant commits to their secret, all reveal, and the shared seed is derived from all secrets combined. No single party can influence the result without aborting the protocol. The 2-party case (local vs. one remote) is just the simplest instance of this.

The factory determines which seed provider to create based solely on whether the roster contains any remote slots — and if so, how many. Nothing outside the factory needs to reason about this.

### 8.6 Couch Mode: A Solved Problem Once the Abstraction Is Right

Couch mode is often presented as a hard problem (two people, one screen), but under the per-player actor model it is a simple specialisation of the local actor. A couch actor differs from a local actor in exactly one way: before accepting input, it pauses and signals the UI to show a handoff screen ("Pass the device to Player 2").

That signal is a narrow interface between the orchestration layer and the UI — the actor just says "I need a handoff" and waits. The UI decides what that looks like. Once acknowledged, the couch actor behaves identically to a local actor. Multiple couch players share the same input channel; only the handoff trigger differs between them.

No special-casing in `LobbyFlow`, no new game phase, no changes to the engine.

### 8.7 How the Module Relationships Change

**Current structure** — everything coupled through `IGameConnection`:

```
LobbyFlow
  ├─ creates: SoloConnection (bundles AI + seed + moves + control)
  ├─ creates: RandomAIPlayer (owns its own shadow GameSession)
  └─ wires:   scattered event subscriptions to relay moves
```

**Proposed structure** — concerns separated, composed at the factory:

```
LobbyFlow
  depends on: RosterFactory (interface), GameDriver (module), FlowAdapter (interface)
  knows nothing about: actor types, seed protocol, connection details

RosterFactory (interface, N implementations)
  each implementation composes: PlayerActor(s) + SeedProvider + optional ControlChannel

GameDriver
  depends on: GameSession (engine API), PlayerActor (interface)
  knows nothing about: actor implementations, connection, UI, React

PlayerActor (interface, 4 implementations)
  Local   — bridges UI input commands to the driver's turn request
  Couch   — same as Local, plus a HandoffGate (narrow UI interface) before each turn
  Remote  — bridges incoming network messages to the driver's turn request
  AI      — manages local state to determine next moves
```

The dependency arrows are all inward toward interfaces, never outward toward concrete implementations. The factory is the only module that touches concrete classes — and it exists precisely to encapsulate that construction knowledge.

### 8.8 What This Unlocks

| Capability                | Why it becomes possible                                                      |
| ------------------------- | ---------------------------------------------------------------------------- |
| 3- or 4-player games      | `GameDriver` iterates over N actors; engine is already player-count agnostic |
| Couch mode                | New `CouchActor` implementation; nothing else changes                        |
| Mixed AI + remote         | Roster has multiple actor types; driver treats them identically              |
| New AI strategies         | AI actor could have new strategies or variants                               |
| Testing any configuration | `TestRosterFactory` produces scripted actors with no network or UI           |
| Adding a spectator slot   | New actor type that produces no moves; driver skips it                       |

The key is that the driver and the engine are fully decoupled from the question "where do moves come from." That question belongs entirely to the actor layer, configured by the factory.

---

## 9. The Published Engine Lens

_This section evaluates the codebase through the lens of a set of published packages — asking which modules are universally applicable to any Kingdomino client and which are one-off specialisations for this particular browser app._

### 9.1 The Universality Test

The question to ask of every module: **would a completely different Kingdomino client need this?** Three consumer personas sharpen the answer:

**A bot client** — an automated player that connects to lobbies, participates in games, and generates moves programmatically. It has no UI. It needs to understand the game, speak the wire protocol, find peers, exchange seeds fairly, and produce moves from board state.

**An observer client** — a spectator that connects to an in-progress game and watches events unfold. It has no UI beyond display. Crucially, it produces no moves and participates in no seed commitment — it is not a game participant, only an audience member.

**An alternative UI client** — a native app, a terminal client, or a web app built with a different framework. It needs everything the browser client needs except React components and the alien-signals store. It would implement its own `LocalPlayerActor` against its own input system.

Any module that all three consumers need is a universal published package. Anything that only one or two need is a narrower concern. Anything specific to one client's tech stack stays in that client.

### 9.2 What the Three Existing Packages Got Right

The monorepo already has three packages extracted, and their boundaries are well-drawn:

**`chacha-rng`** — a cryptographically-sound deterministic RNG. Zero Kingdomino-specific knowledge. Zero dependencies. Any game (or any application needing a seeded PRNG) could use this. Its package boundary is already correct and complete.

**`kingdomino-engine`** — the pure game domain: rules, board, cards, deck, rounds, deals, scoring, the game session state machine, and the event bus. It depends only on `chacha-rng` for shuffling. It has no network, no UI, no async protocol concerns. All three consumer personas need this package; it is the most universal artefact in the system.

**`kingdomino-commitment`** — the cryptographic seed commitment protocol. It depends on a narrow `CommitmentTransport` interface (four methods) and on the `SeedProvider` interface from the engine. It is correctly decoupled from any specific transport or connection type.

However, the observer persona immediately reveals a boundary question about this package: an observer does not participate in seed commitment at all. The commitment protocol is for game _participants_ — it is not universal to all clients. The bot and the alternative UI client need it; the observer does not. This is an important nuance: **commitment is a participant concern, not a game concern**.

### 9.3 The Gap: What Remains Locked Inside the Client

Everything in `client/src/game/state/` is currently trapped in the client application, yet most of it is universally needed. This directory contains:

| File                        | Universal?             | Reason                                                                                                                                                                                            |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game.messages.ts`          | **Yes**                | Defines the wire vocabulary (PICK, PLACE, DISCARD, COMMITTMENT, REVEAL, control messages) — any two Kingdomino clients must speak the same protocol                                               |
| `ConnectionManager.ts`      | **Yes**                | Typed protocol adapter over raw send/receive — any client communicating with peers needs this                                                                                                     |
| `connection.multiplayer.ts` | **Yes**                | The WebRTC peer transport — any client connecting to a remote peer uses this                                                                                                                      |
| `ai.player.ts`              | **Yes** (in principle) | Move generation from board state — a bot, a solo game, or a mixed game all need AI-driven moves; the current implementation has coupling problems (shadow session) but the _concern_ is universal |
| `game.flow.ts`              | **No**                 | App-specific orchestration tightly coupled to `FlowAdapter`, resolver arrays, and the React store                                                                                                 |
| `connection.solo.ts`        | **No**                 | A legacy seam: pretends the AI is a remote peer to satisfy the 1:1 `IGameConnection` abstraction; belongs to the current architecture's workarounds, not to any future package                    |
| `connection.testing.ts`     | **No** (as-is)         | Tied to the current `IGameConnection` shape; under the actor model this becomes a `TestRosterFactory` producing scripted actors, useful as a test utility in the protocol package                 |

The most egregious misplacement is `game.messages.ts`. The wire protocol definition is the shared vocabulary that makes two Kingdomino clients interoperable. A bot author needs to know these message types. An observer needs to receive and decode them. Yet the definition currently lives deep inside a single client application.

### 9.4 A Fifth Package: The Participation Protocol

The three existing packages handle the _game domain_ and _cryptographic fairness_. What they do not cover is the _shared language and mechanics of participating in a game over a network_. This is a distinct concern that deserves its own package.

Call it `kingdomino-protocol`. Its contents would be drawn from what is currently scattered in `client/src/game/state/`:

- **Wire message types** — the complete vocabulary of all messages exchanged between any two Kingdomino clients (currently `game.messages.ts`)
- **ConnectionManager** — the typed adapter that turns raw send/receive into typed game-move operations (currently `ConnectionManager.ts`)
- **The `PlayerActor` interface** — the contract for anything that can produce moves for a player slot (proposed in Section 8)
- **`RemotePlayerActor`** — the universal implementation for receiving moves from a network peer (proposed; derived from `connection.multiplayer.ts`)
- **`GameDriver`** — the explicit turn-loop runner that asks actors for moves and feeds them into the engine (proposed in Section 8.3)

This package depends on `kingdomino-engine` (for game types) and has no dependency on `kingdomino-commitment` (seed exchange is separate from move exchange). A bot author would install `kingdomino-engine` + `kingdomino-commitment` + `kingdomino-protocol` and have everything needed to play autonomously. An observer would install `kingdomino-engine` + `kingdomino-protocol` and omit commitment entirely.

### 9.5 A Sixth Package: Lobby and Peer Discovery

The signaling server (`server/`) currently handles PeerJS peer brokering and mDNS advertisement. The client side of this — connecting to the PeerJS server, registering as available, discovering peers, and establishing WebRTC connections — is currently unimplemented (the multiplayer button is explicitly disabled).

This lobby/discovery concern is universal. A bot needs to find games to join. An observer needs to find games to watch. An alternative UI client needs to find peers. None of these are specific to the React browser app.

A `kingdomino-lobby` package would encapsulate:

- PeerJS client initialisation and registration (obtaining a peer ID from the signaling server)
- Peer discovery (finding other available players via the server's matchmaking endpoint)
- WebRTC connection establishment (producing live transport objects that satisfy `CommitmentTransport` and the `RemotePlayerActor`'s transport needs)

This package is the bridge between "I know the server address" and "I have a live, named connection to another player." Everything upstream (seed exchange, game loop, moves) happens after this package's job is done.

The boundary is clean: the lobby package produces connections; the protocol package uses them; the engine processes the resulting moves. The lobby package has no game logic. The engine has no network awareness.

### 9.6 What Must Stay Client-Specific

After the five universal packages, three things genuinely belong in the client application and nowhere else:

**`LocalPlayerActor`** — how the local human produces moves. This is necessarily coupled to the UI framework's input system. A React app awaits a click event. A terminal app awaits a keystroke. A native app awaits a touch. The _interface_ is universal (it is `PlayerActor`); the implementation is framework-specific.

**`CouchPlayerActor`** — the same as `LocalPlayerActor`, plus the `HandoffGate` — an interface to the UI layer that shows a "pass the device" screen. Both the actor and the gate are specific to a shared-screen UI client.

**`LobbyFlow`, `AppFlowAdapter`, and `store.ts`** — the application-specific state machine that connects a browser React app's room signals and resolver arrays to the game lifecycle. These are framework and app-specific glue. A bot has no lobby flow; it directly builds a roster and starts driving. An alternative UI client would write its own equivalent.

### 9.7 `SoloConnection` Should Not Be Extracted

`SoloConnection` currently pretends the AI is a remote peer at the other end of a 1:1 `IGameConnection`. This is an architectural workaround for the fact that the game loop was designed around exactly one opponent reached via one connection. Under the actor model (Section 8), this fiction is unnecessary: the AI is simply an `AIPlayerActor` in the roster alongside any other actors. `SoloConnection` is not a candidate for packaging — it is a seam to be retired when the actor model is adopted.

### 9.8 The Full Package Map

```
chacha-rng  (zero deps)
  └── no Kingdomino knowledge; pure RNG algorithm

kingdomino-engine  (depends on: chacha-rng)
  └── game domain: rules, board, cards, session, events
      consumed by: all clients, bots, observers, and the engine tests themselves

kingdomino-commitment  (depends on: kingdomino-engine)
  └── seed commitment protocol for untrusted participants
      consumed by: game participants only (not observers)

kingdomino-protocol  (depends on: kingdomino-engine)
  └── wire message vocabulary, ConnectionManager, PlayerActor interface,
      RemotePlayerActor, GameDriver interface
      consumed by: all active game clients (UI clients, bots)
      not needed by: observers (who receive but do not produce moves)

kingdomino-lobby  (depends on: kingdomino-protocol)
  └── PeerJS client, peer discovery, WebRTC connection establishment
      consumed by: any client that needs to find games on the network
      not needed by: tests using TestRosterFactory with scripted actors

──── everything above is published / universally reusable ────

client application  (depends on: all packages above)
  └── LocalPlayerActor  (couples PlayerActor to React input events)
      CouchPlayerActor  (adds HandoffGate for shared-screen play)
      LobbyFlow         (app-specific game lifecycle state machine)
      AppFlowAdapter    (bridges LobbyFlow to alien-signals store)
      store.ts          (reactive signals, resolver queues)
      React components  (visuals)
```

### 9.9 What This Framing Resolves

Viewing the codebase through the published-engine lens clarifies several seams identified in Section 4 that previously seemed like code-quality issues but are actually architectural misplacements:

- **Seam 3** (player ID from transport): naturally resolved — the lobby package produces named connections; identity originates there and flows into the roster, never from inside the engine
- **Seam 4** (CommitmentSeedProvider coupled to IGameConnection): naturally resolved — the commitment package depends on a narrow interface defined within it; the lobby package produces objects that satisfy that interface
- **Seam 6** (LobbyFlow constructs everything): naturally resolved — the lobby package produces connections; the protocol package provides the RosterFactory interface; LobbyFlow consumes both without knowing how peers were found or how actors are wired
- **Seam 10** (no move source differentiation): naturally resolved — moves arrive through typed actor interfaces; the origin (remote, AI, local) is encoded in which actor type produced the move, visible at construction time in the factory

The seams that remain — the global resolver arrays, inconsistent subscription cleanup, components reaching into session methods — are genuine application-layer concerns that belong in the client and should be addressed there.

### 8.9 Remote Player Discovery and the Lobby's Role

The signaling server plays a single, bounded role: it runs a PeerJS server (WebRTC signaling) and advertises itself on the local network via mDNS so clients can reach it at `kingdomino.local` without internet access. The moment two clients have each other's peer IDs, the server's involvement ends — all subsequent communication is direct peer-to-peer WebRTC. The server never sees game messages.

This means the **lobby phase is a signaling phase**, not a game phase. Its job is to:

1. Register this client's presence with the PeerJS server (receiving a peer ID in return)
2. Discover other waiting clients (browsing peers known to the PeerJS server)
3. Establish a direct WebRTC connection to selected peers
4. Hand those live connections off to the `RosterFactory`

In the proposed architecture, this maps cleanly to a **Lobby module** that is separate from both `LobbyFlow` (game orchestration) and `RosterFactory` (game setup). The Lobby module's responsibility is purely discovery and connection establishment. When the player confirms their selection ("play against this peer, plus one AI"), it calls `RosterFactory.build()` with the resolved peer connections and player-type configuration. The factory takes it from there.

Critically, **player IDs in the game engine are the PeerJS peer IDs** — they originate from the signaling layer and flow into the roster without transformation. The Lobby module is where that identity flows from the network into the game. This is the single place where "network peer" and "game player" are equated.

For all-local games (solo, couch, AI), no signaling server contact is required at all. The `RosterFactory` generates synthetic player IDs locally and the lobby phase is skipped entirely or reduced to a mode-selection screen.

### 8.10 Disconnection and Player Departure

Currently there is no explicit handling of a remote peer disconnecting mid-game. The WebRTC data channel closes silently and any pending `waitFor()` calls hang indefinitely. This is a known gap.

In the proposed architecture, responsibility for disconnection is distributed across three boundaries, each with a distinct concern:

**The RemotePlayerActor owns transport-level disconnect detection.**
A `RemotePlayerActor` is awaiting a move from its peer at any given moment. If the WebRTC channel closes, that await must reject rather than hang. The actor is the right place to detect this because it is the only module with a live reference to that peer's transport. When the actor's move-await rejects due to disconnection, the error propagates naturally to `GameDriver`, which is the caller.

**The GameDriver owns game-level failure handling.**
When an actor's `awaitPick()` or `awaitPlacement()` throws, the driver's turn loop fails. The driver should not attempt to recover — it doesn't have enough context to decide whether the game should end, pause, or wait for reconnection. Instead, it surfaces the failure to `LobbyFlow` through a cancellation or error signal. The driver's contract is "drive the game loop until it ends cleanly or a fatal error occurs."

**The ControlChannel owns in-game coordination around departure.**
When a remote peer leaves deliberately (via the exit handshake), the `ControlChannel` sees this first — it receives the `EXIT_REQUEST`. When a peer leaves uncleanly (connection drop), the `ControlChannel`'s transport also fails. In either case, the `ControlChannel` is the component that signals to `LobbyFlow` that a remote peer is gone. `LobbyFlow` then decides on the outcome — end the game, show an error, or attempt a grace period before cleanup.

**The lobby phase has its own disconnection concern.**
If a peer disappears between "selected in lobby" and "game start," that failure belongs to the `RosterFactory` — its `build()` promise rejects and `LobbyFlow` returns the UI to the peer-selection state. The game session was never created, so no game-level cleanup is needed.

The key structural point: no single module handles all disconnection cases, because disconnection means different things at different stages. The clean separation is:

| Stage                       | Who detects                            | Who decides outcome                  |
| --------------------------- | -------------------------------------- | ------------------------------------ |
| Pre-game (lobby/factory)    | `RosterFactory` build fails            | `LobbyFlow` → return to lobby        |
| In-game, move transport     | `RemotePlayerActor` rejects            | `GameDriver` surfaces to `LobbyFlow` |
| In-game, control channel    | `ControlChannel` signals               | `LobbyFlow` → end or error state     |
| Clean exit (by peer choice) | `ControlChannel` receives exit request | `LobbyFlow` → agreed teardown        |
