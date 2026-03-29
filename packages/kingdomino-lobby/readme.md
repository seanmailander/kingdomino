# kingdomino-lobby

The peer discovery and connection establishment package. Handles everything needed to find other players on the network and hand live WebRTC connections to the game setup layer.

## Purpose

Before a game can start, players must find each other. This package owns that process end-to-end: registering with the PeerJS signaling server, discovering waiting peers, establishing direct WebRTC data channels, and handing those connections off to `RosterFactory`. Once the handoff is made, this package's job is done — it has no knowledge of game rules or move sequencing.

## Scope

- **PeerJS client setup** — registers this client with the PeerJS server and receives a peer ID; the peer ID becomes the player's identity in the game engine
- **Peer discovery** — browses peers known to the PeerJS server to show the local player a list of joinable games
- **WebRTC connection establishment** — initiates or accepts WebRTC data channel connections to selected peers; surfaces a stable, open connection object once the handshake completes
- **Lobby state** — tracks which peers have been discovered, which are selected, and the transition from "selecting peers" to "ready to start"
- **mDNS / local network support** — works with the signaling server's mDNS advertisement so clients can reach `kingdomino.local` without internet access

## Dependencies

- [`kingdomino-protocol`](../kingdomino-protocol) — for the `RosterFactory` interface and `ConnectionManager`; the lobby produces connections that satisfy the protocol layer's transport contracts

## Consumed by

Any client that needs to find games on the network. Import this package when the player needs to discover and connect to remote peers before starting a game.

## Not needed by

- Tests that use `TestRosterFactory` with scripted actors — those bypass the network entirely
- Solo or couch-play sessions where all participants are local — no signaling server contact required

## Relationship to `LobbyFlow`

`LobbyFlow` is the application-level game lifecycle state machine (lives in the client). This package is a lower-level building block: it handles *network-layer* peer discovery and connection establishment, not the app-level UI flow or game orchestration. `LobbyFlow` calls into this package; this package does not know about `LobbyFlow`.
