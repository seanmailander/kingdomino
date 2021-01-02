import React from "react";

import GameLogic from "./gamelogic/game";

function Game() {
  return <>{JSON.stringify(GameLogic.game, null, 2)}</>;
}

export default Game;
