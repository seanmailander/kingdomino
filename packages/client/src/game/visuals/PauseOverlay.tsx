import React from "react";

type PauseOverlayProps = {
  onResume: () => void;
  onExit: () => void;
};

export function PauseOverlay({ onResume, onExit }: PauseOverlayProps) {
  return (
    <div className="pause-overlay overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="panel">
        <h2 id="pause-title">Game Paused</h2>
        <button className="primary" onClick={onResume}>Resume</button>
        <button onClick={onExit}>Exit</button>
      </div>
    </div>
  );
}
