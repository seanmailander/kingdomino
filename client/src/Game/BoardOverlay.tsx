import React, { useMemo } from "react";

import useBoardPosition from "./useBoardPosition";
import { useGameSelector } from "../App/store";

import Round from "./Round";

import Tile from "./Tile";
import { getEmptyBoard, enrichBoardWithCard, getFlippedPosition } from "./gamelogic/board";

const emptyBoard = getEmptyBoard();

function BoardOverlay(props) {
  const { playerId, getBoardPosition, direction, flipped } = props;
  const cardId = useGameSelector(Round.cardToPlace);
  const isMyPlace = useGameSelector(Round.isMyPlace);

  const { x, y } = useBoardPosition(getBoardPosition());

  const boardWithCurrentCard = useMemo(() => {
    const { flippedX, flippedY, flippedDirection } = getFlippedPosition(x, y, direction, flipped);

    return enrichBoardWithCard(emptyBoard, cardId, flippedX, flippedY, flippedDirection);
  }, [emptyBoard, cardId, x, y, direction, flipped]);

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
