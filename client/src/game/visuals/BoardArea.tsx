import React, { useState, useRef } from "react";

import "./board.css";
import type { GameSession } from "../state/GameSession";
import { useApp } from "../../App/store";
import { Game as GameRoom } from "../../App/AppExtras";

import { Tile } from "./Tile";
import { BoardOverlay } from "./BoardOverlay";
import { up, down, left, right } from "../gamelogic/cards";
import type { Direction } from "../state/types";
import { useKeypress } from "./useKeyPress";

type BoardSquareProps = {
  handleClick: () => void;
  children: React.ReactNode;
  testId?: string;
};

type BoardAreaProps = {
  session: GameSession;
  playerId: string;
  isMe: boolean;
};

function BoardSquare({ handleClick, children, testId }: BoardSquareProps) {
  return <div onClick={handleClick} data-testid={testId}>{children}</div>;
}

const rotateLookup: Record<Direction, Direction> = {
  [up]: right,
  [right]: down,
  [down]: left,
  [left]: up,
};

export function BoardArea({ session, playerId, isMe }: BoardAreaProps) {
  const { room } = useApp();
  const isActive = room === GameRoom;

  const isMyPlace = session.isMyPlace();
  const myBoard = session.boardFor(playerId);
  const cardId = session.localCardToPlace();

  const [direction, setDirection] = useState<Direction>(right);
  const [flipped, setFlipped] = useState(false);

  const boardNode = useRef<HTMLDivElement | null>(null);
  const getBoardPosition = () => boardNode.current?.getBoundingClientRect();

  const handleClick = (x: number, y: number) => () => {
    if (isActive && isMyPlace && isValidTile(x, y) && isValidDirection(x, y, direction)) {
      session.handleLocalPlacement(x, y, direction);
    }
  };

  const eligiblePositions = session.localEligiblePositions();
  const isValidTile = (x: number, y: number) =>
    eligiblePositions.some((pos) => pos.x === x && pos.y === y);

  const isValidDirection = (x: number, y: number, nextDirection: Direction) =>
    session.localValidDirectionsAt(x, y).some((d) => d === nextDirection);

  // TODO: this is forcing keypress to re-add listeners on ever change of direction
  // is there an easier way?
  const handleRotate = () => isActive && setDirection(rotateLookup[direction]);
  const handleFlip = () => isActive && setFlipped(!flipped);

  useKeypress("KeyR", () => handleRotate(), [direction, isActive]);
  useKeypress("KeyF", () => handleFlip(), [flipped, isActive]);

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
              <BoardSquare
                key={`${y},${x}`}
                handleClick={handleClick(x, y)}
                testId={isMe && isMyPlace && isValidTile(x, y) && isValidDirection(x, y, direction) ? "valid-placement" : undefined}
              >
                <Tile
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
          {isMe && isMyPlace && !session.hasLocalValidPlacement() && (
            <button onClick={() => session.handleLocalDiscard()}>Discard card</button>
          )}
        </div>
      </div>
    </>
  );
}
