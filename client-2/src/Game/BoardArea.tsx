import React, { useState, useRef } from "react";
// import { useSelector, useDispatch } from "react-redux";

import "./board.css";

// import { getPlayerBoard } from "./game.slice";
// import { cardPlaced } from "./game.actions";
// import { getCardToPlace, getIsMyPlace } from "./round.slice";

import Tile from "./Tile";
// import BoardOverlay from "./BoardOverlay";
// import { getEligiblePositions, getValidDirections } from "./gamelogic/board";
import { up, down, left, right } from "./gamelogic/cards";
// import useKeypress from "./useKeyPress";
import type { Direction } from "./types";
import { getEligiblePositions, getValidDirections } from "./gamelogic/board";

function BoardSquare(props) {
  const { handleClick, children } = props;
  return <div onClick={handleClick}>{children}</div>;
}

const rotateLookup: { [key: number]: Direction } = {
  [up]: right,
  [right]: down,
  [down]: left,
  [left]: up,
};

function BoardArea({ myBoard, playerId, isMe, cardId, isMyPlace }) {
  // const myBoard = useSelector(getPlayerBoard(playerId));
  // const cardId = useSelector(getCardToPlace);
  // const isMyPlace = true; //useSelector(getIsMyPlace);

  const [direction, setDirection] = useState<Direction>(right);
  const [flipped, setFlipped] = useState(false);

  const boardNode = useRef(null);
  // @ts-expect-error need to type the ref
  // const getBoardPosition = () => boardNode.current?.getBoundingClientRect();

  const handleClick = (x, y) => () => {
    if (
      isMyPlace &&
      cardId &&
      isValidTile(x, y) &&
      isValidDirection(x, y, direction)
    ) {
      cardPlaced({ playerId, card: cardId, x, y, direction });
    }
  };

  const eligiblePositions = getEligiblePositions(myBoard, cardId);
  const isValidTile = (x, y) =>
    eligiblePositions.some((pos) => pos.x === x && pos.y === y);

  const isValidDirection = (x, y, direction) =>
    getValidDirections(myBoard, cardId, x, y).some((d) => d === direction);

  // TODO: this is forcing keypress to re-add listeners on ever change of direction
  // is there an easier way?
  const handleRotate = () => setDirection(rotateLookup[direction]);
  const handleFlip = () => setFlipped(!flipped);

  // useKeypress("KeyR", () => handleRotate(), [direction]);
  // useKeypress("KeyF", () => handleFlip(), [flipped]);

  return (
    <>
      <div className="board" key={playerId}>
        <div className="panels" ref={boardNode}>
          {/* {isMe && (
            <BoardOverlay
              playerId={playerId}
              getBoardPosition={getBoardPosition}
              direction={direction}
              flipped={flipped}
            />
          )} */}
          {myBoard.map((row, y) =>
            row.map(({ tile, value }, x) => (
              <BoardSquare handleClick={handleClick(x, y)}>
                <Tile
                  key={`2${y},${x}`}
                  tile={tile}
                  value={value}
                  disabled={!isMe || !isMyPlace || !isValidTile(x, y)}
                  allowHighlight={isValidDirection(x, y, direction)}
                />
              </BoardSquare>
            )),
          )}
        </div>
        <div className="rotator">
          <button onClick={handleRotate}>Rotate card</button>
          <button onClick={handleFlip}>Flip card</button>
        </div>
      </div>
    </>
  );
}

export default BoardArea;
