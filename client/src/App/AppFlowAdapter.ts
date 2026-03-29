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
import type { GameSession } from "../game/state/GameSession";

const phaseToRoom = {
  splash: Splash,
  lobby: Lobby,
  game: Game,
  paused: GamePaused,
  ended: GameEnded,
} as const;

const roomToPhase = (): FlowPhase => {
  const room = getRoom();
  if (room === GamePaused) return "paused";
  if (room === GameEnded) return "ended";
  if (room === Game) return "game";
  if (room === Lobby) return "lobby";
  return "splash";
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

  awaitStart(): Promise<void> {
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
