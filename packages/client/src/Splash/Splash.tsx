import React from "react";

import type { LobbyFlow } from "../game/state/game.flow";

export function Splash({ lobby }: { lobby: LobbyFlow }) {
  return (
    <>
      <button aria-label="Join lobby" disabled title="Multiplayer coming soon">
        Ready for a game with friends?
      </button>
      <button aria-label="Start solo" onClick={() => lobby.start()}>
        Ready for a game on your own?
      </button>
    </>
  );
}
