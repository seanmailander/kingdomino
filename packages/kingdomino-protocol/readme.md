# kingdomino-protocol

The wire protocol package. Defines the message vocabulary for peer-to-peer game communication and the actor interfaces that all player types must implement.

## Purpose

This package is the shared language that lets game participants talk to each other. It defines what messages flow over the network, how moves are requested and delivered, and what contract any entity that plays the game must satisfy — whether that entity is a local human, a remote peer, or a bot.

## Scope

- **Wire message vocabulary** — typed message definitions for every game event transmitted over a WebRTC data channel (picks, placements, control messages, acknowledgements)
- **PlayerActor interface** — the contract any player source must satisfy: `awaitPick()`, `awaitPlacement()`, and lifecycle hooks; decouples `GameDriver` from knowing whether moves come from a human, remote peer, or AI
- **MoveStrategy interface** — the contract for AI and bot implementations; a `MoveStrategy` is injected into an `AIPlayerActor` to produce moves
- **RemotePlayerActor** — implementation of `PlayerActor` that receives moves over a WebRTC data channel from a peer running the same game engine
- **ConnectionManager** — manages the set of live peer connections for a game session; handles message routing and connection lifecycle
- **GameDriver** — drives the game loop by calling `awaitPick()` / `awaitPlacement()` on each actor in turn-order and advancing `GameSession` state; surfaces fatal errors to `LobbyFlow`
- **RosterFactory interface** — builds a complete roster of `PlayerActor` instances from resolved connections and player-type configuration; the boundary between lobby/setup and game execution

## Dependencies

- [`kingdomino-engine`](../kingdomino-engine) — for `GameSession`, `GameEventBus`, `SeedProvider`, and all game domain types

## Consumed by

All active game clients: UI clients and bots. Any participant that needs to produce or consume moves imports from this package.

## Not in scope

- Peer discovery or connection establishment (see `kingdomino-lobby`)
- Seed commitment between untrusted peers (see `kingdomino-commitment`)
- Application-specific player actors that couple to React (`LocalPlayerActor`, `CouchPlayerActor`) — those live in the client application
- UI rendering (client application only)
