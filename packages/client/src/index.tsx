import React from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { App } from "./App/App";
import { GameStoreProvider } from "./App/GameStoreContext";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <GameStoreProvider>
      <App />
    </GameStoreProvider>
  </React.StrictMode>,
);
