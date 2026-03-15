import React from "react";

import "./Card.css";
import type { GameSession } from "../state/GameSession";

import Tile from "./Tile";

function Card(props) {
  const { card, isMyTurn, session }: { card: { id: number; tiles: { tile: number; value: number }[] }; isMyTurn: boolean; session: GameSession } = props;
  const { id, tiles } = card;

  const className = `card${isMyTurn ? "" : " disabled"}`;

  return (
    <div className={className} key={id} onClick={() => isMyTurn && session.handleLocalPick(id)}>
      {tiles.map(({ tile, value }, index) => (
        <Tile key={index} tile={tile} value={value} />
      ))}
    </div>
  );
}

export default Card;
