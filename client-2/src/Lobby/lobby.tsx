import "react";
import { useState } from "react";

// import { connectionReset, gameStarted } from "../Game/game.actions";

export function LobbyComponent() {
  const [players, setPlayers] = useState([]);
  const hasEnoughPlayers = players.length >= 2;

  const startGame = hasEnoughPlayers ? (
    <>
      Ready!
      <button aria-label="Start game" onClick={() => gameStarted()}>
        Start game
      </button>
      <br />
      <button aria-label="Leave game" onClick={() => connectionReset()}>
        Leave game
      </button>
    </>
  ) : null;

  const waitingForPlayers = !hasEnoughPlayers ? <>Waiting for players</> : null;

  const hint = hasEnoughPlayers
    ? "Players connected, hit 'ready' to start game"
    : "Waiting for players";

  return (
    <>
      <h5>{hint}</h5>
      Players: {JSON.stringify(players)}
      <br />
      {waitingForPlayers}
      {startGame}
    </>
  );
}
