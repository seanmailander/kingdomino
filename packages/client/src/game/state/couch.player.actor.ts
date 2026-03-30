import type { CardId, BoardGrid } from "kingdomino-engine";
import type { PlacementResult } from "kingdomino-protocol";
import { LocalPlayerActor } from "./local.player.actor";

/** UI contract: show a "Pass the device to Player N" screen before each couch turn. */
export interface HandoffGate {
  handoff(playerLabel: string): Promise<void>;
}

/** TODO: replace with a real UI implementation that shows a handoff screen. */
export class NoOpHandoffGate implements HandoffGate {
  handoff(_playerLabel: string): Promise<void> {
    return Promise.resolve();
  }
}

export class CouchPlayerActor extends LocalPlayerActor {
  private readonly handoffGate: HandoffGate;
  private readonly playerLabel: string;

  constructor(
    playerId: string,
    playerLabel: string,
    handoffGate: HandoffGate = new NoOpHandoffGate(),
  ) {
    super(playerId);
    this.playerLabel = playerLabel;
    this.handoffGate = handoffGate;
  }

  override async awaitPick(availableCards: CardId[], boardSnapshot: BoardGrid): Promise<CardId> {
    await this.handoffGate.handoff(this.playerLabel);
    return super.awaitPick(availableCards, boardSnapshot);
  }

  override async awaitPlacement(cardId: CardId, boardSnapshot: BoardGrid): Promise<PlacementResult> {
    // No handoff before placement — the player already has the device from the pick step.
    return super.awaitPlacement(cardId, boardSnapshot);
  }
}
