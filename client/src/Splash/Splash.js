import React from "react";

import { useDispatch } from "react-redux";
import { connectionReset } from "../Game/game.slice.js";

function Splash() {
  const dispatch = useDispatch();

  return (
    <>
      <h1>Splash</h1>
      <button
        aria-label="Join lobby"
        onClick={() => dispatch(connectionReset())}
      >
        Ready for a game?
      </button>
    </>
  );
}

export default Splash;