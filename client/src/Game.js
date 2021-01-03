import React, { useState, useEffect } from "react";

import newGame from "./gamelogic/game";

function Game() {
  const [game, setGame] = useState();

  useEffect(() => {
    setGame(newGame());
  }, []);

  const lobby = (
    <>
      Lobby
      <button>Re-check</button>
    </>
  );

  return (
    <>
      {game?.state === "lobby" && lobby}
      <pre>{JSON.stringify(game, null, 2)}</pre>
    </>
  );
}

export default Game;
