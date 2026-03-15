import React from "react";

import "./Game.css";
import BoardArea from "./BoardArea";
import Card from "./Card";
import { getPlayers } from "./game.slice";
import { getDeal } from "./round.slice";
import { useGameSelector } from "../App/store";

function Game() {
  const players = useGameSelector(getPlayers);
  const deal = useGameSelector(getDeal);

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
