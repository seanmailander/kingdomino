import React from "react";
import { blank, castle, grain, grass, marsh, mine, water, wood } from "../gamelogic/cards";

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

function Tile({ tile, value: _value, disabled = false, allowHighlight = false }: TileProps) {
  const imageName =
    tile !== undefined && tile !== null && tile in imageNamesByTile
      ? imageNamesByTile[tile as keyof typeof imageNamesByTile]
      : null;

  const className = `tile${disabled ? " disabled" : ""}${allowHighlight ? " highlight" : ""}`;

  return (
    <div className={className}>
      {imageName ? <img src={imageName} alt={imageName}></img> : null}
    </div>
  );
}

export default Tile;
