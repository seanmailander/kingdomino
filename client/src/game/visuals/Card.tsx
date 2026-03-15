import React from "react";

import "./Card.css";
import { useGameSignal } from "../../App/store";

import Round from "../state/Round";

import Tile from "./Tile";

function Card(props) {
  const { card, isMyTurn } = props;
  const { id, tiles } = card;
  const signalCardPicked = useGameSignal(Round.cardPicked);

  const className = `card${isMyTurn ? "" : " disabled"}`;

  return (
    <div className={className} key={id} onClick={() => isMyTurn && signalCardPicked(id)}>
      {tiles.map(({ tile, value }, index) => (
        <Tile key={index} tile={tile} value={value} />
      ))}
      {/* <br />
      <button
        aria-label="Pick card ${id}"
        disabled={!isMyTurn}
        onClick={() => signalCardPicked(id)}
      >
        Pick card {id}
      </button> */}
    </div>
  );
}

export default Card;
