import React from "react";

type PauseOverlayProps = {
  onResume: () => void;
  onExit: () => void;
};

export function PauseOverlay({ onResume, onExit }: PauseOverlayProps) {
  return (
    <div className="pause-overlay overlay">
      <div className="panel">
        <h2>Game Paused</h2>
        <button className="primary" onClick={onResume}>Resume</button>
        <button onClick={onExit}>Exit</button>
      </div>
    </div>
  );
}
