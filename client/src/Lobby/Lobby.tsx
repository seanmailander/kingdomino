import React from "react";

import { Game } from "../game/state/game.slice";
import { useGameSignal } from "../App/store";

import { connectionReset, gameStarted } from "../game/game.actions";

type LobbyProps = {
  game: Game;
};

function Lobby({ game }: LobbyProps) {
  const players = game.players();
  const hasEnoughPlayers = game.hasEnoughPlayers();
  const signalGameStarted = useGameSignal(gameStarted);
  const signalConnectionReset = useGameSignal(connectionReset);

  const startGame = hasEnoughPlayers && (
    <>
      Ready!
      <button aria-label="Start game" onClick={() => signalGameStarted()}>
        Start game
      </button>
      <br />
      <button aria-label="Leave game" onClick={() => signalConnectionReset()}>
        Leave game
      </button>
    </>
  );

  const waitingForPlayers = !hasEnoughPlayers && <>Waiting for players</>;

  return (
    <>
      Players: {JSON.stringify(players)}
      <br />
      {waitingForPlayers}
      {startGame}
    </>
  );
}

export default Lobby;
