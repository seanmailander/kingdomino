import type { GameSession, Round } from "kingdomino-engine";
import type { PlayerId, CardId } from "kingdomino-engine";
import { ROUND_STARTED, GAME_ENDED } from "kingdomino-engine";
import type { PlayerActor } from "./player.actor";

/**
 * Drives the turn loop for a game session by asking each actor for their
 * move in turn order and feeding results into the session.
 *
 * Does NOT own the outer game loop (deck, seeds, round creation, pause).
 * That belongs to GameSession._runGameLoop(). The driver subscribes to
 * round:started events and drives actor decisions within each round.
 *
 * Usage:
 *   const driver = new GameDriver(session, actorMap);
 *   const finished = driver.driveUntilEnd();
 *   session.startGame();        // starts the internal game loop
 *   await finished;             // resolves when game:ended fires
 */
export class GameDriver {
  constructor(
    private readonly session: GameSession,
    private readonly actors: Map<PlayerId, PlayerActor>,
  ) {}

  /**
   * Subscribe to round:started and drive each round's actor decisions.
   * Returns a promise that resolves when the game ends.
   */
  driveUntilEnd(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        offRound();
        offEnd();
      };

      const offRound = this.session.events.on(ROUND_STARTED, ({ round }) => {
        void this._driveRound(round).catch((err) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err);
        });
      });

      const offEnd = this.session.events.on(GAME_ENDED, () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      });
    });
  }

  private async _driveRound(round: Round): Promise<void> {
    const pickedCards = new Map<PlayerId, CardId>();

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
        // Guard: skip if the UI already applied this pick to the session.
        if (round.phase === "picking" && round.currentActor?.id === player.id) {
          this.session.handlePick(player.id, cardId);
        }
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

        // Guard: skip if the UI already applied this placement to the session.
        if (round.phase === "placing" && round.currentActor?.id === player.id) {
          if ("discard" in result) {
            this.session.handleDiscard(player.id);
          } else {
            this.session.handlePlacement(player.id, result.x, result.y, result.direction);
          }
        }
      }
    }
  }
}
