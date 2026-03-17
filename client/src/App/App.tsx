import React from "react";

import "./App.css";
import SplashComponent from "../Splash/Splash";
import LobbyComponent from "../Lobby/Lobby";
import GameComponent from "../game/visuals/Game";
import { useApp } from "./store";

export function App() {
  const { session, room, hint } = useApp();

  return (
    <div className="App">
      <h1>Kingdomino</h1>
      <h5>{hint}</h5>
      {room === "Splash" && <SplashComponent />}
      {room === "Lobby" && <LobbyComponent session={session} />}
      {room === "Game" && session && <GameComponent session={session} />}
    </div>
  );
}
