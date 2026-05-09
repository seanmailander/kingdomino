# MCP HARNESS — IMPLEMENTATION PLAN
# Multiplayer Board Game / Plain TypeScript

---

## WHY THIS EXISTS

This document describes how to build the development and testing infrastructure around the game core. The game logic already exists as plain TypeScript. This plan does not touch it.

The goal is to make the game fully driveable by an AI coding agent — no human steps in the loop. The agent needs to launch the game, play all sides, observe state, verify behavior, and iterate after code changes, all without leaving its tool session.

The mechanism is an embedded MCP server that imports the game core directly and exposes it as a set of structured tools. A lightweight lifecycle wrapper sits outside it, handling build and relaunch so the agent's connection never drops.

This is not production infrastructure. It is a development harness. Simplicity and agent-friendliness take priority over everything else.

---

## HOW IT WORKS

```
┌─────────────────────────────────────────────────────┐
│                harness.ts (wrapper)                 │
│                                                     │
│   tsc → node mcp-server.js                          │
│   proxies stdio JSON-RPC ↔ agent                    │
│   intercepts `rebuild` → kill → tsc → relaunch      │
└──────────────────────┬──────────────────────────────┘
                       │ stdio JSON-RPC
                       ▼
┌─────────────────────────────────────────────────────┐
│                mcp-server.ts                        │
│                                                     │
│   imports game-core directly (in-process)           │
│   owns game state (single source of truth)          │
│   owns client behavior registry                     │
│   exposes all MCP tools                             │
└──────────────────────┬──────────────────────────────┘
                       │ direct function calls
                       ▼
┌─────────────────────────────────────────────────────┐
│                game-core/ (unchanged)               │
│                                                     │
│   createGame(seed, players) → GameState             │
│   applyAction(state, playerId, action) → GameState  │
│   getLegalActions(state, playerId) → Action[]       │
│   isGameOver(state) → boolean                       │
└─────────────────────────────────────────────────────┘
```

The game core is imported as a module — not run as a separate process. There are no sockets, no HTTP, no inter-process coordination. The "clients" are behavior objects inside the MCP server, not running processes. This keeps the harness to two files and eliminates all async coordination overhead.

---

## CONSTRAINTS AND PRINCIPLES

Before writing any code, internalize these:

- **Do not modify game-core.** All changes happen in the harness layer.
- **Game state lives in one place.** The MCP server holds the single state object. Nothing else does.
- **All randomness is seeded.** Every `new_game` call takes a seed. Unseeded code is a bug.
- **All tool responses are structured JSON.** No prose errors, no untyped objects.
- **Illegal move rejections include a reason code.** The agent must be able to distinguish rule violations programmatically.
- **The agent acts as all players from one session.** No parallel connections, no per-player auth.
- **The rebuild tool never drops the MCP session.** The wrapper handles this. If it does drop, fix the wrapper before anything else.

---

## FILE STRUCTURE

```
/
├── game-core/           ← existing, do not modify
│   ├── index.ts
│   ├── state.ts
│   ├── rules.ts
│   └── ...
│
├── harness/
│   ├── mcp-server.ts    ← MCP server, game orchestrator
│   ├── harness.ts       ← lifecycle wrapper (build + relaunch)
│   ├── behaviors/
│   │   ├── index.ts     ← behavior registry and resolver
│   │   ├── random.ts
│   │   ├── passive.ts
│   │   ├── aggressive.ts
│   │   ├── scripted.ts
│   │   └── cheater.ts
│   ├── mcp.ts           ← minimal MCP protocol implementation
│   ├── seed.ts          ← seeded PRNG utility
│   └── snapshots.ts     ← snapshot/restore store
│
├── tsconfig.harness.json
└── package.json
```

---

## IMPLEMENTATION STEPS

Work through these in order. Do not skip ahead. Each step has a verification test — do not proceed until it passes.

---

### STEP 1: MCP Protocol Shell

**File:** `harness/mcp.ts`

Implement the minimum MCP protocol over stdio:
- Read newline-delimited JSON-RPC from `process.stdin`
- Write responses to `process.stdout`
- Handle `initialize` — return server name, version, and capabilities
- Handle `tools/list` — return the list of registered tools with their input schemas
- Handle `tools/call` — dispatch to the registered handler, return result
- All other methods return a standard JSON-RPC method-not-found error

Expose a single `MCPServer` class:
```typescript
const server = new MCPServer({ name: 'game-harness', version: '0.1.0' })
server.tool('tool_name', schema, handler)
server.listen() // starts reading stdin
```

**Verification:** Start the server, send a raw `initialize` JSON-RPC message via stdin, confirm a valid response on stdout. Then send `tools/list`, confirm an empty array returns.

---

### STEP 2: Seeded PRNG

**File:** `harness/seed.ts`

Implement or import a seedable pseudo-random number generator. Do not use `Math.random()` anywhere in the harness.

Expose:
```typescript
function createRng(seed: number): () => number
```

The same seed must produce the same sequence every run. Use a simple algorithm (mulberry32 or xoshiro128 are fine).

**Verification:** `createRng(42)()` returns the same float every run.

---

### STEP 3: Snapshot Store

**File:** `harness/snapshots.ts`

Implement in-memory snapshot storage:
```typescript
function snapshot(state: GameState): string          // returns snapshot_id
function restore(snapshotId: string): GameState      // throws if not found
```

Use a `Map<string, GameState>`. Deep-clone state on snapshot and restore using `structuredClone`. IDs can be incrementing integers cast to strings.

**Verification:** Snapshot a state object, mutate it, restore from snapshot, confirm the restored object matches the original and is not the same reference.

---

### STEP 4: Client Behavior Interface and Registry

**Files:** `harness/behaviors/index.ts` and individual behavior files

Define the interface:
```typescript
interface ClientBehavior {
  chooseAction(state: GameState, playerId: string, rng: () => number): Action
}
```

Implement these behaviors, in this order:

**`scripted.ts`** — highest priority, implement first. Follows a predetermined sequence of actions provided at registration time. Throws a clear error if the script is exhausted but the game expects more input.
```typescript
{ behavior: 'scripted', script: ['draw', 'play:fireball', 'end_turn'] }
```

**`random.ts`** — calls `getLegalActions(state, playerId)`, picks one using the seeded RNG. Never attempts illegal moves.

**`passive.ts`** — always picks the legal action with the lowest impact (fewest state changes, or a defined "pass" action if available).

**`aggressive.ts`** — always picks the legal action that maximises damage or score against opponents.

**`cheater.ts`** — deliberately attempts actions not in `getLegalActions`. Used to verify the game correctly rejects illegal moves.

Implement a resolver:
```typescript
function resolveBehavior(spec: BehaviorSpec): ClientBehavior
```

**Verification:** Instantiate each behavior, call `chooseAction` with a mock state, confirm it returns an action without throwing.

---

### STEP 5: MCP Server — Core Tools

**File:** `harness/mcp-server.ts`

Import game core. Hold state and client registry in module scope. Implement these tools in order:

**`new_game`**
```
input:  { seed: number, players: Array<{ id: string, behavior: BehaviorSpec }> }
output: { ok: true, state: GameState }
```
- Initialise the seeded RNG
- Call `createGame(seed, playerIds)` from game core
- Register each player's behavior with the behavior registry
- Store state in module scope
- Return full initial state

**`get_game_state`**
```
input:  {}
output: { state: GameState }
```
Returns current state. No side effects.

**`get_player_state`**
```
input:  { player_id: string }
output: { player: PlayerState }
```
Returns the private state for one player (hand, resources, etc). Extracts from full game state.

**`get_legal_actions`**
```
input:  { player_id: string }
output: { actions: Action[] }
```
Calls `getLegalActions(state, playerId)` from game core and returns result.

**`take_action`**
```
input:  { player_id: string, action: string, params?: Record<string, unknown> }
output: { ok: true, state: GameState } | { ok: false, error: string, reason: string, legal_actions: Action[] }
```
- Call `getLegalActions` and check legality before applying
- On illegal: return structured error with `reason` field and the current legal action list
- On legal: call `applyAction`, update module-scope state, return new state

**`snapshot`**
```
input:  {}
output: { snapshot_id: string }
```

**`restore`**
```
input:  { snapshot_id: string }
output: { ok: true, state: GameState } | { ok: false, error: string }
```

**Verification:** Start the server, call `new_game`, call `get_game_state`, confirm state matches. Call `take_action` with an illegal move, confirm structured error response with `reason` field present.

---

### STEP 6: MCP Server — Automation Tools

Add these tools to `mcp-server.ts` after Step 5 passes.

**`auto_turn`**
```
input:  { player_id: string }
output: { ok: true, action: Action, state: GameState } | { ok: false, error: string }
```
- Resolves the registered behavior for `player_id`
- Calls `behavior.chooseAction(state, playerId, rng)`
- Internally calls the same logic as `take_action`
- Returns the chosen action and resulting state

**`auto_play_until`**
```
input:  { condition: string, max_turns?: number }
output: { ok: true, turns_played: number, state: GameState, condition_met: boolean }
```
- Repeatedly calls `auto_turn` for each player in turn order
- Stops when `condition` evaluates true against current state, or `max_turns` is reached (default: 200)
- `condition` is a dot-path expression evaluated against state (e.g. `"players.p1.health < 5"`, `"phase == 'final_round'"`)
- Never throws on max turns — returns `condition_met: false` instead
- Returns number of turns played and final state

**`wait_for_state`**
```
input:  { phase?: string, player_id?: string, timeout_turns?: number }
output: { ok: true, state: GameState } | { ok: false, error: 'timeout', state: GameState }
```
Since the game is synchronous and in-process, this does not actually block — it validates that the current state already matches the condition, or returns a timeout error if not. The tool exists to make agent code explicit and readable, and to catch the agent verifying at the wrong moment.

**Verification:** Call `new_game` with two `random` players. Call `auto_play_until({ condition: "is_game_over == true" })`. Confirm it terminates and returns a valid final state.

---

### STEP 7: Lifecycle Wrapper

**File:** `harness/harness.ts`

This is a separate entry point. It does not import the MCP server — it manages the process that runs it.

Responsibilities:
1. On startup: run `tsc -p tsconfig.harness.json`, then spawn `node harness/mcp-server.js` as a child process
2. Proxy all stdin → child stdin, all child stdout → stdout (raw byte forwarding, not JSON parsing)
3. Intercept `rebuild` tool calls before forwarding:
   - Detect a `tools/call` JSON-RPC message where `params.name == "rebuild"`
   - Kill the child process
   - Run `tsc -p tsconfig.harness.json`
   - Relaunch `node harness/mcp-server.js`
   - Resume proxying
   - Respond to the agent's `rebuild` call with `{ ok: true, rebuilt: true }`
4. Never close stdout during a rebuild. The agent's MCP connection must survive.

The `rebuild` tool does not need to be registered in `mcp-server.ts` — the wrapper intercepts it before it reaches the server.

**Verification:** Start the wrapper. Edit a comment in `mcp-server.ts`. Call `rebuild`. Confirm the server restarts and a subsequent `get_game_state` call succeeds without reconnecting.

---

### STEP 8: TypeScript Configuration

**File:** `tsconfig.harness.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist-harness",
    "rootDir": ".",
    "strict": true,
    "incremental": true,
    "tsBuildInfoFile": "./dist-harness/.tsbuildinfo"
  },
  "include": ["harness/**/*", "game-core/**/*"],
  "exclude": ["node_modules"]
}
```

`incremental: true` is required. Rebuild time must stay in seconds. If `tsc` is slow, profile and fix before iterating.

---

### STEP 9: package.json Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "harness": "ts-node harness/harness.ts",
    "harness:build": "tsc -p tsconfig.harness.json",
    "harness:server": "node dist-harness/harness/mcp-server.js"
  }
}
```

The agent entry point is always `npm run harness`. This starts the wrapper, which handles everything else.

---

## FULL TOOL REFERENCE

| Tool | Input | Output |
|---|---|---|
| `new_game` | `seed, players[{id, behavior, script?}]` | `{ ok, state }` |
| `get_game_state` | — | `{ state }` |
| `get_player_state` | `player_id` | `{ player }` |
| `get_legal_actions` | `player_id` | `{ actions }` |
| `take_action` | `player_id, action, params?` | `{ ok, state }` or `{ ok, error, reason, legal_actions }` |
| `auto_turn` | `player_id` | `{ ok, action, state }` |
| `auto_play_until` | `condition, max_turns?` | `{ ok, turns_played, state, condition_met }` |
| `wait_for_state` | `phase?, player_id?, timeout_turns?` | `{ ok, state }` or `{ ok:false, error:'timeout' }` |
| `snapshot` | — | `{ snapshot_id }` |
| `restore` | `snapshot_id` | `{ ok, state }` |
| `rebuild` | — | `{ ok, rebuilt }` (intercepted by wrapper) |

---

## CANONICAL AGENT LOOP

Once the harness is running, every development iteration follows this sequence:

```
rebuild
new_game({ seed: 42, players: [
  { id: 'p1', behavior: 'scripted', script: ['draw', 'play:fireball', 'end_turn'] },
  { id: 'p2', behavior: 'passive' },
  { id: 'p3', behavior: 'cheater' }
]})
auto_play_until({ condition: "current_player == 'p1' && phase == 'action'" })
take_action({ player_id: 'p1', action: 'play_card', params: { card_id: 'fireball' }})
wait_for_state({ phase: 'resolution' })
state = get_game_state()
assert state.last_event == 'card_resolved'
assert state.players.p2.health == 14
snapshot()
```

---

## FAILURE MODES AND FIXES

| Symptom | Cause | Fix |
|---|---|---|
| MCP session drops on `rebuild` | Wrapper closing stdout | Ensure only child process is killed, not wrapper process |
| Non-deterministic test failures | `Math.random()` used somewhere | Grep for `Math.random`, replace with seeded RNG |
| `auto_play_until` never terminates | No legal actions available, infinite loop | Enforce `max_turns` default; log state on exit |
| `cheater` behavior causes server crash | Unguarded `applyAction` call | Always validate legality in `take_action` before applying |
| `scripted` behavior throws mid-game | Script exhausted before game ends | Catch and return structured error; agent should extend the script |
| Slow rebuilds | `incremental` not set or cache invalidated | Verify `tsconfig.harness.json` has `incremental: true` and `.tsbuildinfo` is not gitignored |
| State mutation between snapshot and restore | Shallow clone | Use `structuredClone` in both `snapshot` and `restore` |