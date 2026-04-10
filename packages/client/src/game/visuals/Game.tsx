import React, { useState } from "react";

import "./Game.css";
import { BoardArea } from "./BoardArea";
import { Card } from "./Card";
import { PauseOverlay } from "./PauseOverlay";
import { ExitConfirmDialog } from "./ExitConfirmDialog";
import type { GameSession } from "kingdomino-engine";
import { useApp } from "../../App/store";
import { useGameStore } from "../../App/GameStoreContext";
import { Game as GameRoom, GamePaused } from "../../App/AppExtras";

type GameProps = {
  session: GameSession;
};

export function Game({ session }: GameProps) {
  const { room } = useApp();
  const store = useGameStore();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const players = session.players;
  const deal = session.deal();
  const isMyTurn = session.isMyTurn();
  const dealSnapshot = session.currentRound?.deal.snapshot() ?? [];

  const handleExitIntent = () => setShowExitConfirm(true);
  const handleExitConfirm = () => {
    setShowExitConfirm(false);
    store.triggerExitConfirm(true);
  };
  const handleExitCancel = () => {
    setShowExitConfirm(false);
    store.triggerExitConfirm(false);
  };

  return (
    <>
      {room === GamePaused && !showExitConfirm && (
        <PauseOverlay onResume={() => store.triggerResumeIntent()} onExit={handleExitIntent} />
      )}
      {showExitConfirm && (
        <ExitConfirmDialog onConfirm={handleExitConfirm} onCancel={handleExitCancel} />
      )}
      {room === GameRoom && (
        <div className="game-controls">
          <button onClick={() => store.triggerPauseIntent()}>Pause</button>
        </div>
      )}
      <div className="deal">
        {deal.map((card) => {
          const slot = dealSnapshot.find((s) => s.cardId === card.id);
          const isPicked = slot?.pickedBy !== null && slot?.pickedBy !== undefined;
          return <Card key={card.id} card={card} isMyTurn={isMyTurn && !isPicked} session={session} />;
        })}
      </div>
      <div className="boards">
        {players.map((player) => (
          <BoardArea key={player.id} session={session} playerId={player.id} isMe={session.myPlayer()?.id === player.id} />
        ))}
      </div>
    </>
  );
}
