import type { SeedProvider } from "kingdomino-engine";
import type { PlayerActor } from "kingdomino-protocol";
import type { PlayerId } from "kingdomino-engine";
import type { RosterConfig } from "../../Lobby/lobby.types";

export type RosterResult = {
  players: Array<{ id: PlayerId; actor: PlayerActor }>;
  seedProvider: SeedProvider;
  /** The player ID that represents "this device's" player (used by GameSession for isMyTurn etc). */
  localPlayerId: PlayerId | null;
}

export interface RosterFactory {
  build(config: RosterConfig): Promise<RosterResult>
}
