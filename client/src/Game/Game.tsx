import React from "react";

import "./Game.css";
import BoardArea from "./BoardArea";
import Card from "./Card";
import { Game as GameState } from "./game.slice";
import Round from "./Round";
import { useGameSelector } from "../App/store";

function Game() {
  const players = useGameSelector((state) => GameState.fromSelectorState(state).players());
  const deal = useGameSelector(Round.deal);

  return (
    <>
      <div className="deal">
        {deal?.map((card) => (
          <Card key={card.id} card={card} />
        ))}
      </div>
      <div className="boards">
        {players.map(({ playerId, isMe }) => (
          <BoardArea key={playerId} playerId={playerId} isMe={isMe} />
        ))}
      </div>
    </>
  );
}

export default Game;
