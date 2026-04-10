import type { GameStore } from "./GameStore";
import type { FlowAdapter, FlowPhase } from "../game/state/game.flow";
import { FLOW_SPLASH, FLOW_LOBBY, FLOW_GAME, FLOW_PAUSED, FLOW_ENDED } from "../game/state/game.flow";
import type { GameSession } from "kingdomino-engine";
import type { RosterConfig } from "../Lobby/lobby.types";
import { Lobby, Game, Splash, GamePaused, GameEnded } from "./AppExtras";
import type { Room } from "./AppExtras";

const phaseToRoom = {
  [FLOW_SPLASH]: Splash,
  [FLOW_LOBBY]:  Lobby,
  [FLOW_GAME]:   Game,
  [FLOW_PAUSED]: GamePaused,
  [FLOW_ENDED]:  GameEnded,
} as const;

const roomToPhase = (room: Room): FlowPhase => {
  if (room === GamePaused) return FLOW_PAUSED;
  if (room === GameEnded) return FLOW_ENDED;
  if (room === Game) return FLOW_GAME;
  if (room === Lobby) return FLOW_LOBBY;
  return FLOW_SPLASH;
};

export class AppFlowAdapter implements FlowAdapter {
  constructor(private readonly store: GameStore) {}

  setSession(session: GameSession | null): void {
    this.store.setCurrentSession(session);
  }

  setPhase(phase: FlowPhase): void {
    this.store.setRoom(phaseToRoom[phase]);
  }

  getPhase(): FlowPhase {
    return roomToPhase(this.store.getRoom());
  }

  oncePhaseIsNot(phase: FlowPhase): Promise<void> {
    return this.store.onceRoomIsNot(phaseToRoom[phase]);
  }

  awaitStart(): Promise<RosterConfig> {
    return this.store.awaitLobbyStart();
  }

  awaitLeave(): Promise<void> {
    return this.store.awaitLobbyLeave();
  }

  awaitPause(): Promise<void> {
    return this.store.awaitPauseIntent();
  }

  awaitResume(): Promise<void> {
    return this.store.awaitResumeIntent();
  }

  reset(): void {
    // No-op — isolation by unreachability. The store is scoped to the
    // provider; when the provider unmounts, the store becomes unreachable.
  }
}
