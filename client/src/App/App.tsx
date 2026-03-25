import React from "react";

import "./App.css";
import { Splash as SplashComponent } from "../Splash/Splash";
import { Lobby as LobbyComponent } from "../Lobby/Lobby";
import { Game as GameComponent } from "../game/visuals/Game";
import { useApp } from "./store";

export function App() {
  const { session, room, hint } = useApp();

  return (
    <div className="App">
      <h1>Kingdomino</h1>
      <p>{hint}</p>
      {room === "Splash" && <SplashComponent />}
      {room === "Lobby" && <LobbyComponent session={session} />}
      {room === "Game" && session && <GameComponent session={session} />}
    </div>
  );
}
