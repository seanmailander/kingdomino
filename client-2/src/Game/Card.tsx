import React from "react";
// import { useSelector, useDispatch } from "react-redux";

import "./Card.css";

// import { cardPicked } from "./game.actions";
// import { getIsMyTurn } from "./round.slice";

// import Tile from "./Tile";

function Card(props) {
  const { card } = props;
  // const { id, type, tiles } = card;
  // const isMyTurn = useSelector(getIsMyTurn);
  // const dispatch = useDispatch();

  // const className = `card${isMyTurn ? "" : " disabled"}`;

  return (
    <div
      className={className}
      key={id}
      onClick={() => isMyTurn && dispatch(cardPicked(id))}
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
