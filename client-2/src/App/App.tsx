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
  const [players, setPlayers] = useState<GameConnection['players']>([]);

  const handlePlayersFound = (newPlayers: GameConnection['players']) => {
    setPlayers(newPlayers);
    setScene(Scenes.Game);
  }

  return (
    <div className="App">
      {scene === Scenes.Splash ? (
        <SplashScene onGameStart={() => setScene(Scenes[Lobby])} />
      ) : null}
      {scene === Scenes.Lobby ? <LobbyScene onPlayersFound={handlePlayersFound} /> : null}
      {scene === Scenes.Game ? <GameScene players={players} /> : null}
    </div>
  );
}