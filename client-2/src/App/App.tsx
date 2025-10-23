import "react";
import "./App.css";
import { useState } from "react";
import { Scenes, Splash, type ValidScenes } from "../scenes";
import { getHint } from "../hints";
import { SplashComponent } from "../Splash";
import { Game } from "../Game/Game";

const peerIdentifiers = {
  me: "me",
  them: "them",
};

function App() {
  const [scene, setScene] = useState<ValidScenes>(Splash);
  const hint = getHint({ scene, hasEnoughPlayers: true, isMyTurn: false });

  const players = [
    { playerId: peerIdentifiers.me, isMe: true },
    { playerId: peerIdentifiers.them, isMe: false },
  ];

  return (
    <div className="App">
      <h1>Kingdomino</h1>
      <h5>{hint}</h5>
      {scene === Scenes.Splash && <SplashComponent />}
      {/* {scene === Scenes.Lobby && <LobbyComponent />} */}
      {scene === Scenes.Game && <Game players={players} />}
    </div>
  );
}

export default App;
