import React from "react";

import { triggerLobbyStart, triggerLobbyLeave } from "../App/store";
import type { GameSession } from "../game/state/GameSession";

type LobbyProps = {
  session: GameSession | null;
};

export function Lobby({ session }: LobbyProps) {
  const players = session?.players ?? [];
  const hasEnoughPlayers = session?.hasEnoughPlayers() ?? false;

  const startGame = hasEnoughPlayers && (
    <>
      Ready!
      <button aria-label="Start game" onClick={triggerLobbyStart}>
        Start game
      </button>
      <br />
      <button aria-label="Leave game" onClick={triggerLobbyLeave}>
        Leave game
      </button>
    </>
  );

  const waitingForPlayers = !hasEnoughPlayers && <>Waiting for players</>;

  return (
    <>
      Players: {JSON.stringify(players.map((p) => ({ playerId: p.id, isMe: session?.myPlayer()?.id === p.id })))}
      <br />
      {waitingForPlayers}
      {startGame}
    </>
  );
}
