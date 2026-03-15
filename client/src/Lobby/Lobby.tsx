import React from "react";

import { Game } from "../Game/game.slice";
import { useGameSelector, useGameSignal } from "../App/store";

import { connectionReset, gameStarted } from "../Game/game.actions";

function Lobby() {
  const players = useGameSelector((state) => Game.fromSelectorState(state).players());
  const hasEnoughPlayers = useGameSelector((state) =>
    Game.fromSelectorState(state).hasEnoughPlayers(),
  );
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
