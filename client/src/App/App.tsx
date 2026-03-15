import React from "react";

import "./App.css";
import SplashComponent from "../Splash/Splash";
import LobbyComponent from "../Lobby/Lobby";
import GameComponent from "../Game/Game";
import { useGameSelector } from "./store";

import { App as AppState } from "./app.slice";

function App() {
  const room = useGameSelector((state) => AppState.fromSelectorState(state).room());
  const hint = useGameSelector((state) => AppState.fromSelectorState(state).hint(state));
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
