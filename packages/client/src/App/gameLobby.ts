import { LobbyFlow } from "../game/state/game.flow";
import { AppFlowAdapter } from "./AppFlowAdapter";
import { DefaultRosterFactory } from "../game/state/default.roster.factory";

export const createGameLobby = (seed?: string) =>
  new LobbyFlow({
    adapter: new AppFlowAdapter(),
    rosterFactory: new DefaultRosterFactory({ seed }),
  });

// Default singleton for production (no fixed seed)
export const gameLobby = createGameLobby();
