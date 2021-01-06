import React from "react";

import { useSelector, useDispatch } from "react-redux";
import {
  connectionReset,
  gameStarted,
  getPlayers,
  getHasEnoughPlayers,
} from "../Game/game.slice";

function Lobby() {
  const players = useSelector(getPlayers);
  const hasEnoughPlayers = useSelector(getHasEnoughPlayers);
  const dispatch = useDispatch();

  const startGame = hasEnoughPlayers && (
    <>
      Ready!
      <button aria-label="Start game" onClick={() => dispatch(gameStarted())}>
        Start game
      </button>
      <br />
      <button
        aria-label="Leave game"
        onClick={() => dispatch(connectionReset())}
      >
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
