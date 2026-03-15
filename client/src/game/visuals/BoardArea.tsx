import React, { useState, useRef } from "react";

import "./board.css";
import { useGameSignal } from "../../App/store";

import { cardPlaced } from "../state/game.actions";

import Tile from "./Tile";
import BoardOverlay from "./BoardOverlay";
import { getEligiblePositions, getValidDirections } from "../gamelogic/board";
import { up, down, left, right } from "../gamelogic/cards";
import type { Direction } from "../state/types";
import useKeypress from "./useKeyPress";

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

function BoardArea(props) {
  const { game, playerId, isMe } = props;
  const myBoard = game.boardFor(playerId);
  const cardId = game.cardToPlace();
  const isMyPlace = game.isMyPlace();
  const signalCardPlaced = useGameSignal(cardPlaced);

  const [direction, setDirection] = useState<Direction>(right);
  const [flipped, setFlipped] = useState(false);

  const boardNode = useRef(null);
  const getBoardPosition = () => boardNode.current?.getBoundingClientRect();

  const handleClick = (x, y) => () => {
    if (isMyPlace && isValidTile(x, y) && isValidDirection(x, y, direction)) {
      signalCardPlaced({ playerId, card: cardId, x, y, direction });
    }
  };

  const eligiblePositions = getEligiblePositions(myBoard, cardId);
  const isValidTile = (x, y) => eligiblePositions.some((pos) => pos.x === x && pos.y === y);

  const isValidDirection = (x, y, direction) =>
    getValidDirections(myBoard, cardId, x, y).some((d) => d === direction);

  // TODO: this is forcing keypress to re-add listeners on ever change of direction
  // is there an easier way?
  const handleRotate = () => setDirection(rotateLookup[direction]);
  const handleFlip = () => setFlipped(!flipped);

  useKeypress("KeyR", () => handleRotate(), [direction]);
  useKeypress("KeyF", () => handleFlip(), [flipped]);

  return (
    <>
      <div className="board" key={playerId}>
        <div className="panels" ref={boardNode}>
          {isMe && (
            <BoardOverlay
              playerId={playerId}
              getBoardPosition={getBoardPosition}
              direction={direction}
              flipped={flipped}
              cardId={cardId}
              isMyPlace={isMyPlace}
            />
          )}
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
