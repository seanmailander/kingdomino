import React, { useState, useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";
import { cardPicked } from "./game.slice";

function Game() {
  const dispatch = useDispatch();

  return (
    <div>
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
    </div>
  );
}

export default Game;
