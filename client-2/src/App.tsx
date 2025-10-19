import "react";
import "./App.css";
import { useState } from "react";
import { Splash } from "./scenes";
import { getHint } from "./hints";

function App() {
  const [scene, setScene] = useState(Splash);
  const hint = getHint(scene, true, false);

  return (
    <div className="App">
      <h1>Kingdomino</h1>
      <h5>{hint}</h5>
      {scene === "Splash" && <SplashComponent />}
      {scene === "Lobby" && <LobbyComponent />}
      {scene === "Game" && <GameComponent />}
    </div>
  );
}

export default App;
