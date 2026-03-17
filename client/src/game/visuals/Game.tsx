import React from "react";

import "./Game.css";
import BoardArea from "./BoardArea";
import Card from "./Card";
import type { GameSession } from "../state/GameSession";

type GameProps = {
  session: GameSession;
};

function Game({ session }: GameProps) {
  const players = session.players;
  const deal = session.deal();
  const isMyTurn = session.isMyTurn();

  return (
    <>
      <div className="deal">
        {deal.map((card) => (
          <Card key={card.id} card={card} isMyTurn={isMyTurn} session={session} />
        ))}
      </div>
      <div className="boards">
        {players.map((player) => (
          <BoardArea key={player.id} session={session} playerId={player.id} isMe={player.isLocal} />
        ))}
      </div>
    </>
  );
}

export default Game;
