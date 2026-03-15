/**
 * OOP Game State Design — Kingdomino
 * ====================================
 *
 * This file is a DESIGN STUDY. It does not change or replace any existing code.
 *
 * APPROACH
 * --------
 * Rather than dispatching actions to a central reducer (action → reducer → new state),
 * state is encapsulated inside objects that expose methods for valid transitions.
 *
 *   Action/Reducer pattern:
 *     dispatch({ type: "round/cardPicked", payload: { card, playerId } })
 *     → root reducer → roundReducer → new state slice
 *
 *   OOP pattern:
 *     game.handlePick(playerId, slotIndex)
 *     → Round validates phase → Deal records pick → events emitted
 *
 * KEY DESIGN PRINCIPLES
 * ----------------------
 *  1. Encapsulation      — Objects own and protect their state through private fields,
 *                          exposing only intentional mutation paths (methods).
 *
 *  2. State Machines     — GameSession and Round track explicit phase enums.
 *                          Invalid transitions throw rather than silently producing
 *                          inconsistent state.
 *
 *  3. Immutable Values   — TileCell, Domino, and Placement are frozen after creation.
 *                          Board returns a *new* Board from place(), enabling undo history
 *                          without external helpers.
 *
 *  4. Tell, Don't Ask    — Instead of querying state and computing outside the object,
 *                          call a method that encapsulates the logic (e.g., board.score()).
 *
 *  5. Observer / Events  — GameEventBus decouples the session from UI or network adapters.
 *                          Listeners subscribe to typed events; the session doesn't know
 *                          anything about React, signals, or WebRTC.
 *
 * CLASS HIERARCHY
 * ---------------
 *  Value Objects (frozen, no mutation):
 *    TileCell    — terrain type + crown count for one half of a domino
 *    Domino      — two TileCells + canonical card id
 *    Placement   — a Domino + board position (x, y, direction)
 *
 *  Entities (mutable, own identity):
 *    Board       — 13×13 grid; validates and applies placements; computes score
 *    Player      — identity + board; owns its own Board instance
 *    Deal        — 4 pick slots for a round; tracks who chose which domino
 *    Round       — phase state machine wrapping a Deal
 *    GameSession — top-level orchestrator; owns Players, Rounds, and the event bus
 *
 *  Infrastructure:
 *    GameEventBus   — typed pub/sub bus; produces no side effects itself
 */

// ─── DOMAIN ENUMS ────────────────────────────────────────────────────────────

/**
 * Bitmask terrain values mirror the existing cards.ts constants so that
 * bitwise adjacency checks still work (tile & type !== 0 means compatible).
 */
export enum Terrain {
  blank   = -1,
  castle  =  0,
  wood    =  1,  // 2^0
  grass   =  2,  // 2^1
  water   =  4,  // 2^2
  grain   =  8,  // 2^3
  marsh   = 16,  // 2^4
  mine    = 32,  // 2^5
}

export enum Direction {
  up    = 0,
  right = 1,
  down  = 2,
  left  = 3,
}

export enum RoundPhase {
  dealing,  // dominoes are being prepared / dealt to the table
  picking,  // players are choosing their domino from the deal
  placing,  // players are placing their previously-picked domino on the board
  complete, // all placements done; ready for next round
}

export enum GamePhase {
  lobby,    // waiting for players
  playing,  // rounds are in progress
  scoring,  // computing final scores
  finished, // game over
}

// ─── VALUE OBJECTS ───────────────────────────────────────────────────────────

/** One half of a domino: the terrain type and how many crowns it carries. */
export class TileCell {
  constructor(
    readonly terrain: Terrain,
    readonly crowns: number, // 0–3
  ) {
    if (crowns < 0 || crowns > 3) throw new RangeError(`Crown count must be 0–3, got ${crowns}`);
    Object.freeze(this);
  }
}

/**
 * A domino card: two TileCells and a canonical id (0–47).
 * The terrainMask is a bitmask union used for adjacency validation,
 * mirroring the XOR logic in the existing cards.ts getTile() function.
 */
export class Domino {
  readonly terrainMask: number;

  constructor(
    readonly id: number,
    readonly tileA: TileCell,
    readonly tileB: TileCell,
  ) {
    // When both terrains are the same XOR produces 0 — fall back to the terrain itself.
    this.terrainMask = (tileA.terrain ^ tileB.terrain) || tileA.terrain;
    Object.freeze(this);
  }
}

/**
 * Describes where and how a domino was placed on the board.
 * The direction is from tileA → tileB (e.g., Direction.right means tileB is
 * one cell to the right of tileA).
 */
export class Placement {
  constructor(
    readonly domino: Domino,
    readonly x: number,       // column of tileA
    readonly y: number,       // row of tileA
    readonly direction: Direction,
  ) {
    Object.freeze(this);
  }
}

// ─── BOARD ───────────────────────────────────────────────────────────────────

export type GridCell = { terrain: Terrain; crowns: number } | null;

/**
 * The player's kingdom board — a 13×13 grid with the castle pre-placed at [6][6].
 *
 * Board is immutable-friendly: place() returns a NEW Board, so callers can keep
 * a history of boards for undo/preview without any external cloning logic.
 *
 * Compare to the existing approach where board state lives in Redux as a plain
 * array and placedCardsToBoard() rebuilds it from scratch each time.
 * Here the Board owns its own incremental update logic.
 */
export class Board {
  static readonly SIZE = 13;
  static readonly CASTLE_X = 6;
  static readonly CASTLE_Y = 6;

  private readonly grid: ReadonlyArray<ReadonlyArray<GridCell>>;
  private readonly _placements: ReadonlyArray<Placement>;

  private constructor(
    grid: ReadonlyArray<ReadonlyArray<GridCell>>,
    placements: ReadonlyArray<Placement>,
  ) {
    this.grid = grid;
    this._placements = placements;
  }

  /** Creates a fresh board with only the castle placed. */
  static empty(): Board {
    const grid: GridCell[][] = Array.from({ length: Board.SIZE }, () =>
      Array<GridCell>(Board.SIZE).fill(null),
    );
    grid[Board.CASTLE_Y][Board.CASTLE_X] = { terrain: Terrain.castle, crowns: 0 };
    return new Board(grid, []);
  }

  // Vector offsets for each direction (tileA → tileB)
  private static readonly DX: Record<Direction, number> = {
    [Direction.up]: 0, [Direction.right]: 1, [Direction.down]: 0, [Direction.left]: -1,
  };
  private static readonly DY: Record<Direction, number> = {
    [Direction.up]: -1, [Direction.right]: 0, [Direction.down]: 1, [Direction.left]: 0,
  };

  private secondTilePos(x: number, y: number, direction: Direction) {
    return { x: x + Board.DX[direction], y: y + Board.DY[direction] };
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < Board.SIZE && y >= 0 && y < Board.SIZE;
  }

  private cellAt(x: number, y: number): GridCell {
    return this.inBounds(x, y) ? this.grid[y][x] : null;
  }

  private neighbors(x: number, y: number): { x: number; y: number }[] {
    return (
      [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }]
        .filter(n => this.inBounds(n.x, n.y))
    );
  }

  /**
   * A cell is a valid adjacency anchor for `terrain` if it is:
   *   - the castle (everything is adjacent to the castle), or
   *   - the same terrain (bitmask-compatible)
   */
  private isCompatible(cell: GridCell, terrain: Terrain): boolean {
    if (cell === null) return false;
    return cell.terrain === Terrain.castle || (cell.terrain & terrain) !== 0;
  }

  /**
   * Returns true if the domino can be legally placed at (x, y) facing direction.
   *
   * Rules enforced:
   *  1. Both tile positions are within bounds.
   *  2. Both tile cells are currently empty.
   *  3. At least one tile is adjacent to an already-placed compatible terrain
   *     (or the castle).
   *
   * Note: The original 5×5 constraint (kingdom must fit in a max 5×5 area) is
   * omitted here for brevity but could be added by bounding the occupied cells.
   */
  canPlace(domino: Domino, x: number, y: number, direction: Direction): boolean {
    const bPos = this.secondTilePos(x, y, direction);

    if (!this.inBounds(x, y) || !this.inBounds(bPos.x, bPos.y)) return false;
    if (this.cellAt(x, y) !== null || this.cellAt(bPos.x, bPos.y) !== null) return false;

    const aNeighbors = this.neighbors(x, y).map(n => this.cellAt(n.x, n.y));
    const bNeighbors = this.neighbors(bPos.x, bPos.y).map(n => this.cellAt(n.x, n.y));

    const aOk = aNeighbors.some(c => this.isCompatible(c, domino.tileA.terrain));
    const bOk = bNeighbors.some(c => this.isCompatible(c, domino.tileB.terrain));

    return aOk || bOk;
  }

  /**
   * Returns a new Board with the placement applied.
   * Throws if the placement is illegal — callers should use canPlace() first
   * when the placement originates from user input.
   */
  place(placement: Placement): Board {
    const { domino, x, y, direction } = placement;
    if (!this.canPlace(domino, x, y, direction)) {
      throw new Error(
        `Invalid placement: domino ${domino.id} at (${x},${y}) facing ${Direction[direction]}`,
      );
    }

    const bPos = this.secondTilePos(x, y, direction);

    // Deep-copy only the affected rows (rest are shared — structural sharing)
    const newGrid = this.grid.map((row, ry) => {
      if (ry === y || ry === bPos.y) return row.slice();
      return row;
    }) as GridCell[][];

    newGrid[y][x]         = { terrain: domino.tileA.terrain, crowns: domino.tileA.crowns };
    newGrid[bPos.y][bPos.x] = { terrain: domino.tileB.terrain, crowns: domino.tileB.crowns };

    return new Board(newGrid, [...this._placements, placement]);
  }

  /**
   * Scores the board: for each contiguous same-terrain region,
   * score = (number of cells in region) × (total crowns in region).
   */
  score(): number {
    const visited = Array.from({ length: Board.SIZE }, () =>
      new Array<boolean>(Board.SIZE).fill(false),
    );
    let total = 0;

    for (let y = 0; y < Board.SIZE; y++) {
      for (let x = 0; x < Board.SIZE; x++) {
        const cell = this.grid[y][x];
        if (visited[y][x] || cell === null) continue;
        if (cell.terrain === Terrain.castle || cell.terrain === Terrain.blank) continue;

        // BFS flood-fill to find the connected region
        const queue: [number, number][] = [[x, y]];
        let regionSize = 0;
        let regionCrowns = 0;

        while (queue.length > 0) {
          const [cx, cy] = queue.pop()!;
          if (visited[cy][cx]) continue;
          visited[cy][cx] = true;
          regionSize++;
          regionCrowns += this.grid[cy][cx]?.crowns ?? 0;

          for (const n of this.neighbors(cx, cy)) {
            if (!visited[n.y][n.x] && this.grid[n.y][n.x]?.terrain === cell.terrain) {
              queue.push([n.x, n.y]);
            }
          }
        }

        total += regionSize * regionCrowns;
      }
    }

    return total;
  }

  /** Read-only snapshot for rendering. Grid values are structurally shared. */
  snapshot(): ReadonlyArray<ReadonlyArray<GridCell>> {
    return this.grid;
  }

  get placements(): ReadonlyArray<Placement> {
    return this._placements;
  }
}

// ─── PLAYER ──────────────────────────────────────────────────────────────────

/**
 * A participant in the game. Owns a Board and records placements onto it.
 *
 * The Player stores its board as a mutable reference to an immutable Board
 * value, so each place() creates a new Board while the Player object itself
 * stays stable (useful for event listener identity / React keys).
 */
export class Player {
  private _board: Board;

  constructor(
    readonly id: string,
    readonly isLocal: boolean,
    board?: Board,
  ) {
    this._board = board ?? Board.empty();
  }

  get board(): Board {
    return this._board;
  }

  score(): number {
    return this._board.score();
  }

  /** Called by Round.recordPlacement — applies the placement and advances the board. */
  applyPlacement(placement: Placement): void {
    this._board = this._board.place(placement);
  }
}

// ─── DEAL ────────────────────────────────────────────────────────────────────

type PickSlot = {
  domino: Domino;
  pickedBy: Player | null;
};

/**
 * The four dominoes offered during a single round.
 *
 * Manages the per-slot pick state. After all picks are made,
 * nextRoundPickOrder() derives who goes first next round (by domino id ascending —
 * the player who picked the lowest-numbered card goes first).
 */
export class Deal {
  private readonly slots: PickSlot[];

  constructor(dominoes: [Domino, Domino, Domino, Domino]) {
    // Sort dominoes by id so the row is in canonical display order
    this.slots = [...dominoes]
      .sort((a, b) => a.id - b.id)
      .map(domino => ({ domino, pickedBy: null }));
  }

  pick(player: Player, slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= this.slots.length) {
      throw new RangeError(`Slot index ${slotIndex} is out of range`);
    }
    if (this.slots[slotIndex].pickedBy !== null) {
      throw new Error(`Slot ${slotIndex} is already claimed`);
    }
    this.slots[slotIndex].pickedBy = player;
  }

  pickedDominoFor(player: Player): Domino | null {
    return this.slots.find(s => s.pickedBy?.id === player.id)?.domino ?? null;
  }

  /** Players sorted by the id of their chosen domino — low id = goes first next round. */
  nextRoundPickOrder(): Player[] {
    return this.slots
      .filter(s => s.pickedBy !== null)
      .map(s => s.pickedBy!);
    // slots were already sorted by domino.id in the constructor, so order is preserved
  }

  isComplete(): boolean {
    return this.slots.every(s => s.pickedBy !== null);
  }

  snapshot(): ReadonlyArray<Readonly<PickSlot>> {
    return this.slots.map(s => ({ ...s }));
  }
}

// ─── ROUND ───────────────────────────────────────────────────────────────────

/**
 * Manages one round's lifecycle as an explicit state machine:
 *
 *   dealing → picking → placing → complete
 *
 * Phase transitions are enforced: calling recordPick while in "placing" phase
 * throws immediately rather than silently updating wrong state.
 *
 * Compare with the existing ROUND_START / WHOSE_TURN / MY_PICK / MY_PLACE
 * action constants: those require a central reducer to interpret. Here the
 * Round object itself knows what's valid in each phase.
 */
export class Round {
  private _phase: RoundPhase = RoundPhase.dealing;
  private _pickOrder: ReadonlyArray<Player>;
  private _pickIndex = 0;
  private _placedPlayers = new Set<string>();

  constructor(
    private readonly _deal: Deal,
    pickOrder: ReadonlyArray<Player>,
  ) {
    this._pickOrder = pickOrder;
  }

  get phase(): RoundPhase { return this._phase; }
  get deal(): Deal        { return this._deal; }

  get currentPicker(): Player | null {
    if (this._phase !== RoundPhase.picking) return null;
    return this._pickOrder[this._pickIndex] ?? null;
  }

  // ── Transitions ──

  beginPicking(): void {
    this.assertPhase(RoundPhase.dealing, "beginPicking");
    this._phase = RoundPhase.picking;
    this._pickIndex = 0;
  }

  recordPick(player: Player, slotIndex: number): void {
    this.assertPhase(RoundPhase.picking, "recordPick");
    if (player.id !== this.currentPicker?.id) {
      throw new Error(`Not ${player.id}'s turn to pick (expected ${this.currentPicker?.id})`);
    }
    this._deal.pick(player, slotIndex);
    this._pickIndex++;
    if (this._deal.isComplete()) {
      this._phase = RoundPhase.placing;
    }
  }

  recordPlacement(player: Player, placement: Placement): void {
    this.assertPhase(RoundPhase.placing, "recordPlacement");
    const expectedDomino = this._deal.pickedDominoFor(player);
    if (!expectedDomino) {
      throw new Error(`${player.id} has no picked domino to place`);
    }
    if (placement.domino.id !== expectedDomino.id) {
      throw new Error(
        `${player.id} must place domino ${expectedDomino.id}, got ${placement.domino.id}`,
      );
    }
    player.applyPlacement(placement);
    this._placedPlayers.add(player.id);
    if (this._placedPlayers.size === this._pickOrder.length) {
      this._phase = RoundPhase.complete;
    }
  }

  allPlayersPlaced(): boolean {
    return this._phase === RoundPhase.complete;
  }

  private assertPhase(expected: RoundPhase, method: string): void {
    if (this._phase !== expected) {
      throw new Error(
        `Round.${method}() requires phase "${RoundPhase[expected]}", current phase is "${RoundPhase[this._phase]}"`,
      );
    }
  }
}

// ─── EVENT BUS ───────────────────────────────────────────────────────────────

/**
 * Typed pub/sub event bus.
 *
 * The GameSession emits events here; UI adapters (React hooks, network layers)
 * subscribe without coupling themselves to the session's internals. This is the
 * OOP equivalent of subscribing to a Redux store + action type guards.
 *
 * Returns an unsubscribe function from on() so cleanup is trivial:
 *   const off = bus.on("pick:made", handler);
 *   // ... later ...
 *   off();
 */
export type GameEventMap = {
  "game:started":   { players: readonly Player[] };
  "round:started":  { round: Round; roundNumber: number };
  "pick:expected":  { player: Player; roundNumber: number };
  "pick:made":      { player: Player; domino: Domino; slotIndex: number; roundNumber: number };
  "place:expected": { player: Player; domino: Domino; roundNumber: number };
  "place:made":     { player: Player; placement: Placement; roundNumber: number };
  "round:complete": { round: Round; nextPickOrder: Player[]; roundNumber: number };
  "game:ended":     { scores: Array<{ player: Player; score: number }> };
};

type Listener<K extends keyof GameEventMap> = (event: GameEventMap[K]) => void;

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

// ─── GAME SESSION ─────────────────────────────────────────────────────────────

/**
 * Top-level game orchestrator.
 *
 * GameSession holds the full game tree: all Player instances, the deck of
 * remaining dominoes, and the sequence of completed/active Rounds.
 *
 * PUBLIC API
 * ──────────
 *  addPlayer(player)                         — lobby only
 *  start(deck, initialPickOrder)             — transitions lobby → playing
 *  handlePick(playerId, slotIndex)           — during picking phase
 *  handlePlacement(playerId, x, y, dir)      — during placing phase
 *  advanceRound()                            — after all placements complete
 *
 * EVENT HOOKS (via .events)
 * ─────────────────────────
 *  game:started, round:started, pick:expected, pick:made,
 *  place:expected, place:made, round:complete, game:ended
 *
 * COMPARISON WITH EXISTING ARCHITECTURE
 * ──────────────────────────────────────
 *  Existing: emitGameAction(Round.myPick()) → store signal → Game.reduceRound() → Round.reduce()
 *            UI reads state via useGameSelector() + aliens-signal computed
 *
 *  OOP:      game.handlePick(id, slot) → Round validates → events fired → listeners update UI
 *            No central store; the game object IS the source of truth
 */
export class GameSession {
  readonly events = new GameEventBus();

  private _phase: GamePhase = GamePhase.lobby;
  private _players: Player[] = [];
  private _rounds: Round[] = [];
  private _remainingDeck: Domino[] = [];
  private _pickOrder: Player[] = [];

  // ── Player management ──

  addPlayer(player: Player): void {
    if (this._phase !== GamePhase.lobby) throw new Error("Cannot add players after game start");
    if (this._players.length >= 4)       throw new Error("Maximum 4 players");
    if (this._players.some(p => p.id === player.id)) {
      throw new Error(`Player "${player.id}" already added`);
    }
    this._players.push(player);
  }

  // ── Lifecycle ──

  /**
   * Starts the game with a shuffled deck and an initial pick order.
   * The deck should contain Domino instances in shuffled order; this class
   * deals 4 at a time without knowing how they were shuffled (separation of
   * concerns — shuffling logic lives in a separate utility).
   */
  start(deck: Domino[], initialPickOrder: Player[]): void {
    if (this._phase !== GamePhase.lobby) throw new Error("Game already started");
    if (deck.length === 0)               throw new Error("Deck cannot be empty");

    this._remainingDeck = [...deck];
    this._pickOrder     = [...initialPickOrder];
    this._phase         = GamePhase.playing;

    this.events.emit("game:started", { players: [...this._players] });
    this._dealNextRound();
  }

  /**
   * Advances from one round to the next. Call this after all placements for
   * the current round are confirmed (round.allPlayersPlaced() === true).
   */
  advanceRound(): void {
    const round = this._requireActiveRound();
    if (!round.allPlayersPlaced()) {
      throw new Error("Cannot advance round — not all players have placed");
    }

    const nextPickOrder = round.deal.nextRoundPickOrder();
    this._pickOrder     = nextPickOrder;

    this.events.emit("round:complete", {
      round,
      nextPickOrder,
      roundNumber: this._rounds.length,
    });

    this._dealNextRound();
  }

  // ── Player actions ──

  handlePick(playerId: string, slotIndex: number): void {
    const round  = this._requireActiveRound();
    const player = this._requirePlayer(playerId);
    const domino = round.deal.snapshot()[slotIndex].domino;

    round.recordPick(player, slotIndex);

    this.events.emit("pick:made", {
      player,
      domino,
      slotIndex,
      roundNumber: this._rounds.length,
    });

    if (round.phase === RoundPhase.placing) {
      // All picks done — prompt the first placer
      const firstPlacer = this._pickOrder[0];
      const theirDomino = round.deal.pickedDominoFor(firstPlacer)!;
      this.events.emit("place:expected", {
        player: firstPlacer,
        domino: theirDomino,
        roundNumber: this._rounds.length,
      });
    } else {
      const nextPicker = round.currentPicker!;
      this.events.emit("pick:expected", {
        player: nextPicker,
        roundNumber: this._rounds.length,
      });
    }
  }

  handlePlacement(playerId: string, x: number, y: number, direction: Direction): void {
    const round  = this._requireActiveRound();
    const player = this._requirePlayer(playerId);
    const domino = round.deal.pickedDominoFor(player);

    if (!domino) {
      throw new Error(`${playerId} has not picked a domino this round`);
    }

    const placement = new Placement(domino, x, y, direction);
    round.recordPlacement(player, placement);

    this.events.emit("place:made", { player, placement, roundNumber: this._rounds.length });

    if (round.allPlayersPlaced()) {
      // Round complete — advanceRound() should be called by the flow controller
    } else {
      // Prompt next placer (pick order = placement order in Kingdomino)
      const nextPlacer = this._pickOrder.find(
        p => round.deal.pickedDominoFor(p) && !round.phase /* still placing */
      );
      if (nextPlacer) {
        const theirDomino = round.deal.pickedDominoFor(nextPlacer)!;
        this.events.emit("place:expected", {
          player: nextPlacer,
          domino: theirDomino,
          roundNumber: this._rounds.length,
        });
      }
    }
  }

  // ── Accessors ──

  get players(): ReadonlyArray<Player> { return this._players; }
  get phase(): GamePhase               { return this._phase; }
  get roundNumber(): number            { return this._rounds.length; }

  get currentRound(): Round | null {
    const last = this._rounds[this._rounds.length - 1];
    return last?.phase !== RoundPhase.complete ? (last ?? null) : null;
  }

  // ── Private helpers ──

  private _dealNextRound(): void {
    if (this._remainingDeck.length < 4) {
      this._endGame();
      return;
    }

    const [a, b, c, d] = this._remainingDeck.splice(0, 4) as [Domino, Domino, Domino, Domino];
    const deal  = new Deal([a, b, c, d]);
    const round = new Round(deal, this._pickOrder);
    this._rounds.push(round);

    this.events.emit("round:started", { round, roundNumber: this._rounds.length });

    round.beginPicking();
    this.events.emit("pick:expected", {
      player: round.currentPicker!,
      roundNumber: this._rounds.length,
    });
  }

  private _endGame(): void {
    this._phase = GamePhase.scoring;
    const scores = this._players
      .map(p => ({ player: p, score: p.score() }))
      .sort((a, b) => b.score - a.score);
    this._phase = GamePhase.finished;
    this.events.emit("game:ended", { scores });
  }

  private _requirePlayer(id: string): Player {
    const player = this._players.find(p => p.id === id);
    if (!player) throw new Error(`Unknown player: "${id}"`);
    return player;
  }

  private _requireActiveRound(): Round {
    const round = this.currentRound;
    if (!round) throw new Error("No active round");
    return round;
  }
}

// ─── DOMINO FACTORY HELPERS ──────────────────────────────────────────────────

/**
 * Converts the raw card data format from the existing cards.ts into Domino value objects.
 * This is the seam between the existing data layer and the OOP model.
 *
 * Usage:
 *   import { getCard, generateDeck } from "../gamelogic/cards";
 *   const deck = generateDeck().map(id => dominoFromCardId(id, getCard));
 */
export type CardInfoGetter = (id: number) => {
  tiles: [{ tile: number; value: number }, { tile: number; value: number }];
};

export function dominoFromCardId(id: number, getCard: CardInfoGetter): Domino {
  const { tiles: [a, b] } = getCard(id);
  return new Domino(
    id,
    new TileCell(a.tile as Terrain, a.value),
    new TileCell(b.tile as Terrain, b.value),
  );
}

// ─── USAGE EXAMPLE ──────────────────────────────────────────────────────────

/**
 * Example: a 2-player local game.
 *
 * This shows how a "game flow" module would drive the session object
 * instead of dispatching action payloads to a store.
 *
 *   import { getCard, generateDeck } from "../gamelogic/cards";
 *
 *   const rawIds = generateDeck();            // [0..47]
 *   // shuffling would happen here (seededShuffle from utils.ts)
 *
 *   const deck: Domino[] = rawIds.map(id => dominoFromCardId(id, getCard));
 *
 *   const alice = new Player("alice", true);
 *   const bob   = new Player("bob",  false);
 *
 *   const game = new GameSession();
 *   game.addPlayer(alice);
 *   game.addPlayer(bob);
 *
 *   // Subscribe to events for UI updates
 *   game.events.on("pick:expected", ({ player }) => {
 *     console.log(`Waiting for ${player.id} to pick`);
 *   });
 *   game.events.on("game:ended", ({ scores }) => {
 *     scores.forEach(({ player, score }) =>
 *       console.log(`${player.id}: ${score} points`)
 *     );
 *   });
 *
 *   game.start(deck, [alice, bob]);   // emits "game:started", "round:started", "pick:expected"
 *
 *   game.handlePick("alice", 0);      // Alice picks slot 0 (lowest id domino)
 *   game.handlePick("bob",   2);      // Bob picks slot 2
 *
 *   // Alice places her domino
 *   game.handlePlacement("alice", 7, 6, Direction.right);
 *   // Bob places his domino
 *   game.handlePlacement("bob",   5, 6, Direction.left);
 *
 *   game.advanceRound();              // next round dealt; pick order derived from chosen domino ids
 */
