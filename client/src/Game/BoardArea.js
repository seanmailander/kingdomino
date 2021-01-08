import React from "react";
import { useSelector, useDispatch } from "react-redux";

import "./board.css";

import { getPlayerBoard } from "./game.slice";
import { cardPlaced } from "./game.actions";
import { getCardToPlace, getIsMyPlace } from "./round.slice";

import Tile from "./Tile";

function BoardSquare(props) {
  const { handleClick, children } = props;
  return <div onClick={handleClick}>{children}</div>;
}

function BoardArea(props) {
  const { playerId, isMe } = props;
  const myBoard = useSelector(getPlayerBoard(playerId));
  const card = useSelector(getCardToPlace);
  const isMyPlace = useSelector(getIsMyPlace);
  const dispatch = useDispatch();

  const handleClick = (x, y) => () => {
    if (isMyPlace) {
      dispatch(cardPlaced({ playerId, card, x, y, direction: 1 }));
    }
  };

  return (
    <div className="board" key={playerId}>
      {myBoard.map((row, x) =>
        row.map(({ tile, value }, y) => (
          <BoardSquare handleClick={handleClick(x, y)}>
            <Tile tile={tile} value={value} disabled={!isMe || !isMyPlace} />
          </BoardSquare>
        ))
      )}
    </div>
  );
}

export default BoardArea;
