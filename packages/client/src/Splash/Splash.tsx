import React from "react";

import { gameLobby } from "../App/gameLobby";

export function Splash() {
  return (
    <>
      <button aria-label="Join lobby" disabled title="Multiplayer coming soon">
        Ready for a game with friends?
      </button>
      <button aria-label="Start solo" onClick={() => gameLobby.ReadySolo()}>
        Ready for a game on your own?
      </button>
    </>
  );
}
