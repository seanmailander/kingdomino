import type { GameSession } from "../game/state/GameSession";

// Room states
export const Splash = "Splash" as const;
export const Lobby = "Lobby" as const;
export const Game = "Game" as const;
export const Menu = "Menu" as const;
export const GamePaused = "GamePaused" as const;
export const GameEnded = "GameEnded" as const;

export type Room =
  | typeof Splash
  | typeof Lobby
  | typeof Game
  | typeof Menu
  | typeof GamePaused
  | typeof GameEnded;

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
  if (room === Menu) return "Game paused";
  if (room === GamePaused) return "Game paused";
  if (room === GameEnded) return "Game over";
  return "Press any key to start";
}
