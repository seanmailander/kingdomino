import React from "react";

import { useDispatch } from "react-redux";
import { startMultiplayerGameFlow, startSoloGameFlow } from "../Game/game.flow";

function Splash() {
  const dispatch = useDispatch();

  return (
    <>
      <button
        aria-label="Join lobby"
        onClick={() => dispatch(startMultiplayerGameFlow() as never)}
      >
        Ready for a game with friends?
      </button>
      <button aria-label="Start solo" onClick={() => dispatch(startSoloGameFlow() as never)}>
        Ready for a game on your own?
      </button>
    </>
  );
}

export default Splash;
