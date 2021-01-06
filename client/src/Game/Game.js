import React, { useState, useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import "./Game.css";
import Card from "./Card";
import { cardPicked, cardPlaced, getDeal, getIsMyTurn } from "./game.slice";

function Game() {
  const isMyTurn = useSelector(getIsMyTurn);
  const deal = useSelector(getDeal);
  const dispatch = useDispatch();

  return (
    <>
      <div className="deal">
        {deal.map((card) => (
          <Card key={card.id} card={card} />
        ))}
      </div>
      <br />
      {/* <button
        aria-label="Place card"
        disabled={!isMyTurn}
        onClick={() => dispatch(cardPlaced(3))}
      >
        Place card
      </button> */}
    </>
  );
}

export default Game;
