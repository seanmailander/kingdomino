import React from "react";

import "./Card.css";
import type { GameSession } from "../state/GameSession";
import { useApp } from "../../App/store";
import { Game as GameRoom } from "../../App/AppExtras";

import { Tile } from "./Tile";

type CardProps = {
  card: { id: number; tiles: { tile: number; value: number }[] };
  isMyTurn: boolean;
  session: GameSession;
};

export function Card({ card, isMyTurn, session }: CardProps) {
  const { room } = useApp();
  const { id, tiles } = card;

  const isActive = room === GameRoom;
  const className = `card${isMyTurn && isActive ? "" : " disabled"}`;

  return (
    <div className={className} key={id} onClick={() => isMyTurn && isActive && session.handleLocalPick(id)}>
      {tiles.map(({ tile, value }, index) => (
        <Tile key={index} tile={tile} value={value} />
      ))}
    </div>
  );
}
