import type { GameSession, Round } from "kingdomino-engine";
import type { PlayerId, CardId } from "kingdomino-engine";
import { generateDeck, getNextFourCards } from "kingdomino-engine";
import type { PlayerActor } from "./player.actor";

export class GameDriver {
  constructor(
    private readonly session: GameSession,
    private readonly actors: Map<PlayerId, PlayerActor>,
  ) {}

  /**
   * Drive the game to completion.
   * Resolves when all rounds have been played (game:ended fires).
   * Rejects if any actor's `awaitPick()` or `awaitPlacement()` throws.
   *
   * Owns the outer game loop: calls session.beginRound() for each round and
   * session.endGame() when the deck is exhausted. This is required because
   * GameSession's internal _runGameLoop() exits immediately when no
   * SeedProvider is configured — the driver provides its own loop instead.
   */
  run(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      void this._driveGame().then(resolve, reject);
    });
  }

  private async _driveGame(): Promise<void> {
    // Use a fresh deck independent of the one startGame() generated internally,
    // since _runGameLoop() exits immediately without a SeedProvider and never
    // consumes it.
    let remainingDeck: number[] = [...generateDeck()];

    while (remainingDeck.length >= 4) {
      const seed = Math.random().toString();
      const { next: cardIds, remaining } = getNextFourCards(seed, remainingDeck);
      remainingDeck = remaining;

      // beginRound() emits round:started and sets session.currentRound.
      this.session.beginRound(cardIds as [CardId, CardId, CardId, CardId]);
      await this._driveRound(this.session.currentRound!);
    }

    // Computes scores and emits game:ended.
    this.session.endGame();
  }

  private async _driveRound(round: Round): Promise<void> {
    const pickedCards = new Map<PlayerId, CardId>();

    // Single loop over the pick→place→pick→place→…→complete phase machine.
    // RoundPhase alternates: picking → placing (per player) until complete.
    while (round.phase !== "complete") {
      const player = round.currentActor;
      if (!player) break;

      const actor = this.actors.get(player.id);
      if (!actor) throw new Error(`GameDriver: no actor registered for player "${player.id}"`);

      if (round.phase === "picking") {
        const availableCards = round.deal
          .snapshot()
          .filter((slot) => slot.pickedBy === null)
          .map((slot) => slot.cardId);

        const boardSnapshot = this.session.boardFor(player.id);
        const cardId = await actor.awaitPick(availableCards, boardSnapshot);

        pickedCards.set(player.id, cardId);
        this.session.handlePick(player.id, cardId);
      } else {
        // placing phase
        const pickedSlot = round.deal
          .snapshot()
          .find((slot) => slot.pickedBy?.id === player.id);
        const cardId = pickedSlot?.cardId ?? pickedCards.get(player.id);
        if (cardId === undefined) {
          throw new Error(`GameDriver: cannot determine picked card for player "${player.id}"`);
        }

        const boardSnapshot = this.session.boardFor(player.id);
        const result = await actor.awaitPlacement(cardId, boardSnapshot);

        if ("discard" in result) {
          this.session.handleDiscard(player.id);
        } else {
          this.session.handlePlacement(player.id, result.x, result.y, result.direction);
        }
      }
    }
  }
}
