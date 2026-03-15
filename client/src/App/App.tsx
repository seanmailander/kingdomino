import React from "react";

import "./App.css";
import SplashComponent from "../Splash/Splash";
import LobbyComponent from "../Lobby/Lobby";
import GameComponent from "../game/visuals/Game";
import { useGameSelector } from "./store";

import { Root } from "./reducer";

function App() {
  const root = useGameSelector((state) => Root.fromState(state));
  const app = root.app();
  const game = app.game();
  const room = app.room();
  const hint = app.hint();

  return (
    <div className="App">
      <h1>Kingdomino</h1>
      <h5>{hint}</h5>
      {room === "Splash" && <SplashComponent />}
      {room === "Lobby" && <LobbyComponent game={game} />}
      {room === "Game" && <GameComponent game={game} />}
    </div>
  );
}

export default App;
