import React, { useState, useEffect } from "react";

import { useSelector } from "react-redux";

import "./Game.css";
import BoardArea from "./BoardArea";
import Card from "./Card";
import { getPlayers } from "./game.slice";
import { getDeal } from "./round.slice";

function Game() {
  const players = useSelector(getPlayers);
  const deal = useSelector(getDeal);

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
