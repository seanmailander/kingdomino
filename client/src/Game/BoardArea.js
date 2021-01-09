import React, { useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

import useBoardPosition from "./useBoardPosition";

import "./board.css";

import { getPlayerBoard } from "./game.slice";
import { cardPlaced } from "./game.actions";
import { getCardToPlace, getIsMyPlace } from "./round.slice";

import Tile from "./Tile";
import BoardOverlay from "./BoardOverlay";
import { right } from "./gamelogic/cards";
import { enrichBoardWithCard } from "./gamelogic/board";

function BoardSquare(props) {
  const { handleClick, children } = props;
  return <div onClick={handleClick}>{children}</div>;
}

function BoardArea(props) {
  const { playerId, isMe } = props;
  const myBoard = useSelector(getPlayerBoard(playerId));
  const cardId = useSelector(getCardToPlace);
  const isMyPlace = useSelector(getIsMyPlace);
  const dispatch = useDispatch();

  const [direction, setDirection] = useState(right);

  const boardNode = useRef(null);
  const getBoardPosition = () => boardNode.current?.getBoundingClientRect();

  const handleClick = (x, y) => () => {
    if (isMyPlace) {
      dispatch(cardPlaced({ playerId, card: cardId, x, y, direction }));
    }
  };

  return (
    <div className="board" key={playerId} ref={boardNode}>
      {isMe && (
        <BoardOverlay
          playerId={playerId}
          getBoardPosition={getBoardPosition}
          direction={direction}
        />
      )}
      {myBoard.map((row, y) =>
        row.map(({ tile, value }, x) => (
          <BoardSquare handleClick={handleClick(x, y)}>
            <Tile
              key={`2${y},${x}`}
              tile={tile}
              value={value}
              disabled={!isMe || !isMyPlace}
            />
          </BoardSquare>
        ))
      )}
    </div>
  );
}

export default BoardArea;
