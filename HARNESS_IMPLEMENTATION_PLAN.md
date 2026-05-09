# MCP Harness Implementation Plan

**Date Created:** 2026-05-10  
**Status:** Tasks created with full dependency chain  
**Source Documents:** `docs/agent-devx.md` + `docs/mcp-harness.md`

---

## Overview

This plan implements a Model Context Protocol (MCP) server harness that makes the Kingdomino game fully autonomous-agent-drivable. No human steps in the development loop: the agent launches the game, plays all sides, verifies state, and iterates on code changes without leaving its tool session.

### Key Principles

1. **Deterministic execution** — all randomness is seeded
2. **Structured outputs** — all responses are typed JSON
3. **Single session, all players** — agent controls all actors from one MCP connection
4. **Session continuity** — agent's MCP connection survives rebuilds
5. **Cheap tool extension** — add a new tool in ~15 minutes when needed

---

## Implementation Tasks (9 Sequential Steps)

Each task has a linear dependency on the previous one. **Do not skip ahead.** Each step has explicit acceptance criteria that must pass before proceeding.

| # | Task ID | Title | Focus | Acceptance Test |
|---|---------|-------|-------|-----------------|
| 1 | `kingdomino-irj` | MCP Protocol Shell | Minimal JSON-RPC over stdio | Send `initialize`, receive valid response |
| 2 | `kingdomino-bil` | Seeded PRNG | Deterministic random number generation | `createRng(42)()` produces same value every run |
| 3 | `kingdomino-0ws` | Snapshot Store | In-memory state checkpointing | Snapshot → mutate → restore → verify identity |
| 4 | `kingdomino-uzy` | Behavior Interface & Behaviors | 5 client behavior implementations | All 5 behaviors instantiate & choose actions |
| 5 | `kingdomino-20b` | MCP Server Core Tools | 7 core state/action tools | `new_game` → `take_action` → structured error |
| 6 | `kingdomino-bzp` | MCP Server Automation Tools | 3 autonomous progression tools | `auto_play_until` completes full game |
| 7 | `kingdomino-tms` | Lifecycle Wrapper | Process lifecycle + rebuild | Edit code → `rebuild` → verify without reconnect |
| 8 | `kingdomino-zqa` | TypeScript Configuration | Build config with incremental compilation | `tsc` runs in seconds, outputs to `dist-harness/` |
| 9 | `kingdomino-3s6` | package.json Scripts | Entry point scripts | `npm run harness` launches wrapper successfully |

---

## File Structure After Implementation

```
kingdomino/
├── harness/
│   ├── mcp.ts                      ← MCP protocol shell (STEP 1)
│   ├── mcp-server.ts               ← Game orchestrator (STEPS 5 & 6)
│   ├── harness.ts                  ← Lifecycle wrapper (STEP 7)
│   ├── seed.ts                     ← Seeded PRNG (STEP 2)
│   ├── snapshots.ts                ← State snapshots (STEP 3)
│   └── behaviors/
│       ├── index.ts                ← Behavior registry & resolver
│       ├── scripted.ts             ← Predetermined action sequences
│       ├── random.ts               ← RNG-based legal moves
│       ├── passive.ts              ← Minimal-impact moves
│       ├── aggressive.ts           ← Maximizing moves
│       └── cheater.ts              ← Illegal move tester
│
├── tsconfig.harness.json           ← Build config (STEP 8)
├── game-core/                      ← Unchanged; only used as module
│   └── ...
│
└── package.json                    ← With harness scripts (STEP 9)
```

---

## Development Loop (After Implementation)

Once the harness is running, every iteration follows this pattern:

```typescript
rebuild()                        // 1. Rebuild on code change
new_game({ seed: 42, players })  // 2. Start deterministic game
auto_play_until({                // 3. Auto-progress to test scenario
  condition: "current_turn == 'p1' && phase == 'action'"
})
take_action({                    // 4. Agent plays p1
  player_id: 'p1',
  action: 'play_card',
  params: { card_id: 'X' }
})
wait_for_state({ phase: 'resolution' })  // 5. Sync with state
state = get_game_state()         // 6. Verify outcome
assert(state.players.p2.health == 14)    // 7. Assert behavior
```

---

## Key Tools Exposed

### State/Action Tools (STEP 5)
- `new_game(seed, players)` — initialize with fixed seed
- `get_game_state()` — current full game state
- `get_player_state(player_id)` — private player state
- `get_legal_actions(player_id)` — available moves
- `take_action(player_id, action, params)` — apply move with validation
- `snapshot()` / `restore(snapshot_id)` — checkpoint/restore

### Automation Tools (STEP 6)
- `auto_turn(player_id)` — automatically choose & apply action
- `auto_play_until(condition, max_turns)` — auto-progress to condition
- `wait_for_state(phase, player_id)` — validate expected state

### Lifecycle Tools
- `rebuild()` — intercepts at wrapper level; rebuilds & relaunches server

---

## Design Decisions

1. **In-process game core** — Game state lives in MCP server memory, not in separate process. Eliminates IPC overhead.

2. **Behavior registry** — Client behavior is resolved at tool-call time, not at game init. Allows behavior changes mid-session if needed (though not typical).

3. **No HTTP/REST** — Direct JSON-RPC over stdio. Simpler, no port management, trivial to wrap for rebuilds.

4. **Structured errors only** — Illegal moves return `{ ok: false, reason: "code", legal_actions: [...] }`. Agent can programmatically distinguish violation types.

5. **Seeded RNG enforced** — Any `Math.random()` call is a bug. All randomness routed through `createRng()`.

6. **Incremental TypeScript** — Build time must stay in seconds. `tsconfig.harness.json` has `incremental: true` with persistent `.tsbuildinfo`.

---

## Quality Gates

**Before claiming a task complete:**

1. ✅ Acceptance criteria pass (listed in each task)
2. ✅ No external dependencies beyond what's listed
3. ✅ All responses are structured JSON (no prose)
4. ✅ Code follows TypeScript conventions in `client/src/CLAUDE.md`
5. ✅ No `Math.random()` or unseeded randomness anywhere

**Before finalizing the full harness:**

1. ✅ All 9 tasks pass their acceptance criteria
2. ✅ `npm run harness` launches without manual steps
3. ✅ Full canonical loop (rebuild → new_game → auto_play_until → assertions) succeeds
4. ✅ Rebuild survives code edits without dropping MCP session

---

## Entry Point

```bash
npm run harness
```

This launches the wrapper (`harness.ts`), which:
1. Compiles with `tsc -p tsconfig.harness.json`
2. Spawns `node dist-harness/harness/mcp-server.js`
3. Proxies all JSON-RPC between agent and server
4. Intercepts `rebuild`, re-tsc + re-spawn without dropping MCP connection

Agent receives valid MCP tools immediately.

---

## Success Criteria (Overall)

✅ Agent can autonomously:
- Launch the game with `new_game(seed, players)`
- Drive all players via `take_action(player_id, ...)`
- Verify game state with structured queries (`get_game_state()`)
- Iterate code changes with `rebuild` without reconnecting
- Test arbitrary game scenarios via snapshots & auto-progression

✅ No human intervention required for:
- Starting/stopping game
- Providing input or observing state
- Managing player connections or sessions
- Handling build failures

---

## References

- **Agent Dev Loop Principles:** `docs/agent-devx.md`
- **MCP Harness Architecture:** `docs/mcp-harness.md`
- **Project Context:** `AGENTS.md`
- **TypeScript Conventions:** `client/src/CLAUDE.md`

---

## Timeline Estimate

Assuming one task per session:
- **STEPS 1–4:** Foundation (MCP protocol, randomness, snapshots, behaviors) — ~2–3 sessions
- **STEPS 5–6:** Server orchestration (core + automation tools) — ~2–3 sessions
- **STEPS 7–9:** Lifecycle + configuration — ~1–2 sessions

**Total:** ~5–8 sessions to full harness operational.

Each session starts with priming: `bd ready` shows next available task, claim it, execute with verification.

---

**Created:** 2026-05-10 · **Next action:** Claim `kingdomino-irj` and implement MCP Protocol Shell
