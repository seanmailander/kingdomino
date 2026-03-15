import React from "react";

import { getPlayers, getHasEnoughPlayers } from "../Game/game.slice";
import { useGameDispatch, useGameSelector } from "../App/store";

import { connectionReset, gameStarted } from "../Game/game.actions";

function Lobby() {
  const players = useGameSelector(getPlayers);
  const hasEnoughPlayers = useGameSelector(getHasEnoughPlayers);
  const dispatch = useGameDispatch();

  const startGame = hasEnoughPlayers && (
    <>
      Ready!
      <button aria-label="Start game" onClick={() => dispatch(gameStarted())}>
        Start game
      </button>
      <br />
      <button aria-label="Leave game" onClick={() => dispatch(connectionReset())}>
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
