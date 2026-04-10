// kingdomino-protocol public API

// Wire message vocabulary
export * from "./game.messages";

// Protocol adapter
export { ConnectionManager } from "./ConnectionManager";
export type { WaitForOneOfFn } from "./ConnectionManager";

// Transport layer (used by RemotePlayerActor; see TODO in connection.multiplayer.ts)
export { MultiplayerConnection } from "./connection.multiplayer";
export type { MultiplayerTransport, MultiplayerConnectionOptions } from "./connection.multiplayer";

// Actor model
export type { PlayerActor, PlacementResult } from "./player.actor";
export { RemotePlayerActor } from "./remote.player.actor";

// Turn loop driver
export { GameDriver } from "./game.driver";


// Test utilities (see TODO in connection.testing.ts)
export { TestConnection } from "./connection.testing";
export type {
  TestConnectionOptions,
  TestConnectionScenario,
  TestConnectionControl,
} from "./connection.testing";
