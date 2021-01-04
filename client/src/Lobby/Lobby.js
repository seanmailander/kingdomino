import React from "react";

import { useSelector, useDispatch } from "react-redux";
import { gameStarted } from "../Game/game.slice";

function Lobby() {
  const players = useSelector((state) => state.game.players);
  const dispatch = useDispatch();

  const hasEnoughPlayers = players.length >= 2;

  const startGame = hasEnoughPlayers && (
    <>
      Ready!
      <button aria-label="Start game" onClick={() => dispatch(gameStarted())}>
        Start game
      </button>
    </>
  );

  const waitingForPlayers = !hasEnoughPlayers && <>Waiting for players</>;

  return (
    <>
      <h1>Lobby</h1>
      Players: {JSON.stringify(players)}
      <br />
      {waitingForPlayers}
      {startGame}
    </>
  );
}

export default Lobby;
