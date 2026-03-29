import { GameSession, Player } from "kingdomino-engine";
import { findPlacementWithin5x5, findPlacementWithin7x7 } from "kingdomino-engine";
import type { CardId, Direction } from "kingdomino-engine";
import type { GameVariant } from "kingdomino-engine";

type AIMove =
  | { playerId: string; cardId: CardId; discard: true }
  | { playerId: string; cardId: CardId; x: number; y: number; direction: Direction };

export class RandomAIPlayer {
  private readonly aiSession: GameSession;
  private readonly aiPlayerId: string;
  private readonly humanPlayerId: string;

  constructor(aiPlayerId: string, humanPlayerId: string, variant: GameVariant = "standard") {
    this.aiPlayerId = aiPlayerId;
    this.humanPlayerId = humanPlayerId;
    this.aiSession = new GameSession({ variant, localPlayerId: aiPlayerId });
    this.aiSession.addPlayer(new Player(aiPlayerId));     // AI is "local" in its own session
    this.aiSession.addPlayer(new Player(humanPlayerId)); // Human is "remote" in AI session
  }

  /** Called once after the trusted seed exchange establishes pick order. */
  startGame(orderedPlayerIds: string[]): void {
    this.aiSession.startGame();
    const pickOrder = orderedPlayerIds.map((id) => this.aiSession.playerById(id)!);
    this.aiSession.setPickOrder(pickOrder);
  }

  /** Called at the start of each round with the same 4 cards as the human session. */
  beginRound(cardIds: [CardId, CardId, CardId, CardId]): void {
    this.aiSession.beginRound(cardIds);
  }

  /**
   * Records the human player's completed pick+placement into the AI session.
   * Must be called before generateMove() when the human acts before the AI.
   */
  receiveHumanMove(card: CardId, x: number, y: number, dir: Direction): void {
    this.aiSession.handlePick(this.humanPlayerId, card);
    this.aiSession.handlePlacement(this.humanPlayerId, x, y, dir);
  }

  /** Records the human player's discard into the AI session (human picked but couldn't place). */
  receiveHumanDiscard(card: CardId): void {
    this.aiSession.handlePick(this.humanPlayerId, card);
    this.aiSession.handleDiscard(this.humanPlayerId);
  }

  /**
   * Picks a random available card and finds a valid in-bounds placement.
   * Falls back to a sentinel move (0, 0, "up") if no valid placement exists —
   * identical to the pre-existing hardcoded stub. See spec for deferred handling.
   */
  generateMove(): AIMove {
    const round = this.aiSession.currentRound!;
    const boardSnapshot = this.aiSession.boardFor(this.aiPlayerId);
    const findPlacement =
      this.aiSession.variant === "mighty-duel"
        ? findPlacementWithin7x7
        : findPlacementWithin5x5;

    const availableCardIds = round.deal
      .snapshot()
      .filter((slot) => slot.pickedBy === null)
      .map((slot) => slot.cardId)
      .sort(() => Math.random() - 0.5); // shuffle for randomness

    for (const cardId of availableCardIds) {
      const placement = findPlacement(boardSnapshot, cardId);
      if (placement !== null) {
        this.aiSession.handleLocalPick(cardId);
        this.aiSession.handleLocalPlacement(placement.x, placement.y, placement.direction);
        return {
          playerId: this.aiPlayerId,
          cardId,
          x: placement.x,
          y: placement.y,
          direction: placement.direction,
        };
      }
    }

    // Degenerate fallback: no valid in-bounds placement found for any card — discard
    const firstCard = availableCardIds[0];
    this.aiSession.handleLocalPick(firstCard);
    this.aiSession.handleLocalDiscard();
    return {
      playerId: this.aiPlayerId,
      cardId: firstCard,
      discard: true,
    };
  }

  /** Returns true if the AI is the current actor and should move immediately. */
  isFirstToAct(): boolean {
    return this.aiSession.isMyTurn();
  }

  /** Returns true if the AI session currently has an active round. */
  hasActiveRound(): boolean {
    return this.aiSession.currentRound !== null;
  }

  /** Clean up. No active external subscriptions in this implementation. */
  destroy(): void {
    // No-op: aiSession holds no external resources
  }
}
