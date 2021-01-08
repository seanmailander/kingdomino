import React, { useMemo } from "react";
import { useSelector } from "react-redux";

import useBoardPosition from "./useBoardPosition";

import { getCardToPlace, getIsMyPlace } from "./round.slice";

import Tile from "./Tile";
import { getEmptyBoard, enrichBoardWithCard } from "./gamelogic/board";

function BoardOverlay(props) {
  const { playerId, getBoardPosition, direction } = props;
  const cardId = useSelector(getCardToPlace);
  const isMyPlace = useSelector(getIsMyPlace);

  const { x, y } = useBoardPosition(getBoardPosition());
  const boardWithCurrentCard = useMemo(
    () => enrichBoardWithCard(getEmptyBoard(), cardId, x, y, direction),
    [cardId, x, y, direction]
  );

  const shouldShowOverlay = isMyPlace && x !== null && y !== null && false;
  const overlay = shouldShowOverlay
    ? boardWithCurrentCard.map((row) =>
        row.map(({ tile, value }) => <Tile tile={tile} value={value} />)
      )
    : null;

  return (
    <div className="boardOverlay" key={playerId}>
      {overlay}
    </div>
  );
}

export default BoardOverlay;
