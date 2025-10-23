import "react";
import { useEffect, useState } from "react";
import type { GameConnection } from "../Game/types";
import { newSoloConnection } from "../Game/connection/connection.solo";

const uninitializedGameConnection = {
    destroy: () => {},
    players: [],
    sendGameMessage: () => {},
    waitForGameMessage: () => {},
  };

const useNewSoloConnection = () => {
  const [soloConnection, setSoloConnection] = useState<GameConnection>(uninitializedGameConnection);
  useEffect(() => {
    async function initializeSoloGame() {
      const { destroy, players, sendGameMessage, waitForGameMessage } = await newSoloConnection();

      setSoloConnection({
        destroy, players, sendGameMessage, waitForGameMessage
      });
    }

    initializeSoloGame();
  }, []);
  
  return soloConnection;
}

export function LobbyComponent() {

  const soloConnection = useNewSoloConnection();
  const { players } = soloConnection;
  
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
