import type { GameSession } from "../game/state/GameSession";

// Room states
export const Splash = "Splash" as const;
export const Lobby = "Lobby" as const;
export const Game = "Game" as const;

export type Room = typeof Splash | typeof Lobby | typeof Game;

export function computeHint(session: GameSession | null, room: Room): string {
  if (room === Lobby) {
    if (session && session.hasEnoughPlayers()) {
      return "Players connected, hit 'ready' to start game";
    }
    return "Waiting for players";
  }
  if (room === Game) {
    if (session?.isMyTurn()) return "Pick your card";
    if (session?.isMyPlace()) return "Place your card";
    return "Waiting for Player 2";
  }
  return "Press any key to start";
}
