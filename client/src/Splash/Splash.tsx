import React from "react";

import { useDispatch } from "react-redux";
import { startMulti, startSolo } from "../Game/game.actions";

function Splash() {
  const dispatch = useDispatch();

  return (
    <>
      <button aria-label="Join lobby" onClick={() => dispatch(startMulti())}>
        Ready for a game with friends?
      </button>
      <button aria-label="Start solo" onClick={() => dispatch(startSolo())}>
        Ready for a game on your own?
      </button>
    </>
  );
}

export default Splash;
