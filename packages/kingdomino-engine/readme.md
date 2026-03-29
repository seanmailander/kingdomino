# kingdomino-engine

The game domain package. Contains all Kingdomino rules, board logic, card definitions, session management, and event infrastructure.

## Purpose

This package is the single source of truth for what the game *is*. It knows how boards are scored, how cards are drawn and placed, what constitutes a legal move, and how a game session progresses from start to finish.

## Scope

- **Card and deck definitions** — the full 48-tile card set with terrain types and crown counts
- **Board** — a 5×5 grid that tracks placed tiles, validates placement against adjacency and size rules, and calculates territory scores
- **Round and Deal** — orchestrates a single round: deal cards, collect picks, collect placements, resolve scoring
- **Player** — player identity and per-player board state
- **GameSession** — top-level session object; drives the round sequence from initial deal to game end
- **GameEventBus** — typed pub/sub event bus decoupling session phases from observers (`player:joined`, `game:started`, `round:started`, `pick:made`, `place:made`, `round:complete`, `game:ended`)
- **SeedProvider interface** — abstraction over how the random seed for a session is obtained; the engine itself does not choose a seed

## Dependencies

- [`chacha-rng`](../chacha-rng) — deterministic RNG used for deck shuffling

## Consumed by

All clients, bots, observers, and the engine's own tests. Any participant that needs to understand or simulate the game state imports from this package.

## Not in scope

- Networking or wire formats (see `kingdomino-protocol`)
- Seed commitment between untrusted peers (see `kingdomino-commitment`)
- Peer discovery or WebRTC (see `kingdomino-lobby`)
- React components or UI rendering (client application only)
