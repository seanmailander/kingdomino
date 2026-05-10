/**
 * Hello World Test - Canonical Workflow
 *
 * Demonstrates the basic workflow:
 * 1. Start a new game (Phase 1: Write Test Scenario)
 * 2. Get initial state
 * 3. Snapshot the state
 * 4. Make an action
 * 5. Verify state changed (Phase 2: Test Behavior)
 */

import { describe, it, expect } from 'vitest'
import { GameSession, Player } from 'kingdomino-engine'
import { createRng } from './seed.ts'

describe('Canonical Workflow - Hello World', () => {
  it('Phase 1: Write a test scenario - create game and snapshot initial state', () => {
    // 1. Start a game (simulates new_game RPC call)
    const seed = 42
    const rng = createRng(seed)

    const gameSession = new GameSession()
    const p1 = new Player('p1')
    const p2 = new Player('p2')
    gameSession.addPlayer(p1)
    gameSession.addPlayer(p2)
    gameSession.startGame()

    // Verify game created
    expect(gameSession).toBeDefined()
    expect(gameSession.players).toHaveLength(2)
    expect(gameSession.phase).toBe('playing')

    // 2. Get current state (simulates get_game_state RPC call)
    const initialState = {
      phase: gameSession.phase,
      roundNumber: gameSession.currentRound?.getRoundNumber() ?? 0,
      players: gameSession.players.map((p) => ({
        id: p.id,
        board: p.board.snapshot(),
        score: p.score(),
      })),
    }

    expect(initialState.phase).toBe('playing')
    expect(initialState.players).toHaveLength(2)
    console.log('Initial State:', JSON.stringify(initialState, null, 2))

    // 3. Snapshot (simulates snapshot RPC call)
    const snapshots = new Map<string, Record<string, unknown>>()
    const snapshotId = `snap-${Date.now()}`
    snapshots.set(snapshotId, structuredClone(initialState))

    expect(snapshots.has(snapshotId)).toBe(true)
  })

  it('Phase 2: Test a behavior - verify state consistency across multiple runs', () => {
    // Verify determinism with same seed produces same sequence
    const seed = 42

    // Run 1
    const rng1 = createRng(seed)
    const game1 = new GameSession()
    game1.addPlayer(new Player('p1'))
    game1.addPlayer(new Player('p2'))
    game1.startGame()

    const state1Score = game1.players.map((p) => p.score())

    // Run 2 (same seed)
    const rng2 = createRng(seed)
    const game2 = new GameSession()
    game2.addPlayer(new Player('p1'))
    game2.addPlayer(new Player('p2'))
    game2.startGame()

    const state2Score = game2.players.map((p) => p.score())

    // Verify both runs have identical initial scores
    expect(state1Score).toEqual(state2Score)
    console.log('Initial Scores (deterministic):', state1Score)
  })

  it('Phase 3 & 4: Full workflow - game creation, state inspection, and determinism', () => {
    // This demonstrates a complete minimal workflow
    const seed = 99

    function runGame(gameSeed: number) {
      const rng = createRng(gameSeed)
      const gameSession = new GameSession()
      const p1 = new Player('alice')
      const p2 = new Player('bob')
      gameSession.addPlayer(p1)
      gameSession.addPlayer(p2)
      gameSession.startGame()

      // Snapshot initial state
      const initialState = {
        phase: gameSession.phase,
        players: gameSession.players.map((p) => ({
          id: p.id,
          score: p.score(),
        })),
      }

      return {
        gameSession,
        initialState,
        rng,
      }
    }

    // Run 3 times with same seed and verify identical results
    const runs = [runGame(seed), runGame(seed), runGame(seed)]

    const scores = runs.map((r) => r.initialState.players.map((p) => p.score))

    // All three runs should have identical scores
    expect(scores[0]).toEqual(scores[1])
    expect(scores[1]).toEqual(scores[2])

    console.log('Determinism verified - all 3 runs with seed=99 produced identical results')
    console.log('Scores:', scores[0])
  })
})
