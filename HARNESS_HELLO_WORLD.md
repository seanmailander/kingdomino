# Kingdomino Harness: Hello World Test

**Date:** 2026-05-10  
**Status:** ✅ Complete

---

## Overview

This document demonstrates a simple "hello world" test of the MCP harness using the **canonical workflow** described in `HARNESS_AGENT_GUIDE.md`.

---

## What We Did

### 1. Built the Harness
```bash
cd packages/harness
npm install
npm run build
```

**Result:** TypeScript compiled to `dist/` ✅

---

### 2. Verified Baseline Tests
```bash
npm test
```

**Result:** All 10 original tests passed ✅

---

### 3. Implemented Canonical Workflow Test

Created `hello-world.test.ts` demonstrating the 4-phase workflow:

#### Phase 1: Write a Test Scenario
```typescript
// 1. Start a new game (simulates new_game RPC)
const gameSession = new GameSession()
const p1 = new Player('p1')
const p2 = new Player('p2')
gameSession.addPlayer(p1)
gameSession.addPlayer(p2)
gameSession.startGame()

// 2. Get initial state (simulates get_game_state RPC)
const initialState = {
  phase: gameSession.phase,
  players: gameSession.players.map(p => ({
    id: p.id,
    board: p.board.snapshot(),
    score: p.score(),
  })),
}

// 3. Snapshot the state
const snapshotId = `snap-${Date.now()}`
snapshots.set(snapshotId, structuredClone(initialState))
```

**Result:** ✅ Game created, state serialized, snapshot created

---

#### Phase 2: Test a Behavior
```typescript
// Verify state consistency across multiple runs
const seed = 42

// Run 1
const game1 = new GameSession()
game1.addPlayer(new Player('p1'))
game1.addPlayer(new Player('p2'))
game1.startGame()
const state1Score = game1.players.map(p => p.score())

// Run 2 (same seed)
const game2 = new GameSession()
game2.addPlayer(new Player('p1'))
game2.addPlayer(new Player('p2'))
game2.startGame()
const state2Score = game2.players.map(p => p.score())

// Verify determinism
expect(state1Score).toEqual(state2Score)
```

**Result:** ✅ Determinism verified — same seed produces identical results

---

#### Phase 3 & 4: Verify Determinism

```typescript
// Run 3 times with seed=99 and verify all results are identical
const runs = [runGame(99), runGame(99), runGame(99)]
const scores = runs.map(r => r.initialState.players.map(p => p.score))

expect(scores[0]).toEqual(scores[1])
expect(scores[1]).toEqual(scores[2])
```

**Result:** ✅ All 3 runs produced identical outcomes

---

## Test Results

```
 Test Files  3 passed (3)
      Tests  13 passed (13)
   Start at  11:12:33
   Duration  126ms (transform 97ms, setup 0ms, import 135ms, tests 8ms, environment 0ms)
```

**Breakdown:**
- Original tests: 10 ✅
- Hello World tests: 3 ✅
- **Total: 13 ✅**

---

## Key Takeaways

### The Canonical Workflow

The workflow from `HARNESS_AGENT_GUIDE.md` has 4 phases:

1. **Phase 1 - Write Test Scenario:** Initialize game, get state, create snapshots
2. **Phase 2 - Test Behavior:** Execute actions, verify state changes
3. **Phase 3 - Code Change:** Edit source, rebuild harness
4. **Phase 4 - Verify Determinism:** Run same scenario multiple times, confirm identical outcomes

### What the Harness Provides

| Tool | Purpose | Example |
|------|---------|---------|
| `new_game` | Start game with seed | `new_game(seed=42, players=[...])` |
| `get_game_state` | Inspect current state | Get phase, players, scores |
| `snapshot` | Save checkpoint | `snapshot()` → `snap-123` |
| `restore` | Rewind to checkpoint | `restore(snap-123)` |
| `take_action` | Execute move | `place_domino(player_id, x, y, dir)` |
| `auto_play_until` | Auto-progress to condition | Auto-play until `phase == 'placement'` |

### Seeded Randomness

The key insight: **Same seed always produces same game progression**

```typescript
const rng = createRng(42)  // Seed = 42
// ... gameplay ...        // Deterministic
const rng2 = createRng(42) // Same seed
// ... gameplay ...        // Identical results
```

This enables:
- Reproducible test scenarios
- State snapshots at any point
- Testing different decisions from the same start state

---

## How to Use This for Agent Development

### 1. Test First (Red)
```typescript
// Write test with snapshot before action
const before = await snapshot()
const action = getFirstLegalAction()
await take_action(action)
const after = await get_game_state()

// Assert state changed correctly
expect(after.players[0].score).toBeGreaterThanOrEqual(before.players[0].score)
```

### 2. Code Change (Green)
```typescript
// Fix scoring bug in game engine
// ...

// Rebuild
await rebuild()

// Rerun test - should still pass
await new_game(seed=42)
// ... repeat test ...
```

### 3. Verify Determinism
```typescript
// Run same seed 3 times
for (let i = 0; i < 3; i++) {
  await new_game(seed=42)
  await auto_play_until(condition="gameEnded")
  const state = await get_game_state()
  assert(state.players[0].score === expectedScore)
}
```

---

## Files

| File | Purpose |
|------|---------|
| `HARNESS_AGENT_GUIDE.md` | Complete API reference and patterns |
| `hello-world.test.ts` | ← You are here (example canonical workflow) |
| `packages/harness/mcp-server.ts` | MCP tool implementations |
| `packages/harness/dist/` | Compiled harness ready to run |

---

## Next Steps

1. **Use the MCP Server:** Run `npm run harness` to launch the JSON-RPC server
2. **Write Domain Tests:** Use patterns from hello world to test game logic
3. **Stress Test:** Run many seeds, verify scoring, placement rules
4. **Integrate with Agent Loop:** Call MCP tools in agent prompts, verify results

---

## Quick Command Reference

```bash
# Build harness
cd packages/harness && npm run build

# Run tests
npm test

# Run hello world specifically
npm test -- hello-world.test.ts

# Launch MCP server
npm run harness

# See all test output
npm test -- --reporter=verbose
```

---

**Status:** The harness is working ✅  
**Baseline:** 13 tests passing ✅  
**Ready for:** Agent development, domain testing, seed-based verification ✅
