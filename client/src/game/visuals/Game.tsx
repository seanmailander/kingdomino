import React from "react";

import "./Game.css";
import BoardArea from "./BoardArea";
import Card from "./Card";
import { Game as GameState } from "../state/Game";

type GameProps = {
  game: GameState;
};

function Game({ game }: GameProps) {
  const players = game.players();
  const deal = game.deal();
  const isMyTurn = game.isMyTurn();

  return (
    <>
      <div className="deal">
        {deal?.map((card) => (
          <Card key={card.id} card={card} isMyTurn={isMyTurn} />
        ))}
      </div>
      <div className="boards">
        {players.map(({ playerId, isMe }) => (
          <BoardArea key={playerId} game={game} playerId={playerId} isMe={isMe} />
        ))}
      </div>
    </>
  );
}

export default Game;
