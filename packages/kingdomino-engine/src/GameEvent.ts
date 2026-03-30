import type { Player } from "./Player";
import type { Round } from "./Round";
import type { CardId, Direction } from "./types";

export type GameScore = {
  player: Player;
  score: number;
  bonuses: { middleKingdom: number; harmony: number };
};

export const GAME_STARTED   = "game:started"   as const;
export const ROUND_STARTED  = "round:started"  as const;
export const PICK_MADE      = "pick:made"       as const;
export const PLACE_MADE     = "place:made"      as const;
export const DISCARD_MADE   = "discard:made"    as const;
export const ROUND_COMPLETE = "round:complete"  as const;
export const GAME_PAUSED    = "game:paused"     as const;
export const GAME_RESUMED   = "game:resumed"    as const;
export const GAME_ENDED     = "game:ended"      as const;

export type GameStartedEvent   = { type: typeof GAME_STARTED;   players: ReadonlyArray<Player>; pickOrder: ReadonlyArray<Player> };
export type RoundStartedEvent  = { type: typeof ROUND_STARTED;  round: Round };
export type PickMadeEvent      = { type: typeof PICK_MADE;       player: Player; cardId: CardId };
export type PlaceMadeEvent     = { type: typeof PLACE_MADE;      player: Player; cardId: CardId; x: number; y: number; direction: Direction };
export type DiscardMadeEvent   = { type: typeof DISCARD_MADE;    player: Player; cardId: CardId };
export type RoundCompleteEvent = { type: typeof ROUND_COMPLETE;  nextPickOrder: ReadonlyArray<Player> };
export type GamePausedEvent    = { type: typeof GAME_PAUSED };
export type GameResumedEvent   = { type: typeof GAME_RESUMED };
export type GameEndedEvent     = { type: typeof GAME_ENDED;      scores: GameScore[] };

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
