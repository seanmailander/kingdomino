import React from "react";
import { useSelector } from "react-redux";

import "./App.css";
import SplashComponent from "../Splash/Splash.js";
import LobbyComponent from "../Lobby/Lobby.js";
import GameComponent from "../Game/Game.js";

import { getRoom, getHint } from "./app.slice.js";

function App() {
  const room = useSelector(getRoom);
  const hint = useSelector(getHint);
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
