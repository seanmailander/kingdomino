// kingdomino-protocol public API
// Stub — exports will be filled in as the package is implemented.
// Wire message vocabulary
export * from "./game.messages";
// Protocol adapters
export { ConnectionManager } from "./ConnectionManager";
export { MultiplayerConnection } from "./connection.multiplayer";
export type { MultiplayerTransport, MultiplayerConnectionOptions } from "./connection.multiplayer";
// AI move generation
export { RandomAIPlayer } from "./ai.player";
// Test utilities
export { TestConnection } from "./connection.testing";
export type {
  TestConnectionOptions,
  TestConnectionScenario,
  TestConnectionControl,
} from "./connection.testing";
