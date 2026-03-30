import type { CardId, Direction } from "kingdomino-engine";
import type { PlayerActor, PlacementResult } from "kingdomino-protocol";
import { RandomAIPlayer } from "kingdomino-protocol";
import type { PlayerId, BoardGrid, GameVariant } from "kingdomino-engine";

// TODO: redesign AIPlayerActor for N-player games.
// RandomAIPlayer takes a single humanPlayerId, which is ambiguous in games
// with multiple non-AI players. Initial implementation passes first non-AI player's ID.
// Long-term: replace with stateless MoveStrategy per architecture-report §8.5.

type AIMove =
  | { playerId: string; cardId: CardId; discard: true }
  | { playerId: string; cardId: CardId; x: number; y: number; direction: Direction };

function isDiscardMove(move: AIMove): move is { playerId: string; cardId: CardId; discard: true } {
  return "discard" in move && move.discard === true;
}

export class AIPlayerActor implements PlayerActor {
  readonly playerId: PlayerId;
  private readonly ai: RandomAIPlayer;
  private pendingPlacement: PlacementResult | null = null;

  constructor(playerId: PlayerId, humanPlayerId: PlayerId, variant: GameVariant = "standard") {
    this.playerId = playerId;
    this.ai = new RandomAIPlayer(playerId, humanPlayerId, variant);
  }

  awaitPick(_availableCards: CardId[], _boardSnapshot: BoardGrid): Promise<CardId> {
    const move = this.ai.generateMove() as AIMove;
    // Store the placement decision now; awaitPlacement() will return it
    if (isDiscardMove(move)) {
      this.pendingPlacement = { discard: true };
    } else {
      this.pendingPlacement = { x: move.x, y: move.y, direction: move.direction };
    }
    return Promise.resolve(move.cardId);
  }

  awaitPlacement(_cardId: CardId, _boardSnapshot: BoardGrid): Promise<PlacementResult> {
    const result = this.pendingPlacement ?? { discard: true };
    this.pendingPlacement = null;
    return Promise.resolve(result);
  }

  /** Expose the underlying RandomAIPlayer for game lifecycle hooks (startGame, beginRound, etc.) */
  get rawAI(): RandomAIPlayer {
    return this.ai;
  }

  destroy(): void {
    this.ai.destroy();
  }
}
