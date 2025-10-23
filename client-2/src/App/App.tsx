import "react";
import "./App.css";
import { useState } from "react";
import { Lobby, Scenes, Splash, type ValidScenes } from "../scenes";
import { SplashComponent } from "../Splash/splash";
import { Game } from "../Game/game";
import { LobbyComponent } from "../Lobby/lobby";

const peerIdentifiers = {
  me: "me",
  them: "them",
};

export function App() {
  const [scene, setScene] = useState<ValidScenes>(Splash);

  const players = [
    { playerId: peerIdentifiers.me, isMe: true },
    { playerId: peerIdentifiers.them, isMe: false },
  ];

  return (
    <div className="App">
      {scene === Scenes.Splash && (
        <SplashComponent onGameStart={() => setScene(Scenes[Lobby])} />
      )}
      {scene === Scenes.Lobby && <LobbyComponent />}
      {scene === Scenes.Game && <Game players={players} />}
    </div>
  );
}