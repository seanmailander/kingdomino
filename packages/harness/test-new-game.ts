import { MCPServer } from './mcp.ts'
import { createRng } from './seed.ts'
import {
  GameSession,
  Player,
  STANDARD,
} from 'kingdomino-engine'
import type { GameVariant, GameBonuses } from 'kingdomino-engine'

let gameSession: GameSession | null = null
let rng: (() => number) | null = null

function serializeGameState(session: GameSession): Record<string, unknown> {
  const players = session.players.map((p) => ({
    id: p.id,
    board: p.board.snapshot(),
    score: p.score(),
  }))

  return {
    phase: session.phase,
    players,
    currentRound: null,
    variant: session.variant,
  }
}

const server = new MCPServer({
  name: 'test',
  version: '0.1.0',
})

server.tool(
  'new_game',
  {
    name: 'new_game',
    description: 'Initialize a new game',
    inputSchema: {
      type: 'object',
      properties: {
        seed: { type: 'number' },
        players: {
          type: 'array',
          items: { type: 'object' },
        },
      },
      required: ['seed', 'players'],
    },
  },
  async (input) => {
    const { seed, players: playerConfigs } = input as {
      seed: number
      players: Array<{ id: string; behavior: string }>
    }

    console.error('[test] new_game called with seed:', seed)
    console.error('[test] players:', playerConfigs)

    rng = createRng(seed)
    gameSession = new GameSession({
      variant: STANDARD as GameVariant,
      bonuses: {} as GameBonuses,
    })

    for (const playerConfig of playerConfigs) {
      const player = new Player(playerConfig.id)
      gameSession.addPlayer(player)
    }

    gameSession.startGame()

    const state = serializeGameState(gameSession)

    return {
      ok: true,
      state,
    }
  },
)

// Test
const handler = (await import('./mcp.ts')).MCPServer

console.log('[test] Testing new_game tool...')

// Simulate the RPC call
const newGameHandler = server['tools'].get('new_game')?.['handler']
if (newGameHandler) {
  const result = await newGameHandler({
    seed: 42,
    players: [
      { id: 'p1', behavior: 'random' },
      { id: 'p2', behavior: 'passive' },
    ],
  })
  console.log('[test] Result:', JSON.stringify(result, null, 2))
} else {
  console.error('[test] new_game tool not found!')
}
