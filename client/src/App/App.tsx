import React from "react";

import "./App.css";
import SplashComponent from "../Splash/Splash";
import LobbyComponent from "../Lobby/Lobby";
import GameComponent from "../Game/Game";
import { useGameSelector } from "./store";

import { getRoom, getHint } from "./app.slice";

function App() {
  const room = useGameSelector(getRoom);
  const hint = useGameSelector(getHint);
  return (
    <div className="App">
      <h1>Kingdomino</h1>
      <h5>{hint}</h5>
      {room === "Splash" && <SplashComponent />}
      {room === "Lobby" && <LobbyComponent />}
      {room === "Game" && <GameComponent />}
    </div>
  );
}

export default App;
