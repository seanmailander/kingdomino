// kingdomino-lobby public API
//
// Produces wired MultiplayerConnection objects (from kingdomino-protocol).
// Callers wire up ConnectionManager, RemotePlayerActor, and CommitmentSeedProvider
// from the returned connections.
//
// Boundary: this package knows about network discovery and WebRTC.
// It does not know about game rules, seed commitment, or player actors.

export { PeerSession } from "./peer.session";
export type { PeerSessionOptions } from "./peer.session";
