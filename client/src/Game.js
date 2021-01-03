import React, { useState, useEffect } from "react";
import { useMachine } from "@xstate/react";

import {
  CONNECTION_ERRORED,
  CONNECTION_TIMEOUT,
  gameMachine,
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
      <button onClick={() => send(CONNECTION_TIMEOUT)}>
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

  const gameState = <>{`Game with ${current?.context?.peerName}`}</>;

  return (
    <>
      {current.matches("Lobby") && lobby}
      {current.matches("Error") && error}
      {(current.matches("Game") || current.matches("Round")) && gameState}
      <button onClick={() => send(CONNECTION_ERRORED)}>Fake error</button>
      <pre>{JSON.stringify(current, null, 2)}</pre>
    </>
  );
}

export default Game;
