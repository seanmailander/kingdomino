import "react";

import "./game.css";
import BoardArea from "./BoardArea";
import Card from "./Card";
import { getDeal } from "./round.slice";

type Player = { playerId: string; isMe: boolean };
type GameProps = {
  players: Array<Player>;
};

export function Game({ players }: GameProps) {
  const deal = useSelector(getDeal);

  return (
    <>
      <div className="deal">
        {deal?.map((card) => <Card key={card.id} card={card} />)}
      </div>
      <div className="boards">
        {players.map(({ playerId, isMe }) => (
          <BoardArea key={playerId} playerId={playerId} isMe={isMe} />
        ))}
      </div>
    </>
  );
}
