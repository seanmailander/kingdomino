import React, { useState, useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";
import { cardPicked } from "./game.slice";

function Game() {
  const players = useSelector((state) => state.game.players);
  const dispatch = useDispatch();

  return (
    <>
      <h1>Game</h1>
      Player order: {JSON.stringify(players, null, 2)}
      <button aria-label="Pick card 1" onClick={() => dispatch(cardPicked(0))}>
        Pick card 1
      </button>
      <button aria-label="Pick card 2" onClick={() => dispatch(cardPicked(1))}>
        Pick card 2
      </button>
      <button aria-label="Pick card 3" onClick={() => dispatch(cardPicked(2))}>
        Pick card 3
      </button>
      <button aria-label="Pick card 4" onClick={() => dispatch(cardPicked(3))}>
        Pick card 4
      </button>
    </>
  );
}

export default Game;
