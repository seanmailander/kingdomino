/**
 * MCP Server for Kingdomino game harness.
 *
 * Imports the game engine directly and manages game state.
 * Exposes structured tools for game orchestration and testing.
 *
 * All game state lives in module scope — single source of truth.
 * All responses are structured JSON (never prose errors).
 * Randomness is always seeded and deterministic.
 */

import { MCPServer } from './mcp.ts'
import { createRng } from './seed.ts'
import { resolveBehavior, type BehaviorSpec, type ClientBehavior } from './behaviors/index.ts'
import {
  GameSession,
  Player,
  GAME_PHASE_PLAYING,
  GAME_PHASE_FINISHED,
  STANDARD,
  up,
  down,
  left,
  right,
  generateDeck,
  getNextFourCards,
  chooseOrderFromSeed,
  getEligiblePositions,
  getValidDirections,
  staysWithin5x5,
  ROUND_COMPLETE,
} from 'kingdomino-engine'
import type { GameVariant, GameBonuses, Direction, CardId } from 'kingdomino-engine'

// ── Module-scope state ──────────────────────────────────────────────────────

/**
 * Single game session. Null until new_game is called.
 */
let gameSession: GameSession | null = null

/**
 * Seeded RNG. Created when new_game is called with a seed.
 */
let rng: (() => number) | null = null

/**
 * Remaining deck of card IDs not yet dealt.
 */
let remainingDeck: number[] = []

/**
 * Registry of player behaviors, keyed by player ID.
 */
const behaviorRegistry = new Map<string, ClientBehavior>()

/**
 * Store snapshots of serialized game state (not the session object).
 * This ensures snapshots are plain data that survive serialization.
 */
const stateSnapshots = new Map<string, Record<string, unknown>>()
let nextSnapshotIndex = 0

/**
 * Generate a hex seed string from the module-level seeded RNG.
 */
function nextHexSeed(): string {
  const r = rng ?? Math.random
  return Array.from({ length: 8 }, () =>
    Math.floor(r() * 256).toString(16).padStart(2, '0')
  ).join('')
}

/**
 * Deal the next four cards and begin a new round.
 * If the deck is exhausted, ends the game instead.
 */
function advanceRound(): void {
  if (!gameSession) return
  if (remainingDeck.length === 0) {
    gameSession.endGame()
    return
  }
  const seed = nextHexSeed()
  const { next: cardIds, remaining } = getNextFourCards(seed, remainingDeck)
  remainingDeck = remaining
  gameSession.beginRound(cardIds as [CardId, CardId, CardId, CardId])
}

// ── MCP Server setup ────────────────────────────────────────────────────────

const server = new MCPServer({
  name: 'kingdomino-game-harness',
  version: '0.1.0',
})

// ── Helper: Serialize game state ────────────────────────────────────────────

/**
 * Convert GameSession to a JSON-serializable state object.
 * This is what the agent sees as "the game state".
 */
function serializeGameState(session: GameSession): Record<string, unknown> {
  const players = session.players.map((p) => ({
    id: p.id,
    board: p.board.snapshot(),
    score: p.score(),
  }))

  return {
    phase: session.phase,
    players,
    currentRound: session.currentRound
      ? {
          phase: session.currentRound.phase,
          deal: {
            slots: session.currentRound.deal.snapshot().map((s) => ({
              cardId: s.cardId,
              pickedBy: (s.pickedBy as any)?.id ?? null,
            })),
          },
          currentActor: session.currentRound.currentActor?.id ?? null,
        }
      : null,
    variant: session.variant,
  }
}

// ── Helper: Get legal actions ───────────────────────────────────────────────

const DIRECTION_MAP: Record<string, Direction> = { up, down, left, right }
const DIRECTION_ENTRIES: Array<[string, Direction]> = Object.entries(DIRECTION_MAP) as Array<[string, Direction]>

/**
 * Determine what actions a player can legally take.
 * Returns action objects with name and optional params.
 */
function getLegalActionsForPlayer(
  session: GameSession,
  playerId: string,
): Record<string, unknown>[] {
  const player = session.players.find((p) => p.id === playerId)
  if (!player) return []

  const round = session.currentRound
  if (!round) return []

  const actor = round.currentActor
  if (!actor || actor.id !== playerId) return []

  // In picking phase: return all unpicked card slots
  if (round.phase === 'picking') {
    return round.deal.snapshot()
      .filter((slot) => slot.pickedBy === null)
      .map((slot) => ({ action: 'pick', params: { cardId: slot.cardId } }))
  }

  // In placing phase: enumerate valid placements, or discard if none
  if (round.phase === 'placing') {
    const cardId = round.deal.pickedCardFor(player)
    if (cardId === null) return []

    const board = player.board.snapshot()
    const eligible = getEligiblePositions(board, cardId)
    const placements: Record<string, unknown>[] = []

    for (const { x, y } of eligible) {
      const validDirs = getValidDirections(board, cardId, x, y) as Direction[]
      for (const dir of validDirs) {
        const dirName = DIRECTION_ENTRIES.find(([, d]) => d === dir)?.[0]
        if (dirName && staysWithin5x5(board, x, y, dir)) {
          placements.push({ action: 'place', params: { x, y, direction: dirName } })
        }
      }
    }

    // If no valid placements exist, player must discard
    return placements.length > 0 ? placements : [{ action: 'discard', params: {} }]
  }

  return []
}

// ── Tool: new_game ─────────────────────────────────────────────────────────

/**
 * Initialize a new game with seeded random and player behaviors.
 *
 * @param seed - Seed for deterministic randomness
 * @param players - Array of player configs: { id, behavior, script? }
 */
server.tool(
  'new_game',
  {
    name: 'new_game',
    description: 'Initialize a new game with seeded randomness and player behaviors',
    inputSchema: {
      type: 'object',
      properties: {
        seed: {
          type: 'number',
          description: 'Seed for deterministic randomness',
        },
        players: {
          type: 'array',
          description: 'Array of player configurations',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Player ID' },
              behavior: {
                type: 'string',
                enum: ['scripted', 'random', 'passive', 'aggressive', 'cheater'],
              },
              script: {
                type: 'array',
                items: { type: 'string' },
                description: 'Script for scripted behavior',
              },
            },
            required: ['id', 'behavior'],
          },
        },
      },
      required: ['seed', 'players'],
    },
  },
  async (input) => {
    const { seed, players: playerConfigs } = input as {
      seed: number
      players: Array<{ id: string; behavior: string; script?: string[] }>
    }

    // Clear old state
    behaviorRegistry.clear()
    stateSnapshots.clear()
    nextSnapshotIndex = 0

    // Create seeded RNG
    rng = createRng(seed)

    // Initialize deck
    remainingDeck = [...generateDeck()]

    // Create session (no seedProvider — we drive rounds manually)
    gameSession = new GameSession({
      variant: STANDARD as GameVariant,
      bonuses: {} as GameBonuses,
    })

    // Add players and register behaviors
    for (const playerConfig of playerConfigs) {
      const player = new Player(playerConfig.id)
      gameSession.addPlayer(player)

      // Resolve and register behavior
      const behaviorSpec: BehaviorSpec =
        playerConfig.behavior === 'scripted'
          ? { behavior: 'scripted', script: playerConfig.script || [] }
          : { behavior: playerConfig.behavior as any }

      const behavior = resolveBehavior(behaviorSpec)
      behaviorRegistry.set(playerConfig.id, behavior)
    }

    // Start the game (sets phase = playing; no seed provider so loop exits immediately)
    gameSession.startGame()

    // Determine initial pick order using seeded RNG
    const orderSeed = nextHexSeed()
    const orderedIds = chooseOrderFromSeed(orderSeed, gameSession.players.map((p) => p.id))
    gameSession.setPickOrder(orderedIds.map((id) => gameSession!.players.find((p) => p.id === id)!))

    // Subscribe to ROUND_COMPLETE to auto-advance rounds
    gameSession.events.on(ROUND_COMPLETE, () => { advanceRound() })

    // Begin first round
    advanceRound()

    const state = serializeGameState(gameSession)

    return {
      ok: true,
      state,
    }
  },
)

// ── Tool: get_game_state ────────────────────────────────────────────────────

server.tool(
  'get_game_state',
  {
    name: 'get_game_state',
    description: 'Get the current full game state',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  async () => {
    if (!gameSession) {
      return {
        ok: false,
        error: 'No game session',
      }
    }

    const state = serializeGameState(gameSession)

    return {
      state,
    }
  },
)

// ── Tool: get_player_state ──────────────────────────────────────────────────

server.tool(
  'get_player_state',
  {
    name: 'get_player_state',
    description: 'Get private state for a specific player',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'Player ID',
        },
      },
      required: ['player_id'],
    },
  },
  async (input) => {
    const { player_id: playerId } = input as { player_id: string }

    if (!gameSession) {
      return {
        ok: false,
        error: 'No game session',
      }
    }

    const player = gameSession.players.find((p) => p.id === playerId)
    if (!player) {
      return {
        ok: false,
        error: 'Player not found',
      }
    }

    return {
      player: {
        id: player.id,
        board: player.board.snapshot(),
        score: player.score(),
      },
    }
  },
)

// ── Tool: get_legal_actions ─────────────────────────────────────────────────

server.tool(
  'get_legal_actions',
  {
    name: 'get_legal_actions',
    description: 'Get legal actions for a player',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'Player ID',
        },
      },
      required: ['player_id'],
    },
  },
  async (input) => {
    const { player_id: playerId } = input as { player_id: string }

    if (!gameSession) {
      return {
        ok: false,
        error: 'No game session',
      }
    }

    const actions = getLegalActionsForPlayer(gameSession, playerId)

    return {
      actions,
    }
  },
)

// ── Tool: take_action ───────────────────────────────────────────────────────

/**
 * Apply an action and return the new state.
 * On invalid action, return structured error.
 */
server.tool(
  'take_action',
  {
    name: 'take_action',
    description: 'Apply an action to the game state',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'Player ID',
        },
        action: {
          type: 'string',
          description: 'Action name',
        },
        params: {
          type: 'object',
          description: 'Action parameters',
        },
      },
      required: ['player_id', 'action'],
    },
  },
  async (input) => {
    const { player_id: playerId, action, params } = input as {
      player_id: string
      action: string
      params?: Record<string, unknown>
    }

    if (!gameSession) {
      return {
        ok: false,
        error: 'No game session',
      }
    }

    // Check legality first
    const legalActions = getLegalActionsForPlayer(gameSession, playerId)
    const isLegal = legalActions.some((a) => a.action === action)

    if (!isLegal) {
      return {
        ok: false,
        error: `Illegal action: ${action}`,
        reason: 'action_not_legal',
        legal_actions: legalActions,
      }
    }

    // Apply action
    try {
      if (action === 'pick' && params?.cardId !== undefined) {
        gameSession.handlePick(playerId, params.cardId as number)
      } else if (action === 'place' && params?.x !== undefined && params?.y !== undefined && params?.direction) {
        const direction = DIRECTION_MAP[params.direction as string]
        if (!direction) {
          return {
            ok: false,
            error: `Invalid direction: ${params.direction}`,
            reason: 'invalid_params',
            legal_actions: legalActions,
          }
        }
        gameSession.handlePlacement(playerId, params.x as number, params.y as number, direction)
      } else if (action === 'discard') {
        gameSession.handleDiscard(playerId)
      } else {
        return {
          ok: false,
          error: `Unknown action: ${action}`,
          reason: 'unknown_action',
          legal_actions: legalActions,
        }
      }

      const state = serializeGameState(gameSession)
      return {
        ok: true,
        state,
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        reason: 'action_failed',
        legal_actions: legalActions,
      }
    }
  },
)

// ── Tool: snapshot ──────────────────────────────────────────────────────────

server.tool(
  'snapshot',
  {
    name: 'snapshot',
    description: 'Save a snapshot of the current game state',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  async () => {
    try {
      if (!gameSession) {
        return {
          ok: false,
          error: 'No game session',
        }
      }
      const state = serializeGameState(gameSession)
      const id = String(nextSnapshotIndex++)
      stateSnapshots.set(id, structuredClone(state))

      return {
        snapshot_id: id,
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
)

// ── Tool: restore ───────────────────────────────────────────────────────────

server.tool(
  'restore',
  {
    name: 'restore',
    description: 'Restore a previously snapshotted game state',
    inputSchema: {
      type: 'object',
      properties: {
        snapshot_id: {
          type: 'string',
          description: 'Snapshot ID',
        },
      },
      required: ['snapshot_id'],
    },
  },
  async (input) => {
    const { snapshot_id: snapshotId } = input as { snapshot_id: string }

    try {
      const state = stateSnapshots.get(snapshotId)
      if (!state) {
        return {
          ok: false,
          error: `Snapshot not found: ${snapshotId}`,
        }
      }
      return {
        ok: true,
        state: structuredClone(state),
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
)

// ── Helper: Evaluate dot-path condition ────────────────────────────────────

/**
 * Evaluate a dot-path expression against the serialized game state.
 * Examples: "is_game_over == true", "phase == 'playing'"
 *
 * For now, this is a simple implementation that checks existence and basic equality.
 * In a full version, this would be a proper expression parser.
 */
function evaluateCondition(state: Record<string, unknown>, condition: string): boolean {
  // Very simple conditions for now
  // Format: "path.to.value == expectedValue"
  const parts = condition.split('==')
  if (parts.length !== 2) {
    return false
  }

  const [pathPart, valuePart] = parts.map((p) => p.trim())
  const path = pathPart.split('.')

  let value: unknown = state
  for (const key of path) {
    if (typeof value === 'object' && value !== null) {
      value = (value as Record<string, unknown>)[key]
    } else {
      return false
    }
  }

  const expectedStr = valuePart.replace(/^['"]|['"]$/g, '')
  return String(value) === expectedStr
}

// ── Tool: auto_turn ────────────────────────────────────────────────────────

/**
 * Automatically choose and apply an action for a player using their behavior.
 */
server.tool(
  'auto_turn',
  {
    name: 'auto_turn',
    description: 'Automatically choose and apply an action for a player',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'Player ID',
        },
      },
      required: ['player_id'],
    },
  },
  async (input) => {
    const { player_id: playerId } = input as { player_id: string }

    if (!gameSession || !rng) {
      return {
        ok: false,
        error: 'No game session',
      }
    }

    const behavior = behaviorRegistry.get(playerId)
    if (!behavior) {
      return {
        ok: false,
        error: `No behavior registered for player: ${playerId}`,
      }
    }

    try {
      // Get current state for behavior, enriched with getLegalActions method
      const state = {
        ...serializeGameState(gameSession),
        getLegalActions: (pId: string) => getLegalActionsForPlayer(gameSession!, pId),
      }

      // Ask behavior to choose an action
      const action = behavior.chooseAction(state, playerId, rng)

      // Convert action to take_action format
      const actionObj = action as any
      const actionName = actionObj.action || String(action)
      const params = actionObj.params || {}

      // Apply the action
      const legalActions = getLegalActionsForPlayer(gameSession, playerId)
      const isLegal = legalActions.some((a) => a.action === actionName)

      if (!isLegal) {
        return {
          ok: false,
          error: `Behavior chose illegal action: ${actionName}`,
        }
      }

      if (actionName === 'pick' && params.cardId !== undefined) {
      } else if (actionName === 'place' && params.x !== undefined && params.y !== undefined && params.direction) {
        const direction = DIRECTION_MAP[params.direction]
        if (!direction) {
          return {
            ok: false,
            error: `Invalid direction: ${params.direction}`,
          }
        }
        gameSession.handlePlacement(playerId, params.x, params.y, direction)
      } else if (actionName === 'discard') {
        gameSession.handleDiscard(playerId)
      }

      const newState = serializeGameState(gameSession)
      return {
        ok: true,
        action: actionName,
        state: newState,
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
)

// ── Tool: auto_play_until ──────────────────────────────────────────────────

/**
 * Automatically play turns until a condition is met or max turns reached.
 */
server.tool(
  'auto_play_until',
  {
    name: 'auto_play_until',
    description: 'Automatically play turns until a condition is met',
    inputSchema: {
      type: 'object',
      properties: {
        condition: {
          type: 'string',
          description: 'Condition expression (e.g., "phase == playing")',
        },
        max_turns: {
          type: 'number',
          description: 'Maximum turns to play (default: 200)',
        },
      },
      required: ['condition'],
    },
  },
  async (input) => {
    const { condition, max_turns = 200 } = input as {
      condition: string
      max_turns?: number
    }

    const MAX_ERRORS = 20

    if (!gameSession) {
      return {
        ok: false,
        error: 'No game session',
      }
    }

    let turnsPlayed = 0
    let conditionMet = false
    const errors: string[] = []
    let errorsSuppressed = 0

    while (turnsPlayed < max_turns) {
      const state = serializeGameState(gameSession)

      // Check condition
      if (evaluateCondition(state, condition)) {
        conditionMet = true
        break
      }

      // Play a turn for each player
      for (const player of gameSession.players) {
        const behavior = behaviorRegistry.get(player.id)
        if (!behavior) {
          continue
        }

        try {
          const currentState = {
            ...serializeGameState(gameSession),
            getLegalActions: (pId: string) => getLegalActionsForPlayer(gameSession!, pId),
          }
          const action = behavior.chooseAction(currentState, player.id, rng || (() => Math.random()))
          const actionObj = action as any
          const actionName = actionObj.action || String(action)
          const params = actionObj.params || {}

          const legalActions = getLegalActionsForPlayer(gameSession, player.id)
          const isLegal = legalActions.some((a) => a.action === actionName)

          if (!isLegal) {
            if (errors.length < MAX_ERRORS) errors.push(`[turn ${turnsPlayed}] ${player.id}: behavior chose illegal action "${actionName}" (legal: ${legalActions.map((a) => (a as any).action).join(', ') || 'none'})`)
            else errorsSuppressed++
            continue
          }

          if (actionName === 'pick' && params.cardId !== undefined) {
            gameSession.handlePick(player.id, params.cardId)
          } else if (actionName === 'place' && params.x !== undefined && params.y !== undefined && params.direction) {
            const direction = DIRECTION_MAP[params.direction]
            if (direction) {
              gameSession.handlePlacement(player.id, params.x, params.y, direction)
            }
          } else if (actionName === 'discard') {
            gameSession.handleDiscard(player.id)
          }
        } catch (error) {
          if (errors.length < MAX_ERRORS) errors.push(`[turn ${turnsPlayed}] ${player.id}: ${error instanceof Error ? error.message : String(error)}`)
          else errorsSuppressed++
          continue
        }
      }

      turnsPlayed++
    }

    const finalState = serializeGameState(gameSession)

    return {
      ok: true,
      turns_played: turnsPlayed,
      state: finalState,
      condition_met: conditionMet,
      errors: errors.length > 0 ? errors : undefined,
      errors_suppressed: errorsSuppressed > 0 ? errorsSuppressed : undefined,
    }
  },
)

// ── Tool: wait_for_state ───────────────────────────────────────────────────

/**
 * Validate that current state matches conditions (synchronous, no blocking).
 */
server.tool(
  'wait_for_state',
  {
    name: 'wait_for_state',
    description: 'Validate that current state matches conditions',
    inputSchema: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          description: 'Expected game phase',
        },
        player_id: {
          type: 'string',
          description: 'Expected current player ID',
        },
        timeout_turns: {
          type: 'number',
          description: 'Timeout in turns (for validation)',
        },
      },
    },
  },
  async (input) => {
    const { phase, player_id: expectedPlayerId } = input as {
      phase?: string
      player_id?: string
      timeout_turns?: number
    }

    if (!gameSession) {
      return {
        ok: false,
        error: 'No game session',
      }
    }

    const state = serializeGameState(gameSession)

    // Check phase
    if (phase && state.phase !== phase) {
      return {
        ok: false,
        error: `timeout`,
        state,
      }
    }

    return {
      ok: true,
      state,
    }
  },
)

// ── Start server ────────────────────────────────────────────────────────────

server.listen()
