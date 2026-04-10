/**
 * GameSession — OOP game state management
 */

import { getCard, generateDeck } from "./gamelogic/cards";
import { STANDARD, MIGHTY_DUEL } from "./gamelogic/cards";
import {
  findPlacementWithin5x5,
  findPlacementWithin7x7,
  getEligiblePositions,
  getValidDirections,
  staysWithin5x5,
  staysWithin7x7,
} from "./gamelogic/board";
import type { PlayerId, CardId, Direction } from "./types";
import type { SeedProvider } from "./SeedProvider";
import { chooseOrderFromSeed, getNextFourCards } from "./gamelogic/utils";
import type { BoardGrid } from "./Board";
import { Player } from "./Player";
import { Deal } from "./Deal";
import { Round, ROUND_PHASE_COMPLETE, ROUND_PHASE_PICKING, ROUND_PHASE_PLACING } from "./Round";
import { GameEventBus } from "./GameEventBus";
import type { GameVariant } from "./gamelogic/cards";
import {
  GAME_STARTED, ROUND_STARTED, PICK_MADE, PLACE_MADE, DISCARD_MADE,
  ROUND_COMPLETE, GAME_PAUSED, GAME_RESUMED, GAME_ENDED,
} from "./GameEvent";

export const GAME_PHASE_LOBBY    = "lobby"    as const;
export const GAME_PHASE_PLAYING  = "playing"  as const;
export const GAME_PHASE_PAUSED   = "paused"   as const;
export const GAME_PHASE_FINISHED = "finished" as const;
export type GamePhase = typeof GAME_PHASE_LOBBY | typeof GAME_PHASE_PLAYING | typeof GAME_PHASE_PAUSED | typeof GAME_PHASE_FINISHED;

export type GameBonuses = { middleKingdom?: boolean; harmony?: boolean };

/**
 * Top-level game orchestrator. Owns all Players and the active Round.
 *
 * PUBLIC MUTATION API
 * ────────────────────
 *  addPlayer(player)                                — lobby: register a participant
 *  startGame()                                      — lobby → playing; drives loop via SeedProvider
 *  beginRound(cardIds)          @internal           — deal 4 cards (test use / manual flow)
 *  handlePick(playerId, cardId)                     — record a pick (from UI or peer message)
 *  handleLocalPick(cardId)                          — convenience: pick for the local player
 *  handlePlacement(playerId, x, y, direction)       — record a placement
 *  handleLocalPlacement(x, y, direction)            — convenience: place for the local player
 *  endGame()                    @internal           — compute final scores (test use / manual flow)
 */
export class GameSession {
  readonly events = new GameEventBus();

  private _phase: GamePhase = GAME_PHASE_LOBBY;
  private _players: Player[] = [];
  private _pickOrder: Player[] = [];
  private _currentRound: Round | null = null;
  private readonly _variant: GameVariant;
  private readonly _bonuses: GameBonuses;
  private readonly _localPlayerId: PlayerId | undefined;
  private readonly _discardedPlayerIds = new Set<string>();
  private readonly _seedProvider: SeedProvider | undefined;
  private _remainingDeck: CardId[] = [];

  constructor({ variant = STANDARD, bonuses = {}, localPlayerId, seedProvider }: { variant?: GameVariant; bonuses?: GameBonuses; localPlayerId?: PlayerId; seedProvider?: SeedProvider } = {}) {
    this._variant = variant;
    this._bonuses = bonuses;
    this._localPlayerId = localPlayerId;
    this._seedProvider = seedProvider;
  }

  private _staysWithinBounds(board: BoardGrid, x: number, y: number, direction: Direction): boolean {
    return this._variant === MIGHTY_DUEL
      ? staysWithin7x7(board, x, y, direction)
      : staysWithin5x5(board, x, y, direction);
  }

  private _findPlacementWithinBounds(board: BoardGrid, cardId: CardId) {
    return this._variant === MIGHTY_DUEL
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
  }

  // ── Lobby → Game ──

  startGame(): void {
    if (this._phase !== GAME_PHASE_LOBBY) throw new Error("Game not in lobby phase");
    this._remainingDeck = [...generateDeck()];
    this._phase = GAME_PHASE_PLAYING;
    void this._runGameLoop();
  }

  private async _runGameLoop(): Promise<void> {
    if (!this._seedProvider) {
      // No seed provider: caller must drive rounds manually (legacy / testing)
      return;
    }
    try {
      const firstSeed = await this._seedProvider.nextSeed();
      const orderedIds = chooseOrderFromSeed(firstSeed, this._players.map((p) => p.id));
      this._pickOrder = orderedIds.map((id) => this._requirePlayer(id));
      this.events.emit({ type: GAME_STARTED, players: [...this._players], pickOrder: [...this._pickOrder] });

      while (this._remainingDeck.length > 0) {
        if (this._phase === GAME_PHASE_PAUSED) {
          await new Promise<void>((resolve) => {
            const off = this.events.on(GAME_RESUMED, () => { off(); resolve(); });
          });
        }
        if (this._phase !== GAME_PHASE_PLAYING) break;

        const seed = await this._seedProvider.nextSeed();
        const { next: cardIds, remaining } = getNextFourCards(seed, this._remainingDeck);
        this._remainingDeck = remaining as CardId[];

        this._beginRound(cardIds as [CardId, CardId, CardId, CardId]);

        await new Promise<void>((resolve) => {
          const off = this.events.on(ROUND_COMPLETE, () => { off(); resolve(); });
        });
      }

      if (this._phase === GAME_PHASE_PLAYING) {
        this._endGame();
      }
    } catch (e) {
      console.error("GameSession game loop error:", e);
    }
  }

  /** @internal — used by LobbyFlow until Task 8 wires SeedProvider into GameSession. */
  setPickOrder(players: Player[]): void {
    this._pickOrder = [...players];
  }

  // ── Round management ──

  private _beginRound(cardIds: [CardId, CardId, CardId, CardId]): void {
    const deal = new Deal(cardIds);
    this._currentRound = new Round(deal, this._pickOrder);
    this.events.emit({ type: ROUND_STARTED, round: this._currentRound });
  }

  /** @internal — test use only. In normal flow, the game loop calls _beginRound. */
  beginRound(cardIds: [CardId, CardId, CardId, CardId]): void {
    if (this._pickOrder.length === 0) {
      this._pickOrder = [...this._players];
    }
    this._beginRound(cardIds);
  }

  handlePick(playerId: PlayerId, cardId: CardId): void {
    const round = this._requireActiveRound();
    const player = this._requirePlayer(playerId);
    round.recordPick(player, cardId);
    this.events.emit({ type: PICK_MADE, player, cardId });
  }

  handleLocalPick(cardId: CardId): void {
    const me = this._requireLocalPlayer();
    this.handlePick(me.id, cardId);
  }

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
        `Placement exceeds ${this._variant === MIGHTY_DUEL ? "7x7" : "5x5"} kingdom for player ${playerId}: (${x}, ${y}, ${direction})`,
      );
    }

    round.recordPlacement(player, x, y, direction);
    this.events.emit({ type: PLACE_MADE, player, cardId, x, y, direction });

    if (round.phase === ROUND_PHASE_COMPLETE) {
      const nextPickOrder = round.deal.nextRoundPickOrder();
      this._pickOrder = nextPickOrder;
      this._currentRound = null;
      this.events.emit({ type: ROUND_COMPLETE, nextPickOrder });
    }
  }

  handleLocalPlacement(x: number, y: number, direction: Direction): void {
    const me = this._requireLocalPlayer();
    this.handlePlacement(me.id, x, y, direction);
  }

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
    this._discardedPlayerIds.add(player.id);
    this.events.emit({ type: DISCARD_MADE, player, cardId });

    if (round.phase === ROUND_PHASE_COMPLETE) {
      const nextPickOrder = round.deal.nextRoundPickOrder();
      this._pickOrder = nextPickOrder;
      this._currentRound = null;
      this.events.emit({ type: ROUND_COMPLETE, nextPickOrder });
    }
  }

  handleLocalDiscard(): void {
    const me = this._requireLocalPlayer();
    this.handleDiscard(me.id);
  }

  pause(): void {
    if (this._phase !== GAME_PHASE_PLAYING) throw new Error("Can only pause while playing");
    this._phase = GAME_PHASE_PAUSED;
    this.events.emit({ type: GAME_PAUSED });
  }

  resume(): void {
    if (this._phase !== GAME_PHASE_PAUSED) throw new Error("Can only resume while paused");
    this._phase = GAME_PHASE_PLAYING;
    this.events.emit({ type: GAME_RESUMED });
  }

  private _endGame(): void {
    this._phase = GAME_PHASE_FINISHED;
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
    this.events.emit({ type: GAME_ENDED, scores });
  }

  /** @internal — test use only. In normal flow, the game loop calls _endGame. */
  endGame(): void {
    this._endGame();
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

  hasEnoughPlayers(): boolean {
    return this._players.length >= 2;
  }

  isMyTurn(): boolean {
    const me = this.myPlayer();
    if (!me || !this._currentRound) return false;
    return this._currentRound.phase === ROUND_PHASE_PICKING && this._currentRound.currentActor?.id === me.id;
  }

  isMyPlace(): boolean {
    const me = this.myPlayer();
    if (!me || !this._currentRound) return false;
    return this._currentRound.phase === ROUND_PHASE_PLACING && this._currentRound.currentActor?.id === me.id;
  }

  localCardToPlace(): CardId | undefined {
    const me = this.myPlayer();
    if (!me || !this._currentRound || this._currentRound.phase !== ROUND_PHASE_PLACING) return undefined;
    if (this._currentRound.currentActor?.id !== me.id) return undefined;
    return this._currentRound.deal.pickedCardFor(me) ?? undefined;
  }

  localEligiblePositions(): Array<{ x: number; y: number }> {
    const me = this.myPlayer();
    if (!me || !this._currentRound || this._currentRound.phase !== ROUND_PHASE_PLACING) return [];
    if (this._currentRound.currentActor?.id !== me.id) return [];
    const cardId = this._currentRound.deal.pickedCardFor(me);
    if (cardId === null) return [];
    return getEligiblePositions(me.board.snapshot(), cardId);
  }

  localValidDirectionsAt(x: number, y: number): Direction[] {
    const me = this.myPlayer();
    if (!me || !this._currentRound || this._currentRound.phase !== ROUND_PHASE_PLACING) return [];
    if (this._currentRound.currentActor?.id !== me.id) return [];
    const cardId = this._currentRound.deal.pickedCardFor(me);
    if (cardId === null) return [];
    const board = me.board.snapshot();
    return getValidDirections(board, cardId, x, y).filter((d) =>
      this._staysWithinBounds(board, x, y, d),
    );
  }

  hasLocalValidPlacement(): boolean {
    const me = this.myPlayer();
    if (!me || !this._currentRound || this._currentRound.phase !== ROUND_PHASE_PLACING) return false;
    if (this._currentRound.currentActor?.id !== me.id) return false;
    const cardId = this._currentRound.deal.pickedCardFor(me);
    if (cardId === null) return false;
    return this._findPlacementWithinBounds(me.board.snapshot(), cardId) !== null;
  }

  deal(): ReturnType<typeof getCard>[] {
    const snap = this._currentRound?.deal.snapshot();
    if (!snap) return [];
    return snap.map((s) => getCard(s.cardId));
  }

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
