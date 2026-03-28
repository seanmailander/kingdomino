import { LobbyFlow } from "../game/state/game.flow";
import { AppFlowAdapter } from "./AppFlowAdapter";

export const gameLobby = new LobbyFlow({ adapter: new AppFlowAdapter() });
