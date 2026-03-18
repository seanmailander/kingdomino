import React from "react";

import { gameLobby } from "../game/state/game.flow";

function Splash() {
  return (
    <>
      <button aria-label="Join lobby" onClick={() => gameLobby.ReadyMultiplayer()}>
        Ready for a game with friends?
      </button>
      <button aria-label="Start solo" onClick={() => gameLobby.ReadySolo()}>
        Ready for a game on your own?
      </button>
    </>
  );
}

export default Splash;
