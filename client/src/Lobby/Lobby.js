import React from "react";

import { useDispatch } from "react-redux";
import { increment } from "../Game/game.slice.js";

function Lobby() {
  const dispatch = useDispatch();

  return (
    <>
      <button aria-label="Start game" onClick={() => dispatch(increment())}>
        Start game
      </button>
    </>
  );

  // useEffect(() => {
  //   setGame(newGame(send));
  // }, [send]);

  // const lobby = (
  //   <>
  //     Lobby
  //     <button onClick={() => send(CONNECTION_TIMEOUT)}>
  //       Check for peers again
  //     </button>
  //   </>
  // );
  // const error = (
  //   <>
  //     Error
  //     {current?.error}
  //     <button onClick={() => window.location.reload()}>Reset game</button>
  //   </>
  // );

  // const gameState = <>{`Game with ${current?.context?.peerName}`}</>;

  // return (
  //   <>
  //     {current.matches("Lobby") && lobby}
  //     {current.matches("Error") && error}
  //     {(current.matches("Game") || current.matches("Round")) && gameState}
  //     <button onClick={() => send(CONNECTION_ERRORED)}>Fake error</button>
  //     <pre>{JSON.stringify(current, null, 2)}</pre>
  //   </>
  // );
}

export default Lobby;
