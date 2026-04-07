import React, { useState } from "react";

import "./Game.css";
import { BoardArea } from "./BoardArea";
import { Card } from "./Card";
import { PauseOverlay } from "./PauseOverlay";
import { ExitConfirmDialog } from "./ExitConfirmDialog";
import type { GameSession } from "kingdomino-engine";
import { useApp } from "../../App/store";
import { triggerPauseIntent, triggerResumeIntent, triggerExitConfirm } from "../../App/store";
import { Game as GameRoom, GamePaused } from "../../App/AppExtras";

type GameProps = {
  session: GameSession;
};

export function Game({ session }: GameProps) {
  const { room } = useApp();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const players = session.players;
  const deal = session.deal();
  const isMyTurn = session.isMyTurn();

  const handleExitIntent = () => setShowExitConfirm(true);
  const handleExitConfirm = () => {
    setShowExitConfirm(false);
    triggerExitConfirm(true);
  };
  const handleExitCancel = () => {
    setShowExitConfirm(false);
    triggerExitConfirm(false);
  };

  return (
    <>
      {room === GamePaused && !showExitConfirm && (
        <PauseOverlay onResume={triggerResumeIntent} onExit={handleExitIntent} />
      )}
      {showExitConfirm && (
        <ExitConfirmDialog onConfirm={handleExitConfirm} onCancel={handleExitCancel} />
      )}
      {room === GameRoom && (
        <div className="game-controls">
          <button onClick={triggerPauseIntent}>Pause</button>
        </div>
      )}
      <div className="deal">
        {deal.map((card) => (
          <Card key={card.id} card={card} isMyTurn={isMyTurn} session={session} />
        ))}
      </div>
      <div className="boards">
        {players.map((player) => (
          <BoardArea key={player.id} session={session} playerId={player.id} isMe={session.myPlayer()?.id === player.id} />
        ))}
      </div>
    </>
  );
}
