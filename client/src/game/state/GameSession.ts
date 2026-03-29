/**
 * GameSession — OOP game state management
 *
 * Replaces the action/reducer pattern in Game.ts and Round.ts.
 * State is encapsulated inside objects; mutation happens via methods;
 * UI adapters subscribe to typed events via GameEventBus.
 */

import { getCard } from "kingdomino-engine";
import {
  findPlacementWithin5x5,
  findPlacementWithin7x7,
  getEligiblePositions,
  getValidDirections,
  staysWithin5x5,
  staysWithin7x7,
  type PlayerId, type CardId, type Direction,
  type BoardGrid,
  Player, Deal, Round,
  type GameVariant,
} from "kingdomino-engine";

// Re-export sub-module classes and types for backward compatibility
export type { BoardCell, BoardGrid, BoardPlacement } from "kingdomino-engine";
export { Board, Player, Deal, Round } from "kingdomino-engine";
export type { RoundPhase, PlayerId, CardId } from "kingdomino-engine";

// ── GameEventBus ──────────────────────────────────────────────────────────────

export type GameEventMap = {
  "player:joined": { player: Player };
  "game:started": { players: ReadonlyArray<Player>; pickOrder: ReadonlyArray<Player> };
  "round:started": { round: Round };
  "pick:made": { player: Player; cardId: CardId };
  "place:made": {
    player: Player;
    cardId: CardId;
    x: number;
    y: number;
    direction: Direction;
  };
  "discard:made": { player: Player; cardId: CardId };
  "round:complete": { nextPickOrder: ReadonlyArray<Player> };
  "game:ended": {
    scores: Array<{
      player: Player;
      score: number;
      bonuses: { middleKingdom: number; harmony: number };
    }>;
  };
};

type Listener<K extends keyof GameEventMap> = (event: GameEventMap[K]) => void;

/**
 * Typed pub/sub event bus.
 * on() returns an unsubscribe function. Decouples GameSession from UI/network layers.
 */
export class GameEventBus {
  private listeners = new Map<keyof GameEventMap, Set<Listener<never>>>();

  on<K extends keyof GameEventMap>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener as Listener<never>);
    return () => this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof GameEventMap>(event: K, data: GameEventMap[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(data as never));
  }
}

// ── GameSession ───────────────────────────────────────────────────────────────

export type GamePhase = "lobby" | "playing" | "finished";

export type GameBonuses = { middleKingdom?: boolean; harmony?: boolean };

/**
 * Top-level game orchestrator. Owns all Players and the active Round.
 *
 * PUBLIC MUTATION API
 * ────────────────────
 *  addPlayer(player)                                — lobby: register a participant
 *  startGame(pickOrder)                             — lobby → playing
 *  beginRound(cardIds)                              — deal 4 cards, start picking sequence
 *  handlePick(playerId, cardId)                     — record a pick (from UI or peer message)
 *  handleLocalPick(cardId)                          — convenience: pick for the local player
 *  handlePlacement(playerId, x, y, direction)       — record a placement
 *  handleLocalPlacement(x, y, direction)            — convenience: place for the local player
 *  endGame()                                        — compute final scores
 */
export class GameSession {
  readonly events = new GameEventBus();

  private _phase: GamePhase = "lobby";
  private _players: Player[] = [];
  private _pickOrder: Player[] = [];
  private _currentRound: Round | null = null;
  private readonly _variant: GameVariant;
  private readonly _bonuses: GameBonuses;
  private readonly _localPlayerId: PlayerId | undefined;
  private readonly _discardedPlayerIds = new Set<string>();

  constructor({ variant = "standard", bonuses = {}, localPlayerId }: { variant?: GameVariant; bonuses?: GameBonuses; localPlayerId?: PlayerId } = {}) {
    this._variant = variant;
    this._bonuses = bonuses;
    this._localPlayerId = localPlayerId;
  }

  private _staysWithinBounds(board: BoardGrid, x: number, y: number, direction: Direction): boolean {
    return this._variant === "mighty-duel"
      ? staysWithin7x7(board, x, y, direction)
      : staysWithin5x5(board, x, y, direction);
  }

  private _findPlacementWithinBounds(board: BoardGrid, cardId: CardId) {
    return this._variant === "mighty-duel"
      ? findPlacementWithin7x7(board, cardId)
      : findPlacementWithin5x5(board, cardId);
  }

  get variant(): GameVariant {
    return this._variant;
  }

  // ── Player management ──

  addPlayer(player: Player): void {
    if (this._players.some((p) => p.id === player.id)) return; // idempotent
    this._players.push(player);
    this.events.emit("player:joined", { player });
  }

  // ── Lobby → Game ──

  /**
   * Transitions the session to the playing phase with a given pick order.
   * Called by the flow module after the peer seed exchange determines order.
   */
  startGame(pickOrder: Player[]): void {
    if (this._phase !== "lobby") throw new Error("Game not in lobby phase");
    this._pickOrder = [...pickOrder];
    this._phase = "playing";
    this.events.emit("game:started", { players: [...this._players], pickOrder: [...pickOrder] });
  }

  // ── Round management ──

  /** Deal 4 cards and begin this round's pick sequence. */
  beginRound(cardIds: [CardId, CardId, CardId, CardId]): void {
    if (this._phase !== "playing") throw new Error("Game not in playing phase");
    const deal = new Deal(cardIds);
    this._currentRound = new Round(deal, this._pickOrder);
    this.events.emit("round:started", { round: this._currentRound });
  }

  /** Record a pick by any player (local or remote). */
  handlePick(playerId: PlayerId, cardId: CardId): void {
    const round = this._requireActiveRound();
    const player = this._requirePlayer(playerId);
    round.recordPick(player, cardId);
    this.events.emit("pick:made", { player, cardId });
  }

  /** Convenience: pick for the local player. */
  handleLocalPick(cardId: CardId): void {
    const me = this._requireLocalPlayer();
    this.handlePick(me.id, cardId);
  }

  /** Record a placement by any player (local or remote). */
  handlePlacement(playerId: PlayerId, x: number, y: number, direction: Direction): void {
    const round = this._requireActiveRound();
    const player = this._requirePlayer(playerId);
    const cardId = round.deal.pickedCardFor(player);
    if (cardId === null) throw new Error(`${playerId} has no picked card to place`);

    const board = player.board.snapshot();
    const isEligibleTile = getEligiblePositions(board, cardId).some(
      (pos) => pos.x === x && pos.y === y,
    );
    if (!isEligibleTile) {
      throw new Error(`Invalid placement tile for player ${playerId}: (${x}, ${y})`);
    }

    const isEligibleDirection = getValidDirections(board, cardId, x, y).some(
      (d) => d === direction,
    );
    if (!isEligibleDirection) {
      throw new Error(`Invalid placement direction for player ${playerId}: ${direction}`);
    }

    if (!this._staysWithinBounds(board, x, y, direction)) {
      throw new Error(
        `Placement exceeds ${this._variant === "mighty-duel" ? "7x7" : "5x5"} kingdom for player ${playerId}: (${x}, ${y}, ${direction})`,
      );
    }

    round.recordPlacement(player, x, y, direction);
    this.events.emit("place:made", {
      player,
      cardId,
      x,
      y,
      direction,
    });

    if (round.phase === "complete") {
      const nextPickOrder = round.deal.nextRoundPickOrder();
      this._pickOrder = nextPickOrder;
      this._currentRound = null;
      this.events.emit("round:complete", { nextPickOrder });
    }
  }

  /** Convenience: place for the local player. */
  handleLocalPlacement(x: number, y: number, direction: Direction): void {
    const me = this._requireLocalPlayer();
    this.handlePlacement(me.id, x, y, direction);
  }

  /**
   * Discard the picked card for a player when no legal placement exists within kingdom bounds.
   * Throws if the player hasn't picked, or if a valid placement is available.
   */
  handleDiscard(playerId: PlayerId): void {
    const round = this._requireActiveRound();
    const player = this._requirePlayer(playerId);
    const cardId = round.deal.pickedCardFor(player);
    if (cardId === null) throw new Error(`${playerId} has no picked card to discard`);

    const board = player.board.snapshot();
    const hasValidPlacement = this._findPlacementWithinBounds(board, cardId) !== null;
    if (hasValidPlacement) {
      throw new Error(
        `${playerId} has a valid placement; must place the domino, cannot discard`,
      );
    }

    round.recordDiscard(player);
    // Track discarded players so endGame() can withhold the Harmony bonus.
    // NOTE: Only local player discards reach this path in the current flow.
    // Remote player discards are a pre-existing gap in the peer protocol
    // (game.messages.ts MovePayload carries no discard flag), so remote
    // players who discard will still receive the Harmony bonus.
    this._discardedPlayerIds.add(player.id);
    this.events.emit("discard:made", { player, cardId });

    if (round.phase === "complete") {
      const nextPickOrder = round.deal.nextRoundPickOrder();
      this._pickOrder = nextPickOrder;
      this._currentRound = null;
      this.events.emit("round:complete", { nextPickOrder });
    }
  }

  /** Convenience: discard for the local player. */
  handleLocalDiscard(): void {
    const me = this._requireLocalPlayer();
    this.handleDiscard(me.id);
  }

  endGame(): void {
    this._phase = "finished";
    const scores = this._players
      .map((p) => {
        const baseScore = p.score();
        const mkBonus = this._bonuses.middleKingdom && p.board.isCastleCentered() ? 10 : 0;
        const harmonyBonus = this._bonuses.harmony && !this._discardedPlayerIds.has(p.id) ? 5 : 0;
        return {
          player: p,
          score: baseScore + mkBonus + harmonyBonus,
          bonuses: { middleKingdom: mkBonus, harmony: harmonyBonus },
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const largestA = a.player.board.largestPropertySize();
        const largestB = b.player.board.largestPropertySize();
        if (largestB !== largestA) return largestB - largestA;
        return b.player.board.totalCrowns() - a.player.board.totalCrowns();
      });
    this.events.emit("game:ended", { scores });
  }

  // ── Read-only accessors ──

  get phase(): GamePhase {
    return this._phase;
  }
  get players(): ReadonlyArray<Player> {
    return this._players;
  }
  get currentRound(): Round | null {
    return this._currentRound;
  }
  get pickOrder(): ReadonlyArray<Player> {
    return this._pickOrder;
  }

  myPlayer(): Player | undefined {
    return this._players.find((p) => p.id === this._localPlayerId);
  }

  playerById(id: PlayerId): Player | undefined {
    return this._players.find((p) => p.id === id);
  }

  hasEnoughPlayers(): boolean {
    return this._players.length >= 2;
  }

  isMyTurn(): boolean {
    const me = this.myPlayer();
    if (!me || !this._currentRound) return false;
    return this._currentRound.phase === "picking" && this._currentRound.currentActor?.id === me.id;
  }

  isMyPlace(): boolean {
    const me = this.myPlayer();
    if (!me || !this._currentRound) return false;
    return this._currentRound.phase === "placing" && this._currentRound.currentActor?.id === me.id;
  }

  /** Card the local player has picked this round and must place (placing phase only). */
  localCardToPlace(): CardId | undefined {
    const me = this.myPlayer();
    if (!me || !this._currentRound || this._currentRound.phase !== "placing") return undefined;
    if (this._currentRound.currentActor?.id !== me.id) return undefined;
    return this._currentRound.deal.pickedCardFor(me) ?? undefined;
  }

  /** Eligible anchor positions for the local player's card-to-place. Returns [] when not in placing phase. */
  localEligiblePositions(): Array<{ x: number; y: number }> {
    const me = this.myPlayer();
    if (!me || !this._currentRound || this._currentRound.phase !== "placing") return [];
    if (this._currentRound.currentActor?.id !== me.id) return [];
    const cardId = this._currentRound.deal.pickedCardFor(me);
    if (cardId === null) return [];
    return getEligiblePositions(me.board.snapshot(), cardId);
  }

  /** Valid placement directions for the local player's card at grid position (x, y). Returns [] when not in placing phase. */
  localValidDirectionsAt(x: number, y: number): Direction[] {
    const me = this.myPlayer();
    if (!me || !this._currentRound || this._currentRound.phase !== "placing") return [];
    if (this._currentRound.currentActor?.id !== me.id) return [];
    const cardId = this._currentRound.deal.pickedCardFor(me);
    if (cardId === null) return [];
    const board = me.board.snapshot();
    return getValidDirections(board, cardId, x, y).filter((d) =>
      this._staysWithinBounds(board, x, y, d),
    );
  }

  /** Returns true if the local player has any valid placement for their picked card within kingdom bounds. */
  hasLocalValidPlacement(): boolean {
    const me = this.myPlayer();
    if (!me || !this._currentRound || this._currentRound.phase !== "placing") return false;
    if (this._currentRound.currentActor?.id !== me.id) return false;
    const cardId = this._currentRound.deal.pickedCardFor(me);
    if (cardId === null) return false;
    return this._findPlacementWithinBounds(me.board.snapshot(), cardId) !== null;
  }

  /**
   * Returns the 4 deal cards in canonical (sorted) order as card-info objects.
   * Compatible with the existing getCard() return format used by visual components.
   */
  deal(): ReturnType<typeof getCard>[] {
    const snap = this._currentRound?.deal.snapshot();
    if (!snap) return [];
    return snap.map((s) => getCard(s.cardId));
  }

  /** Board grid for a player — compatible with board.ts utility functions. */
  boardFor(playerId: PlayerId): BoardGrid {
    return this._players.find((p) => p.id === playerId)?.board.snapshot() ?? [];
  }

  // ── Private helpers ──

  private _requirePlayer(id: PlayerId): Player {
    const player = this._players.find((p) => p.id === id);
    if (!player) throw new Error(`Unknown player: "${id}"`);
    return player;
  }

  private _requireLocalPlayer(): Player {
    const me = this.myPlayer();
    if (!me) throw new Error("No local player in session");
    return me;
  }

  private _requireActiveRound(): Round {
    if (!this._currentRound) throw new Error("No active round");
    return this._currentRound;
  }
}
