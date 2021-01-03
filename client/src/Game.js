import React, { useState, useEffect } from "react";
import { useMachine } from "@xstate/react";

import {
  CONNECTION_ERROR,
  gameMachine,
  RESET_CONNECTIONS,
} from "./gamelogic/stateMachine";

import newGame from "./gamelogic/game";

function Game() {
  const [game, setGame] = useState();
  const [current, send] = useMachine(gameMachine);

  useEffect(() => {
    setGame(newGame(send));
  }, [send]);

  const lobby = (
    <>
      Lobby
      <button onClick={() => send("RESET_CONNECTIONS")}>
        Check for peers again
      </button>
    </>
  );
  const error = (
    <>
      Error
      {current?.error}
      <button onClick={() => window.location.reload()}>Reset game</button>
    </>
  );

  const gameState = (
    <>
      Game
      {current?.peerName}

    </>
  );

  return (
    <>
      {current.matches("Lobby") && lobby}
      {current.matches("Error") && error}
      {(current.matches("Game") || current.matches("Round")) && gameState}
      <button onClick={() => send(CONNECTION_ERROR)}>Fake error</button>
      <pre>{JSON.stringify(current, null, 2)}</pre>
      <pre>{JSON.stringify(game, null, 2)}</pre>
    </>
  );
}

export default Game;
