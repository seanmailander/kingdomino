import React, { useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

import "./board.css";

import { getPlayerBoard } from "./game.slice";
import { cardPlaced } from "./game.actions";
import { getCardToPlace, getIsMyPlace } from "./round.slice";

import Tile from "./Tile";
import BoardOverlay from "./BoardOverlay";
import { up, down, left, right } from "./gamelogic/cards";

function BoardSquare(props) {
  const { handleClick, children } = props;
  return <div onClick={handleClick}>{children}</div>;
}

const rotateLookup = {
  [up]: right,
  [right]: down,
  [down]: left,
  [left]: up,
};

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

  const handleRotate = () => setDirection(rotateLookup[direction]);

  return (
    <>
      <div className="board" key={playerId}>
        <div className="panels" ref={boardNode}>
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
        <div className="rotator">
          <button onClick={handleRotate}>Rotate card</button>
        </div>
      </div>
    </>
  );
}

export default BoardArea;
