import React, { useMemo } from "react";

import useBoardPosition from "./useBoardPosition";

import Tile from "./Tile";
import { Board } from "../state/Board";
import { getFlippedPosition } from "../gamelogic/board";
import type { CardId, Direction } from "../state/types";

type BoardOverlayProps = {
  playerId: string;
  getBoardPosition: () => DOMRect | undefined;
  direction: Direction;
  flipped: boolean;
  cardId?: CardId;
  isMyPlace: boolean;
};

function BoardOverlay({
  playerId,
  getBoardPosition,
  direction,
  flipped,
  cardId,
  isMyPlace,
}: BoardOverlayProps) {
  const { x, y } = useBoardPosition(getBoardPosition());

  const boardWithCurrentCard = useMemo(() => {
    const overlayBoard = new Board();

    if (cardId === undefined || x === null || y === null) {
      return overlayBoard.snapshot();
    }

    const { flippedX, flippedY, flippedDirection } = getFlippedPosition(x, y, direction, flipped);

    return overlayBoard.place(cardId, flippedX, flippedY, flippedDirection).snapshot();
  }, [cardId, x, y, direction, flipped]);

  const shouldShowOverlay = isMyPlace && cardId !== undefined && x !== null && y !== null;
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
