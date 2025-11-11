import React from "react";

import "./Card.css";
import Tile from "./Tile";

function Card({ card, isMyTurn, onCardPicked }) {
  const { id, tiles } = card;
  const className = `card${isMyTurn ? "" : " disabled"}`;

  return (
    <div
      className={className}
      key={id}
      onClick={() => isMyTurn && onCardPicked(id)}
    >
      {tiles.map(({ tile, value }, index) => (
        <Tile key={index} tile={tile} value={value} />
      ))}
      {/* <br />
      <button
        aria-label="Pick card ${id}"
        disabled={!isMyTurn}
        onClick={() => dispatch(cardPicked(id))}
      >
        Pick card {id}
      </button> */}
    </div>
  );
}

export default Card;
