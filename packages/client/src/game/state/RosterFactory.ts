import type { SeedProvider } from "kingdomino-engine";
import type { PlayerActor } from "kingdomino-protocol";
import type { PlayerId } from "kingdomino-engine";
import type { RosterConfig } from "../../Lobby/lobby.types";

export type RosterResult = {
  players: Array<{ id: PlayerId; actor: PlayerActor }>
  seedProvider: SeedProvider
}

export interface RosterFactory {
  build(config: RosterConfig): Promise<RosterResult>
}
