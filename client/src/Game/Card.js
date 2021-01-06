import React from "react";
import { useSelector, useDispatch } from "react-redux";

import "./Card.css";

import { cardPicked, getIsMyTurn } from "./game.slice";

import Tile from "./Tile";

function Card(props) {
  const { card } = props;
  const { id, type, tiles } = card;
  const isMyTurn = useSelector(getIsMyTurn);
  const dispatch = useDispatch();

  return (
    <div className="card" key={id}>
      {tiles.map(({ tile, value }, index) => (
        <Tile key={index} tile={tile} value={value} />
      ))}
      <br />
      <button
        aria-label="Pick card ${id}"
        disabled={!isMyTurn}
        onClick={() => dispatch(cardPicked(id))}
      >
        Pick card {id}
      </button>
    </div>
  );
}

export default Card;
