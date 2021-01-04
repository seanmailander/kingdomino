import React from "react";
import { useSelector } from "react-redux";

import "./App.css";
import Splash from "../Splash/Splash.js";
import Lobby from "../Lobby/Lobby.js";
import Game from "../Game/Game.js";

import { selectRoom } from "./app.slice.js";

function App() {
  const room = useSelector(selectRoom);
  return (
    <div className="App">
      {room === "Splash" && <Splash />}
      {room === "Lobby" && <Lobby />}
      {room === "Game" && <Game />}
    </div>
  );
}

export default App;
