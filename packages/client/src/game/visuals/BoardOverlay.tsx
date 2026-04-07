import React, { useMemo } from "react";

import { useBoardPosition } from "./useBoardPosition";

import { Tile } from "./Tile";
import { Board } from "kingdomino-engine";
import { getFlippedPosition } from "kingdomino-engine";
import type { CardId, Direction } from "kingdomino-engine";

type BoardOverlayProps = {
  playerId: string;
  getBoardPosition: () => DOMRect | undefined;
  direction: Direction;
  flipped: boolean;
  cardId?: CardId;
  isMyPlace: boolean;
};

export function BoardOverlay({
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

    try {
      return overlayBoard.place(cardId, flippedX, flippedY, flippedDirection).snapshot();
    } catch {
      return overlayBoard.snapshot();
    }
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
