/**
 * GameSession — OOP game state management
 *
 * Replaces the action/reducer pattern in Game.ts and Round.ts.
 * State is encapsulated inside objects; mutation happens via methods;
 * UI adapters subscribe to typed events via GameEventBus.
 */

import { getCard } from "../gamelogic/cards";
import type { PlayerId, CardId, Direction } from "./types";
import type { BoardGrid } from "./Board";
import { Player } from "./Player";
import { Deal, Round } from "./Round";

// Re-export sub-module classes and types for backward compatibility
export type { BoardCell, BoardGrid } from "./Board";
export { Board } from "./Board";
export { Player } from "./Player";
export { Deal, Round } from "./Round";
export type { RoundPhase } from "./Round";
export type { PlayerId, CardId } from "./types";

// ── GameEventBus ──────────────────────────────────────────────────────────────

export type GameEventMap = {
  "player:joined":  { player: Player };
  "game:started":   { players: ReadonlyArray<Player>; pickOrder: ReadonlyArray<Player> };
  "round:started":  { round: Round; roundNumber: number };
  "pick:made":      { player: Player; cardId: CardId; roundNumber: number };
  "place:made":     { player: Player; cardId: CardId; x: number; y: number; direction: Direction; roundNumber: number };
  "round:complete": { nextPickOrder: ReadonlyArray<Player>; roundNumber: number };
  "game:ended":     { scores: Array<{ player: Player; score: number }> };
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
    this.listeners.get(event)?.forEach(fn => fn(data as never));
  }
}

// ── GameSession ───────────────────────────────────────────────────────────────

export type GamePhase = "lobby" | "playing" | "finished";

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
  private _roundNumber = 0;

  // ── Player management ──

  addPlayer(player: Player): void {
    if (this._players.some(p => p.id === player.id)) return; // idempotent
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
    this._roundNumber++;
    this.events.emit("round:started", { round: this._currentRound, roundNumber: this._roundNumber });
  }

  /** Record a pick by any player (local or remote). */
  handlePick(playerId: PlayerId, cardId: CardId): void {
    const round = this._requireActiveRound();
    const player = this._requirePlayer(playerId);
    round.recordPick(player, cardId);
    this.events.emit("pick:made", { player, cardId, roundNumber: this._roundNumber });
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

    round.recordPlacement(player, x, y, direction);
    this.events.emit("place:made", { player, cardId, x, y, direction, roundNumber: this._roundNumber });

    if (round.phase === "complete") {
      const nextPickOrder = round.deal.nextRoundPickOrder();
      this._pickOrder = nextPickOrder;
      this._currentRound = null;
      this.events.emit("round:complete", { nextPickOrder, roundNumber: this._roundNumber });
    }
  }

  /** Convenience: place for the local player. */
  handleLocalPlacement(x: number, y: number, direction: Direction): void {
    const me = this._requireLocalPlayer();
    this.handlePlacement(me.id, x, y, direction);
  }

  endGame(): void {
    this._phase = "finished";
    const scores = this._players
      .map(p => ({ player: p, score: p.score() }))
      .sort((a, b) => b.score - a.score);
    this.events.emit("game:ended", { scores });
  }

  // ── Read-only accessors ──

  get phase(): GamePhase                    { return this._phase; }
  get players(): ReadonlyArray<Player>      { return this._players; }
  get currentRound(): Round | null          { return this._currentRound; }
  get pickOrder(): ReadonlyArray<Player>    { return this._pickOrder; }
  get roundNumber(): number                 { return this._roundNumber; }

  myPlayer(): Player | undefined {
    return this._players.find(p => p.isLocal);
  }

  playerById(id: PlayerId): Player | undefined {
    return this._players.find(p => p.id === id);
  }

  hasEnoughPlayers(): boolean {
    return this._players.length >= 2;
  }

  isMyTurn(): boolean {
    const me = this.myPlayer();
    if (!me || !this._currentRound) return false;
    return this._currentRound.phase === "picking"
      && this._currentRound.currentActor?.id === me.id;
  }

  isMyPlace(): boolean {
    const me = this.myPlayer();
    if (!me || !this._currentRound) return false;
    return this._currentRound.phase === "placing"
      && this._currentRound.currentActor?.id === me.id;
  }

  /** Card the local player has picked this round and must place (placing phase only). */
  localCardToPlace(): CardId | undefined {
    const me = this.myPlayer();
    if (!me || !this._currentRound || this._currentRound.phase !== "placing") return undefined;
    if (this._currentRound.currentActor?.id !== me.id) return undefined;
    return this._currentRound.deal.pickedCardFor(me) ?? undefined;
  }

  /**
   * Returns the 4 deal cards in canonical (sorted) order as card-info objects.
   * Compatible with the existing getCard() return format used by visual components.
   */
  deal(): ReturnType<typeof getCard>[] {
    const snap = this._currentRound?.deal.snapshot();
    if (!snap) return [];
    return snap.map(s => getCard(s.cardId));
  }

  /** Board grid for a player — compatible with board.ts utility functions. */
  boardFor(playerId: PlayerId): BoardGrid {
    return this._players.find(p => p.id === playerId)?.board.snapshot() ?? [];
  }

  // ── Private helpers ──

  private _requirePlayer(id: PlayerId): Player {
    const player = this._players.find(p => p.id === id);
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

