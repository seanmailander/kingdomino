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

import { MCPServer } from './mcp'
import { createRng } from './seed'
import { resolveBehavior, type BehaviorSpec, type ClientBehavior } from './behaviors'
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
} from 'kingdomino-engine'
import type { GameVariant, GameBonuses, Direction } from 'kingdomino-engine'

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
 * Registry of player behaviors, keyed by player ID.
 */
const behaviorRegistry = new Map<string, ClientBehavior>()

/**
 * Store snapshots of serialized game state (not the session object).
 * This ensures snapshots are plain data that survive serialization.
 */
const stateSnapshots = new Map<string, Record<string, unknown>>()
let nextSnapshotIndex = 0

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
          phase: (session.currentRound as any).phase,
          deal: (session.currentRound as any).deal
            ? {
                cards: (session.currentRound as any).deal.cards,
              }
            : null,
          pickOrder: (session.currentRound as any).pickOrder?.map((p: Player) => p.id) ?? [],
        }
      : null,
    variant: session.variant,
  }
}

// ── Helper: Get legal actions ───────────────────────────────────────────────

/**
 * Determine what actions a player can legally take.
 * Returns action objects with name and optional params.
 */
function getLegalActionsForPlayer(
  session: GameSession,
  playerId: string,
): Record<string, unknown>[] {
  const player = session.players.find((p) => p.id === playerId)
  if (!player) {
    return []
  }

  const actions: Record<string, unknown>[] = []

  const round = session.currentRound as any
  if (!round) {
    return []
  }

  // In picking phase, player can pick a card if it's their turn
  if (round.phase === 'picking') {
    const deal = round.deal
    if (deal && deal.cards) {
      const pickOrder = round.pickOrder
      const currentPlayer = pickOrder?.[0] // First in pick order is current
      if (currentPlayer && currentPlayer.id === playerId) {
        // All cards in the deal are legal picks
        for (const card of deal.cards) {
          actions.push({
            action: 'pick',
            params: { cardId: card },
          })
        }
      }
    }
  }

  // In placing phase, player can place their drafted card
  if (round.phase === 'placing') {
    const placingPlayer = (round as any).placingPlayer
    if (placingPlayer && placingPlayer.id === playerId) {
      // For now, return a generic "place" action
      // In a real implementation, this would validate board positions
      actions.push({
        action: 'place',
        params: { x: 0, y: 0, direction: 'N' },
      })
    }
  }

  return actions
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

    // Create session
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

    // Start the game
    gameSession.startGame()

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
      if (action === 'pick' && params?.cardId) {
        gameSession.handlePick(playerId, params.cardId as number)
      } else if (action === 'place' && params?.x !== undefined && params?.y !== undefined && params?.direction) {
        const directionStr = params.direction as string
        const directionMap: Record<string, Direction> = {
          up,
          down,
          left,
          right,
        }
        const direction = directionMap[directionStr]
        if (!direction) {
          return {
            ok: false,
            error: `Invalid direction: ${directionStr}`,
            reason: 'invalid_params',
            legal_actions: legalActions,
          }
        }
        gameSession.handlePlacement(playerId, params.x as number, params.y as number, direction)
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

// ── Start server ────────────────────────────────────────────────────────────

server.listen()
