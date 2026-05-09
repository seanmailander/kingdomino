# Kingdomino MCP Harness: Agent Usage Guide

**Last Updated:** 2026-05-10  
**Audience:** Autonomous agents using the MCP harness for autonomous game testing and development iteration

---

## Quick Start

### 1. Build the Harness

```bash
cd packages/harness
npm install
npm run build
```

Outputs compiled code to `dist/`.

### 2. Verify Tests Pass

```bash
npm test
```

Expected: 10 tests pass, 0 failures.

### 3. Launch the MCP Server Wrapper

```bash
npm run harness
```

The wrapper:
- Compiles TypeScript
- Spawns the MCP server child process
- Proxies JSON-RPC messages between you and the game engine
- Intercepts `rebuild` tool calls to recompile and relaunch without dropping your connection

**The harness is now ready to receive MCP tool calls.**

---

## Available Tools

All tools are called via MCP `tools/call` with structured JSON inputs. All responses are typed JSON.

### Game Initialization & State

#### `new_game`
Start a new deterministic game session.

```json
{
  "name": "new_game",
  "seed": 42,
  "players": [
    { "id": "p1", "behavior": "random" },
    { "id": "p2", "behavior": "passive" },
    { "id": "p3", "behavior": "aggressive" },
    { "id": "p4", "behavior": "scripted" }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "game": {
    "id": "game-123",
    "phase": "draft",
    "round": 1,
    "variant": "base"
  }
}
```

**Behavior Options:**
- `"random"` — Chooses legal moves randomly (uses seeded RNG)
- `"passive"` — Minimal-impact moves, conservative play
- `"aggressive"` — Maximizes scoring, greedy strategy
- `"scripted"` — Predetermined action sequences (for deterministic test cases)
- `"cheater"` — Attempts illegal moves (for error testing)

**Key Point:** The same `seed` always produces the same sequence of random events. Use this for reproducible test scenarios.

---

#### `get_game_state`
Retrieve the full current game state.

```json
{
  "name": "get_game_state"
}
```

**Response:**
```json
{
  "ok": true,
  "state": {
    "phase": "draft",
    "round": 1,
    "currentTurn": "p1",
    "players": [
      {
        "id": "p1",
        "score": 0,
        "board": {
          "width": 5,
          "height": 5,
          "tiles": [...]
        },
        "hand": [
          { "id": "d-1", "crowns": 1, "terrain": "wheat" }
        ],
        "standingKing": true
      }
    ],
    "deck": {
      "remaining": 48,
      "discard": 0
    }
  }
}
```

Use this to verify game state after actions or to inspect the board before making decisions.

---

#### `get_player_state`
Retrieve private state for a specific player.

```json
{
  "name": "get_player_state",
  "player_id": "p1"
}
```

**Response:**
```json
{
  "ok": true,
  "player": {
    "id": "p1",
    "score": 42,
    "hand": [...],
    "board": {...}
  }
}
```

---

#### `get_legal_actions`
Query available moves for a player in the current state.

```json
{
  "name": "get_legal_actions",
  "player_id": "p1"
}
```

**Response:**
```json
{
  "ok": true,
  "actions": [
    { "action": "pick_domino", "params": { "domino_id": "d-1" } },
    { "action": "pick_domino", "params": { "domino_id": "d-2" } },
    { "action": "skip" }
  ]
}
```

Useful for testing that move validation is correct.

---

### Player Actions

#### `take_action`
Apply a move on behalf of a player. Validates the action before applying it.

```json
{
  "name": "take_action",
  "player_id": "p1",
  "action": "place_domino",
  "params": {
    "domino_id": "d-42",
    "x": 2,
    "y": 2
  }
}
```

**Success Response:**
```json
{
  "ok": true,
  "result": {
    "action": "place_domino",
    "newPhase": "resolution"
  }
}
```

**Error Response (Illegal Move):**
```json
{
  "ok": false,
  "reason": "invalid_placement",
  "message": "Domino does not connect to existing tiles",
  "legalActions": [
    { "action": "place_domino", "params": {...} },
    { "action": "discard_domino", "params": {...} }
  ]
}
```

**Error Codes:**
- `"invalid_placement"` — Domino placement violates board rules
- `"illegal_action"` — Action not available in current phase
- `"invalid_player"` — Player ID doesn't exist
- `"invalid_domino"` — Domino ID not in player's hand

---

### Automation & Progression

#### `auto_turn`
Automatically choose and apply the next action for a player using their behavior.

```json
{
  "name": "auto_turn",
  "player_id": "p1"
}
```

**Response:**
```json
{
  "ok": true,
  "action": "place_domino",
  "params": { "domino_id": "d-5", "x": 1, "y": 3 },
  "newPhase": "draft"
}
```

Useful for letting a behavior drive a single turn.

---

#### `auto_play_until`
Auto-drive all players until a condition is met or max turns reached.

```json
{
  "name": "auto_play_until",
  "condition": "phase == 'end_game'",
  "maxTurns": 1000
}
```

**Condition Syntax:**
- `phase == 'draft'` — Current phase is draft
- `phase == 'placement'` — Current phase is placement
- `currentTurn == 'p2'` — It's player p2's turn
- `round == 3` — Game is on round 3
- `gameEnded == true` — Game is over

**Compound conditions:**
- `(phase == 'draft' && currentTurn == 'p1')` — AND
- `(round == 1 || round == 2)` — OR

**Response:**
```json
{
  "ok": true,
  "turnsExecuted": 47,
  "condition": "phase == 'placement' && currentTurn == 'p1'",
  "finalState": {
    "phase": "placement",
    "currentTurn": "p1",
    "round": 2
  }
}
```

**Example Use Cases:**
- Auto-play to the start of a specific player's turn
- Run an entire round automatically
- Play the game to completion and verify final scores

---

#### `wait_for_state`
Block until the game reaches an expected state (for test synchronization).

```json
{
  "name": "wait_for_state",
  "phase": "placement",
  "player_id": "p1",
  "timeout_ms": 10000
}
```

**Response:**
```json
{
  "ok": true,
  "waited_ms": 245,
  "state": {...}
}
```

Useful for assertions: wait for expected state, then verify.

---

### State Snapshots

#### `snapshot`
Create a checkpoint of the current game state (in-memory).

```json
{
  "name": "snapshot"
}
```

**Response:**
```json
{
  "ok": true,
  "snapshot_id": "snap-1234567890"
}
```

---

#### `restore`
Restore a previously saved snapshot.

```json
{
  "name": "restore",
  "snapshot_id": "snap-1234567890"
}
```

**Response:**
```json
{
  "ok": true,
  "restored": true
}
```

**Use Case:**
```
1. new_game(seed=42, players=[...])
2. auto_play_until(condition="phase == 'placement'")
3. snapshot() → snap-1
4. take_action(...) → p1 places domino
5. snapshot() → snap-2
6. take_action(...) → p1 places another domino
7. restore(snap-1) → Rewind to before p1's first placement
8. take_action(...) → p1 places different domino
9. Compare final state with snap-2
```

---

### Lifecycle

#### `rebuild`
Trigger a rebuild and relaunch of the MCP server **without dropping your connection**.

```json
{
  "name": "rebuild"
}
```

**Response:**
```json
{
  "ok": true,
  "rebuilt": true
}
```

**Workflow:**
1. Edit source code in `packages/harness/`
2. Call `rebuild`
3. The wrapper kills the child process, recompiles, and relaunches
4. Your MCP connection is preserved
5. Call `new_game()` to start testing with the new code

**Time:** ~1-2 seconds (TypeScript incremental compilation).

---

## Canonical Workflow: Test → Code → Verify

This is the recommended loop for agent-driven development.

### Phase 1: Write a Test Scenario

```typescript
// 1. Start a game
const gameResp = await callMcpTool('new_game', {
  seed: 42,
  players: [
    { id: 'p1', behavior: 'random' },
    { id: 'p2', behavior: 'passive' }
  ]
});
assert(gameResp.ok);

// 2. Auto-progress to a specific state
const progressResp = await callMcpTool('auto_play_until', {
  condition: "currentTurn == 'p1' && phase == 'placement'",
  maxTurns: 500
});
assert(progressResp.ok);

// 3. Snapshot before the test action
const snapResp = await callMcpTool('snapshot', {});
const beforeSnap = snapResp.snapshot_id;

// 4. Get current state to verify we're in the right place
const stateResp = await callMcpTool('get_game_state', {});
assert(stateResp.state.currentTurn === 'p1');
assert(stateResp.state.phase === 'placement');
```

### Phase 2: Test a Behavior

```typescript
// 5. Query legal actions
const legalResp = await callMcpTool('get_legal_actions', {
  player_id: 'p1'
});
const [firstLegal] = legalResp.actions;

// 6. Execute the action
const actionResp = await callMcpTool('take_action', {
  player_id: 'p1',
  action: firstLegal.action,
  params: firstLegal.params
});
assert(actionResp.ok);

// 7. Verify the result
const afterStateResp = await callMcpTool('get_game_state', {});
const p1Before = stateResp.state.players.find(p => p.id === 'p1');
const p1After = afterStateResp.state.players.find(p => p.id === 'p1');
assert(p1After.score >= p1Before.score, 'Score should not decrease');
```

### Phase 3: Code Change

```typescript
// 8. Edit source code (in your tool context)
// For example, fix a scoring bug in packages/game-core/src/scoring.ts

// 9. Rebuild the harness
const rebuildResp = await callMcpTool('rebuild', {});
assert(rebuildResp.ok);

// 10. Re-run the test with the same seed
const gameResp2 = await callMcpTool('new_game', {
  seed: 42,
  players: [
    { id: 'p1', behavior: 'random' },
    { id: 'p2', behavior: 'passive' }
  ]
});
assert(gameResp2.ok);

// ... repeat steps 2-7 with new code ...
```

### Phase 4: Verify Determinism

```typescript
// 11. Run the same scenario 3 times with seed=42
const runs = [];
for (let i = 0; i < 3; i++) {
  const gameResp = await callMcpTool('new_game', {
    seed: 42,
    players: [
      { id: 'p1', behavior: 'random' },
      { id: 'p2', behavior: 'passive' }
    ]
  });

  const finalResp = await callMcpTool('auto_play_until', {
    condition: "gameEnded == true",
    maxTurns: 10000
  });

  const stateResp = await callMcpTool('get_game_state', {});
  runs.push(stateResp.state);
}

// Verify all 3 runs produced identical outcomes
assert(runs[0].players[0].score === runs[1].players[0].score);
assert(runs[1].players[0].score === runs[2].players[0].score);
```

---

## Common Patterns

### Pattern 1: Test a Specific Scenario Multiple Times

```json
[
  { "name": "new_game", "seed": 42, "players": [...] },
  { "name": "auto_play_until", "condition": "round == 2" },
  { "name": "snapshot" },
  { "name": "take_action", "player_id": "p1", "action": "place_domino", "params": {...} },
  { "name": "get_game_state" },
  { "name": "restore", "snapshot_id": "snap-from-earlier" },
  { "name": "take_action", "player_id": "p1", "action": "place_domino", "params": {...different...} },
  { "name": "get_game_state" }
]
```

Compare the two `get_game_state` results to see how different placements affect outcomes.

---

### Pattern 2: Run a Complete Game and Verify Final State

```json
[
  { "name": "new_game", "seed": 123, "players": [
    { "id": "p1", "behavior": "aggressive" },
    { "id": "p2", "behavior": "aggressive" }
  ] },
  { "name": "auto_play_until", "condition": "gameEnded == true", "maxTurns": 10000 },
  { "name": "get_game_state" }
]
```

Extract `get_game_state` result and assert:
- All players have valid scores
- Board states are legal
- No ties (or ties handled correctly)

---

### Pattern 3: Replay from Snapshot

```json
[
  { "name": "new_game", "seed": 999, "players": [...] },
  { "name": "auto_play_until", "condition": "phase == 'placement' && currentTurn == 'p1'" },
  { "name": "snapshot" },
  { "name": "take_action", "player_id": "p1", "action": "skip" },
  { "name": "auto_play_until", "condition": "currentTurn == 'p1' && phase == 'placement'" },
  { "name": "restore", "snapshot_id": "previous-snap" },
  { "name": "take_action", "player_id": "p1", "action": "place_domino", "params": {...} }
]
```

Use snapshots to explore different decision branches.

---

### Pattern 4: Test Illegal Move Handling

```json
[
  { "name": "new_game", "seed": 42, "players": [...] },
  { "name": "auto_play_until", "condition": "phase == 'placement'" },
  { "name": "get_legal_actions", "player_id": "p1" },
  { "name": "take_action", "player_id": "p1", "action": "place_domino", "params": {
    "domino_id": "fake-domino-xyz",
    "x": 999,
    "y": 999
  } }
]
```

The last call should return an error response with `reason` code and `legalActions` list.

---

### Pattern 5: Stress Test with Multiple Seeds

```
for seed in 0 1 2 3 4 5:
  1. new_game(seed)
  2. auto_play_until(gameEnded)
  3. get_game_state()
  4. assert(all players have valid scores)
  5. assert(final phase is 'end_game')
  6. assert(no duplicate dominos on board)
```

---

## Troubleshooting

### Issue: `new_game` fails with "module not found"

**Cause:** Dependencies not installed or build failed.

**Fix:**
```bash
cd packages/harness
npm install
npm run build
npm run harness  # Restart
```

---

### Issue: Rebuilt code doesn't take effect

**Cause:** Forgot to call `rebuild` after code changes.

**Fix:**
```json
{ "name": "rebuild" }
```

Wait ~1-2 seconds, then continue.

---

### Issue: Same seed produces different results on second run

**Cause:** Game state not reset between `new_game` calls.

**Fix:** Always call `new_game()` before starting a fresh scenario. The wrapper maintains a single game session in memory; `new_game()` replaces it.

---

### Issue: `take_action` returns "illegal_action" when move should be legal

**Cause:** Phase or turn expectations don't match actual state.

**Fix:**
1. Call `get_game_state()` to inspect current phase and whose turn it is
2. Call `get_legal_actions(player_id)` to see what moves are actually available
3. Adjust your action or condition

---

### Issue: `auto_play_until` never returns (infinite loop)

**Cause:** Condition never met, or behavior is stuck.

**Fix:**
1. Use `maxTurns` to set a ceiling (default: 1000)
2. Call `get_game_state()` to see what's happening
3. Inspect the behavior code (in `packages/harness/behaviors/`)
4. Consider using `snapshot()` and manual `take_action()` to step through

---

## Performance Notes

- **Compilation time:** ~1-2 seconds (incremental TypeScript)
- **new_game:** <100ms
- **take_action:** <50ms
- **auto_play_until (full game):** ~200-500ms depending on seed/behaviors
- **Snapshot/restore:** <10ms
- **get_game_state (serialization):** <20ms

The harness is fast enough for rapid iteration. Rebuilds are the slowest step, but still under 2 seconds.

---

## References

- **Implementation Plan:** `HARNESS_IMPLEMENTATION_PLAN.md`
- **Verification Report:** See `HARNESS_IMPLEMENTATION_PLAN.md` → "Development Loop (After Implementation)"
- **Code Conventions:** `client/src/CLAUDE.md`
- **Game Engine:** `packages/game-core/` (the engine being driven by the harness)
- **Harness Source:** `packages/harness/`

---

## Quick Reference: All Tools

| Tool | Purpose | Key Params |
|------|---------|-----------|
| `new_game` | Start game | `seed`, `players` |
| `get_game_state` | Inspect state | (none) |
| `get_player_state` | Inspect player | `player_id` |
| `get_legal_actions` | Query moves | `player_id` |
| `take_action` | Apply move | `player_id`, `action`, `params` |
| `auto_turn` | Auto one turn | `player_id` |
| `auto_play_until` | Auto to condition | `condition`, `maxTurns` |
| `wait_for_state` | Sync to state | `phase`, `player_id` |
| `snapshot` | Checkpoint | (none) |
| `restore` | Rewind | `snapshot_id` |
| `rebuild` | Recompile | (none) |

---

**You are ready to use the harness. Begin with a test scenario, then iterate on code and behavior.**
