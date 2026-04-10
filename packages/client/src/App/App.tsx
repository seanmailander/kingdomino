import React, { useMemo } from "react";

import "./App.css";
import { Splash as SplashComponent } from "../Splash/Splash";
import { Lobby as LobbyComponent } from "../Lobby/Lobby";
import { Game as GameComponent } from "../game/visuals/Game";
import { GameOverScreen } from "../game/visuals/GameOverScreen";
import { determineWinners } from "kingdomino-engine";
import { useApp } from "./store";
import { useGameStore } from "./GameStoreContext";
import { getPeerSession } from "./peerSession";
import { AppFlowAdapter } from "./AppFlowAdapter";
import { LobbyFlow } from "../game/state/game.flow";
import { DefaultRosterFactory } from "../game/state/default.roster.factory";
import { Splash } from "./AppExtras";

export function App({ seed }: { seed?: string }) {
  const store = useGameStore();
  const lobby = useMemo(() => {
    const adapter = new AppFlowAdapter(store);
    return new LobbyFlow({
      adapter,
      rosterFactory: new DefaultRosterFactory({ seed }),
    });
  }, [store, seed]);

  const { session, room, hint } = useApp();

  return (
    <div className="App">
      <h1>Kingdomino</h1>
      <p>{hint}</p>
      {room === "Splash" && <SplashComponent lobby={lobby} />}
      {room === "Lobby" && (
        <LobbyComponent
          onStart={(config) => store.triggerLobbyStart(config)}
          onLeave={() => store.triggerLobbyLeave()}
          joinMatchmaking={() => getPeerSession().joinMatchmaking()}
        />
      )}
      {(room === "Game" || room === "GamePaused") && session && <GameComponent session={session} />}
      {room === "GameEnded" && (
        <GameOverScreen
          scores={determineWinners(store.getGameOverScores())}
          onReturnToLobby={() => store.setRoom(Splash)}
        />
      )}
    </div>
  );
}
