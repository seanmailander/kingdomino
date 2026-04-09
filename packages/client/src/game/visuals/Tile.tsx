import React from "react";
import { blank, castle, grain, grass, marsh, mine, water, wood } from "kingdomino-engine";

const imageNamesByTile = {
  [blank]: "blank.png",
  [castle]: "castle.png",
  [wood]: "wood.png",
  [water]: "water.png",
  [grass]: "grass.png",
  [grain]: "grain.png",
  [mine]: "mine.png",
  [marsh]: "marsh.png",
};

type TileProps = {
  tile?: number | null;
  value?: number;
  disabled?: boolean;
  allowHighlight?: boolean;
};

export function Tile({ tile, value = 0, disabled = false, allowHighlight = false }: TileProps) {
  const imageName =
    tile !== undefined && tile !== null && tile in imageNamesByTile
      ? imageNamesByTile[tile as keyof typeof imageNamesByTile]
      : null;

  const className = `tile${disabled ? " disabled" : ""}${allowHighlight ? " highlight" : ""}`;

  return (
    <div className={className}>
      {imageName ? <img src={imageName} alt={imageName}></img> : null}
      {value > 0 && (
        <div
          className="crown-overlay"
          aria-label={`${value} crown${value > 1 ? "s" : ""}`}
        >
          {"♛".repeat(value)}
        </div>
      )}
    </div>
  );
}
