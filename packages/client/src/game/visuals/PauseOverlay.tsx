import React from "react";

type PauseOverlayProps = {
  onResume: () => void;
  onExit: () => void;
};

export function PauseOverlay({ onResume, onExit }: PauseOverlayProps) {
  return (
    <div className="pause-overlay">
      <h2>Game Paused</h2>
      <button onClick={onResume}>Resume</button>
      <button onClick={onExit}>Exit</button>
    </div>
  );
}
