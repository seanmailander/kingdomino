import { LobbyFlow } from "../game/state/game.flow";
import { AppFlowAdapter } from "./AppFlowAdapter";
import { DefaultRosterFactory } from "../game/state/default.roster.factory";

export const gameLobby = new LobbyFlow({
  adapter: new AppFlowAdapter(),
  rosterFactory: new DefaultRosterFactory(),
});
