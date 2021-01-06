import React from "react";
import { grain, grass, marsh, mine, water, wood } from "./gamelogic/utils";

const imageNamesByTile = {
  [wood]: "wood.png",
  [water]: "water.png",
  [grass]: "grass.png",
  [grain]: "grain.png",
  [mine]: "mine.png",
  [marsh]: "marsh.png",
};

function Tile(props) {
  const { tile, value } = props;

  return (
    <div className="tile">
      <img src={imageNamesByTile[tile]} alt={imageNamesByTile[tile]}></img>
    </div>
  );
}

export default Tile;
