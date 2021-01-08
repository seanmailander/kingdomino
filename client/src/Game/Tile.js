import React from "react";
import {
  blank,
  castle,
  grain,
  grass,
  marsh,
  mine,
  water,
  wood,
} from "./gamelogic/cards";

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

function Tile(props) {
  const { tile, value, disabled = false } = props;

  const className = `tile${disabled ? " disabled" : ""}`;

  return (
    <div className={className}>
      <img src={imageNamesByTile[tile]} alt={imageNamesByTile[tile]}></img>
    </div>
  );
}

export default Tile;
