import React from "react";

import { startMultiplayerGameFlow, startSoloGameFlow } from "../game/state/game.flow";

function Splash() {
  return (
    <>
      <button aria-label="Join lobby" onClick={() => startMultiplayerGameFlow()}>
        Ready for a game with friends?
      </button>
      <button aria-label="Start solo" onClick={() => void startSoloGameFlow()}>
        Ready for a game on your own?
      </button>
    </>
  );
}

export default Splash;
