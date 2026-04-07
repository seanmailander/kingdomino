import {
  setCurrentSession,
  setRoom,
  getRoom,
  onceRoomIsNot,
  awaitLobbyStart,
  awaitLobbyLeave,
  awaitPauseIntent,
  awaitResumeIntent,
  resetAppState,
} from "./store";
import { Lobby, Game, Splash, GamePaused, GameEnded } from "./AppExtras";
import type { FlowAdapter, FlowPhase } from "../game/state/game.flow";
import { FLOW_SPLASH, FLOW_LOBBY, FLOW_GAME, FLOW_PAUSED, FLOW_ENDED } from "../game/state/game.flow";
import type { GameSession } from "kingdomino-engine";
import type { RosterConfig } from "../Lobby/lobby.types";

const phaseToRoom = {
  [FLOW_SPLASH]: Splash,
  [FLOW_LOBBY]:  Lobby,
  [FLOW_GAME]:   Game,
  [FLOW_PAUSED]: GamePaused,
  [FLOW_ENDED]:  GameEnded,
} as const;

const roomToPhase = (): FlowPhase => {
  const room = getRoom();
  if (room === GamePaused) return FLOW_PAUSED;
  if (room === GameEnded) return FLOW_ENDED;
  if (room === Game) return FLOW_GAME;
  if (room === Lobby) return FLOW_LOBBY;
  return FLOW_SPLASH;
};

export class AppFlowAdapter implements FlowAdapter {
  setSession(session: GameSession | null): void {
    setCurrentSession(session);
  }

  setPhase(phase: FlowPhase): void {
    setRoom(phaseToRoom[phase]);
  }

  getPhase(): FlowPhase {
    return roomToPhase();
  }

  oncePhaseIsNot(phase: FlowPhase): Promise<void> {
    return onceRoomIsNot(phaseToRoom[phase]);
  }

  awaitStart(): Promise<RosterConfig> {
    return awaitLobbyStart();
  }

  awaitLeave(): Promise<void> {
    return awaitLobbyLeave();
  }

  awaitPause(): Promise<void> {
    return awaitPauseIntent();
  }

  awaitResume(): Promise<void> {
    return awaitResumeIntent();
  }

  reset(): void {
    resetAppState();
  }
}
