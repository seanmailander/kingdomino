import React from "react";
import { useSelector, useDispatch } from "react-redux";

import "./Card.css";

import { getPlayerBoards } from "./game.slice";
import { cardPlaced } from "./game.actions";
import { getCardToPlace } from "./round.slice";

import Tile from "./Tile";

function BoardArea(props) {
  const { playerId } = props;
  const playerBoards = useSelector(getPlayerBoards);
  const cardToPlace = useSelector(getCardToPlace);
  const myBoard = playerBoards[playerId];
  const dispatch = useDispatch();

  return (
    <div className="board" key={playerId}>
      <pre>{JSON.stringify(myBoard, undefined, true)}</pre>
      <br />
      <button
        aria-label="Place card"
        disabled={!cardToPlace}
        onClick={() =>
          dispatch(
            cardPlaced({
              playerId,
              card: cardToPlace,
              x: 3,
              y: 5,
              direction: 1,
            })
          )
        }
      >
        Place card {cardToPlace?.id}
      </button>
    </div>
  );
}

export default BoardArea;
