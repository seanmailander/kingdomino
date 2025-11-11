import "react";
import "./App.css";
import { useState } from "react";
import { Lobby, Scenes, Splash, type ValidScenes } from "../scenes";
import { SplashScene } from "../Splash/splash";
import { GameScene } from "../Game/game";
import { LobbyScene } from "../Lobby/lobby";
import type { GameConnection } from "../Game/types";

export function App() {
  const [scene, setScene] = useState<ValidScenes>(Splash);
  const [gameConnection, setGameConnection] = useState<GameConnection | undefined>(undefined);

  const handleGameStarted = (newGameConnection: GameConnection) => {
    setGameConnection(newGameConnection);
    setScene(Scenes.Game);
  }

  return (
    <div className="App">
      {scene === Scenes.Splash ? (
        <SplashScene onGameStart={() => setScene(Scenes[Lobby])} />
      ) : null}
      {scene === Scenes.Lobby ? <LobbyScene onGameStarted={handleGameStarted} /> : null}
      {scene === Scenes.Game ? <GameScene gameConnection={gameConnection} /> : null}
    </div>
  );
}