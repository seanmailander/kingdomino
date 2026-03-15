import React from "react";

import { App } from "../App/App";
import { Game } from "../game/state/Game";
import { useGameSignal } from "../App/store";


type LobbyProps = {
  game: Game;
};

function Lobby({ game }: LobbyProps) {
  const players = game.players();
  const hasEnoughPlayers = game.hasEnoughPlayers();
  const signalGameStarted = useGameSignal(Game.gameStarted);
  const signalConnectionReset = useGameSignal(App.connectionReset);

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
