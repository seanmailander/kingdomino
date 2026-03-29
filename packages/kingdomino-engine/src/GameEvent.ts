import type { Player } from "./Player";
import type { Round } from "./Round";
import type { CardId, Direction } from "./types";

export type GameScore = {
  player: Player;
  score: number;
  bonuses: { middleKingdom: number; harmony: number };
};

export type GameStartedEvent   = { type: "game:started";   players: ReadonlyArray<Player>; pickOrder: ReadonlyArray<Player> };
export type RoundStartedEvent  = { type: "round:started";  round: Round };
export type PickMadeEvent      = { type: "pick:made";       player: Player; cardId: CardId };
export type PlaceMadeEvent     = { type: "place:made";      player: Player; cardId: CardId; x: number; y: number; direction: Direction };
export type DiscardMadeEvent   = { type: "discard:made";    player: Player; cardId: CardId };
export type RoundCompleteEvent = { type: "round:complete";  nextPickOrder: ReadonlyArray<Player> };
export type GamePausedEvent    = { type: "game:paused" };
export type GameResumedEvent   = { type: "game:resumed" };
export type GameEndedEvent     = { type: "game:ended";      scores: GameScore[] };

export type GameEvent =
  | GameStartedEvent
  | RoundStartedEvent
  | PickMadeEvent
  | PlaceMadeEvent
  | DiscardMadeEvent
  | RoundCompleteEvent
  | GamePausedEvent
  | GameResumedEvent
  | GameEndedEvent;
