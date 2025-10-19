import "react";
import "./App.css";
import { useState } from "react";
import { Scenes, Splash, type ValidScenes } from "./scenes";
import { getHint } from "./hints";
import { SplashComponent } from "./Splash";

function App() {
  const [scene, setScene] = useState<ValidScenes>(Splash);
  const hint = getHint({ scene, hasEnoughPlayers: true, isMyTurn: false });

  return (
    <div className="App">
      <h1>Kingdomino</h1>
      <h5>{hint}</h5>
      {scene === Scenes.Splash && <SplashComponent />}
      {/* {scene === Scenes.Lobby && <LobbyComponent />} */}
      {/* {scene === Scenes.Game && <GameComponent />} */}
    </div>
  );
}

export default App;
