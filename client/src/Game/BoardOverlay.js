import React, { useMemo, useState } from "react";
import { useSelector } from "react-redux";

import useBoardPosition from "./useBoardPosition";

import { getCardToPlace, getIsMyPlace } from "./round.slice";

import Tile from "./Tile";
import { getEmptyBoard, enrichBoardWithCard } from "./gamelogic/board";

function BoardOverlay(props) {
  const { playerId, getBoardPosition, direction } = props;
  const cardId = useSelector(getCardToPlace);
  const isMyPlace = useSelector(getIsMyPlace);
  const [emptyBoard, setBoard] = useState(getEmptyBoard());

  const { x, y } = useBoardPosition(getBoardPosition());
  const boardWithCurrentCard = useMemo(
    () => enrichBoardWithCard(emptyBoard, cardId, x, y, direction),
    [emptyBoard, cardId, x, y, direction]
  );

  const shouldShowOverlay = isMyPlace && x !== null && y !== null;
  const overlay = shouldShowOverlay
    ? boardWithCurrentCard?.map((row, y) =>
        row.map(({ tile, value }, x) => (
          <Tile key={`1${y},${x}`} tile={tile} value={value} />
        ))
      )
    : null;

  return (
    <div className="boardOverlay" key={playerId}>
      {overlay}
    </div>
  );
}

export default BoardOverlay;
