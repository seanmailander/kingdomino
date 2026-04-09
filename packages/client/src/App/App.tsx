import React, { useMemo } from "react";

import "./App.css";
import { Splash as SplashComponent } from "../Splash/Splash";
import { Lobby as LobbyComponent } from "../Lobby/Lobby";
import { Game as GameComponent } from "../game/visuals/Game";
import { GameOverScreen } from "../game/visuals/GameOverScreen";
import { determineWinners } from "kingdomino-engine";
import { useApp, getGameOverScores, resetAppState, triggerLobbyStart, triggerLobbyLeave } from "./store";
import { getPeerSession } from "./peerSession";
import { createGameLobby, gameLobby } from "./gameLobby";

export function App({ seed }: { seed?: string }) {
  const lobby = useMemo(() => (seed ? createGameLobby(seed) : gameLobby), [seed]);
  const { session, room, hint } = useApp();

  return (
    <div className="App">
      <h1>Kingdomino</h1>
      <p>{hint}</p>
      {room === "Splash" && <SplashComponent lobby={lobby} />}
      {room === "Lobby" && (
        <LobbyComponent
          onStart={triggerLobbyStart}
          onLeave={triggerLobbyLeave}
          joinMatchmaking={() => getPeerSession().joinMatchmaking()}
        />
      )}
      {(room === "Game" || room === "GamePaused") && session && <GameComponent session={session} />}
      {room === "GameEnded" && (
        <GameOverScreen
          scores={determineWinners(getGameOverScores())}
          onReturnToLobby={resetAppState}
        />
      )}
    </div>
  );
}
