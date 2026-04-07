# Kingdomino Signaling Server

This is a **minimal signaling server only** — it has no game logic. All game rules and state live in the client.

## Purpose

1. **PeerJS peer discovery** — lets clients find each other by peer ID
2. **mDNS advertisement** — broadcasts `kingdomino.local` on the local network so clients can reach the server without internet

## Tech Stack

- Node.js + Express
- `peer` — PeerJS server (WebRTC signaling)
- `multicast-dns` — mDNS/Bonjour advertisement

## Available Scripts

In the `server/` directory:

### `npm start`
Starts the signaling server (default port 3001).

### `npm run lint`
Runs the linter.

> **Note:** There is no real test suite for the server.

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Entry point — sets up Express, PeerJS server, mDNS advertisement |
| `package.json` | Dependencies and scripts |

## Relationship to Client

The client connects to this server only to discover other peers. Once two clients have each other's peer IDs, all game communication is **direct peer-to-peer via WebRTC** — the server is no longer involved.
