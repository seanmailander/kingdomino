import React, { useMemo } from "react";

import useBoardPosition from "./useBoardPosition";

import Tile from "./Tile";
import { Board } from "../state/Board";
import { getFlippedPosition } from "../gamelogic/board";

function BoardOverlay(props) {
  const { playerId, getBoardPosition, direction, flipped, cardId, isMyPlace } = props;

  const { x, y } = useBoardPosition(getBoardPosition());

  const boardWithCurrentCard = useMemo(() => {
    const { flippedX, flippedY, flippedDirection } = getFlippedPosition(x, y, direction, flipped);
    const overlayBoard = new Board();

    if (flippedX === null || flippedY === null) {
      return overlayBoard.snapshot();
    }

    return overlayBoard.place(cardId, flippedX, flippedY, flippedDirection).snapshot();
  }, [cardId, x, y, direction, flipped]);

  const shouldShowOverlay = isMyPlace && x !== null && y !== null;
  const overlay = shouldShowOverlay
    ? boardWithCurrentCard?.map((row, y) =>
        row.map(({ tile, value }, x) => <Tile key={`1${y},${x}`} tile={tile} value={value} />),
      )
    : null;

  return (
    <div className="boardOverlay" key={playerId}>
      {overlay}
    </div>
  );
}

export default BoardOverlay;
