# kingdomino-commitment

The seed commitment protocol package. Provides cryptographic fairness guarantees between untrusted participants before a game seed is revealed.

## Purpose

In a peer-to-peer Kingdomino game, all players must agree on the random seed that shuffles the deck — but no single player should be able to choose the seed after seeing others' commitments. This package implements a commit-reveal protocol so that the final seed is determined jointly and neither party can bias it.

## Scope

- **CommitmentSeedProvider** — implements the `SeedProvider` interface from `kingdomino-engine`; orchestrates the full commit-reveal exchange and produces the agreed-upon seed
- **RandomSeedProvider** — simple `SeedProvider` that generates a local random seed; used in solo/trusted contexts where commitment is unnecessary
- **CommitmentTransport interface** — narrow interface this package requires from the transport layer; decouples the commitment protocol from PeerJS or any specific networking library

## Protocol sketch

1. Each participant generates a local random value and sends a cryptographic hash (commitment) to peers
2. Once all commitments are received, each participant reveals their raw value
3. All participants verify the revealed values match the commitments
4. The final seed is derived by XOR-ing all revealed values — any single participant's entropy is sufficient to make the result unpredictable

## Dependencies

- [`kingdomino-engine`](../kingdomino-engine) — for the `SeedProvider` interface this package implements

## Consumed by

Game participants only (players who produce moves). Observers who only watch the game stream do not participate in seed commitment.

## Not in scope

- The transport layer itself (provided externally via `CommitmentTransport`)
- Peer discovery or connection establishment (see `kingdomino-lobby`)
- Wire message vocabulary beyond the commitment exchange (see `kingdomino-protocol`)
