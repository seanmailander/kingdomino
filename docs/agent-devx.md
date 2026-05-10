# AGENT DEVELOPMENT LOOP PRINCIPLES
# AGENT DEV LOOP — BOARD GAME

Your game exposes an embedded MCP server (launched via `--mcp`) and a lifecycle wrapper that builds, launches, and proxies all MCP traffic. This is how you interact with the running game — not via UI automation or manual steps.

**Setup requirement:** If the MCP server or lifecycle wrapper is missing, implement them before anything else. The wrapper must handle coordinated stop/build/relaunch of server + all clients without dropping your MCP session.

**Every loop:**
1. `rebuild` — wrapper recompiles and relaunches all processes, session stays connected
2. `new_game(seed=X)` — always use a fixed seed; unseeded randomness breaks verification
3. `take_action(player_id, ...)` — act as all players from this single MCP session
4. `wait_for_state(phase, player_id)` — wait for the specific state transition before verifying
5. `get_game_state()` / `get_player_state(player_id)` — verify with structured data, not screenshots
6. Pass/fail decision — do not proceed without one

**Rules:**
- If a tool is missing, add it to the MCP server before working around it
- Assert against game surface behavior (player health, legal moves, events), never internals
- Illegal move responses must return structured JSON with a `reason` code
- Use `snapshot()` / `restore(snapshot_id)` to test mid-game states without replaying from move 1
- Screenshots only for renderer testing, never for logic verification

## PURPOSE

These principles govern how you structure a development loop when building or modifying a multiplayer board game. Follow them to maximize autonomy, minimize human intervention, and maintain fast, verifiable iteration cycles.

---

## PRINCIPLE 1: ELIMINATE HUMAN-GATED STEPS

Every step that requires a human action is a loop-breaking bottleneck. You MUST replace all such steps with tool calls before beginning an iteration cycle.

**Audit checklist — if any of these require a human, fix it first:**

- Launching or restarting the game server or client(s)
- Providing player input or simulating turns
- Observing game state or rule outcomes
- Capturing or describing visual results

---

## PRINCIPLE 2: THREE REQUIRED TOOL CATEGORIES

Before beginning a development loop, verify you have access to tools in all three categories. If any category is missing, expose or implement the missing tools before proceeding.

### 2a. DO — Mutate game state

Tools that act on the game. Examples:

- `new_game(seed, players, config)` — start a game with a fixed seed
- `take_action(player_id, action, params)` — submit a move as any player
- `set_game_state(state)` — force a specific board configuration for testing

### 2b. WAIT — Synchronize with state transitions

Games are turn-based and event-driven, not pipeline-driven. Do not use a generic `wait_idle()`. Wait for specific, semantic game states.

- `wait_for_state(phase, player_id)` — block until it is a specific player's turn in a specific phase
- `wait_for_event(event_type)` — block until a named game event fires (e.g. `"card_resolved"`, `"round_end"`)

**Never verify immediately after a mutation. Always wait for the expected state transition first.**

### 2c. VERIFY — Observe game state

Prefer structured state over visual capture. Board game correctness is almost entirely expressible as structured data.

- Structured (preferred): `get_game_state()`, `get_player_state(player_id)`, `get_legal_actions(player_id)`
- Visual (fallback): `screenshot()` — use only when testing the renderer, not game logic

---

## PRINCIPLE 3: MAINTAIN SESSION CONTINUITY ACROSS REBUILDS

The agent's tool session MUST NOT be interrupted by a recompile. For multiplayer, this includes coordinated teardown and relaunch of all processes (server + N clients).

The rebuild mechanism must:

1. Stop all game processes (server and clients)
2. Recompile from source
3. Relaunch all processes and reconnect them
4. Return control to the agent without requiring manual reconnection

**Implementation pattern:** A lifecycle wrapper that proxies tool calls and intercepts `rebuild` to manage the full multi-process cycle. If the session drops on rebuild, fix the wrapper before iterating.

---

## PRINCIPLE 4: TEST AGAINST GAME RULES AND STATE TRANSITIONS, NOT INTERNALS

Write verification logic against observable game behavior — legal/illegal moves, state changes, turn progression — not internal implementation details.

**DO:**

```
take_action(player_id=1, action="play_card", card_id="fireball")
wait_for_state(phase="resolution")
state = get_game_state()
assert state.last_event == "card_resolved"
assert state.players[2].health == 14  # was 20, fireball deals 6
```

**DO NOT:**

```
assert card_engine.resolution_queue[0].damage_value == 6
```

Rationale: Internal structure changes frequently during development. Surface behavior tests survive refactors, pipeline changes, and engine rewrites.

---

## PRINCIPLE 5: KEEP TOOL SURFACE CHEAP TO EXTEND

When a verification or action cannot be expressed with existing tools, add a new tool immediately.

**Tool addition cost target:** ~15 minutes per tool.

A new tool should:

- Map directly to an existing game method or event
- Accept structured input (typed parameters, not free text)
- Return structured JSON output
- Require no new dependencies

If adding a tool takes significantly longer, the game's internal API is too opaque — surface more of it.

---

## PRINCIPLE 6: PREFER STRUCTURED OUTPUT OVER SCREENSHOTS

Screenshots are expensive and error-prone. Game logic verification should never require them.

| Verification target       | Preferred tool                        |
| ------------------------- | ------------------------------------- |
| Board state               | `get_game_state()`                    |
| Player hand / resources   | `get_player_state(player_id)`         |
| Legal move set            | `get_legal_actions(player_id)`        |
| Rule violation reason     | structured error from `take_action()` |
| Visual layout / rendering | `screenshot()` → PNG                  |

If you are calling `screenshot()` to check something expressible as a state field, add that field to a structured tool instead.

---

## PRINCIPLE 7: USE DETERMINISTIC GAME SEEDING

All randomness (deck shuffles, dice rolls, spawns) MUST be seedable. Without a fixed seed, verification is non-deterministic and iteration is unreliable.

- Every test scenario is started with `new_game(seed=X)`
- The same seed must produce the same game sequence every run
- Seeds should be logged alongside any failing assertion for reproduction

If the game cannot be seeded, fix this before writing any behavioral tests.

---

## PRINCIPLE 8: CONTROL ALL PLAYERS FROM A SINGLE SESSION

The agent MUST be able to act as all players without managing parallel connections. Expose multi-actor control through a single interface.

- `take_action(player_id, action, params)` — act as any player from one session
- `get_player_state(player_id)` — observe any player's private state (hand, resources)
- Do NOT require separate MCP connections per player

If the game enforces connection-level player identity, add a dev/test mode that bypasses it.

---

## PRINCIPLE 9: SNAPSHOT AND RESTORE GAME STATE

Board games have complex branching state. Replaying from move 1 to reach a mid-game scenario is too slow. Expose checkpoint tools:

- `snapshot()` → returns `snapshot_id`
- `restore(snapshot_id)` → resets game to that exact state

Use snapshots to test edge cases (final round, tiebreaker, low-health scenarios) without replaying full games each iteration.

---

## PRINCIPLE 10: RETURN STRUCTURED RULE VIOLATIONS

When an illegal move is attempted, the response MUST be a structured error with a machine-readable reason — not a generic rejection.

**Required fields on rejection:**

```json
{
  "ok": false,
  "error": "illegal_action",
  "reason": "wrong_phase",
  "expected_phase": "action",
  "actual_phase": "cleanup"
}
```

The agent must be able to distinguish rule violation types programmatically to iterate correctly.

---

## PRINCIPLE 11: USE INCREMENTAL BUILDS

Rebuild time directly caps iteration speed. Configure the build system for incremental compilation.

- Target rebuild time: seconds, not minutes
- For multiplayer: only relaunch processes affected by the change where possible

If rebuilds are slow, profile and fix before optimizing anything else.

---

## PRINCIPLE 12: DESIGN TOOLS FOR AGENT CONSUMPTION

The agent is the primary consumer of the game's tool interface.

**Agents need:**

- Deterministic behavior per tool call (especially with fixed seeds)
- Structured, machine-readable responses (typed JSON)
- Self-describing tool names and parameters
- A standard protocol for capability negotiation (e.g. MCP)

**Agents do NOT need:**

- Human-readable error prose
- Versioned REST endpoints
- Clever abstractions that hide game internals

---

## LOOP TEMPLATE

```
1. Edit source file(s)
2. Call `rebuild`                          ← recompile and relaunch all processes
3. Call `new_game(seed=X)`                 ← start deterministic game
4. Call `take_action(player_id, ...)`      ← drive turns for all players
5. Call `wait_for_state(phase, player_id)` ← synchronize with game progression
6. Call `get_game_state()` / `get_player_state()` ← verify outcome
7. Evaluate result against expected state
8. If incorrect → return to step 1
9. If correct   → proceed or snapshot this state as a test fixture
```

Do not skip steps 5 or 6. Do not proceed past step 7 without an explicit pass/fail decision.

---

## FAILURE MODES TO AVOID

| Anti-pattern                             | Consequence                                 | Fix                                      |
| ---------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| Verifying before `wait_for_state`        | Race against turn resolution, flaky results | Always wait for expected phase first     |
| Screenshot for logic checks              | Slow, expensive, error-prone                | Add a structured state tool              |
| Unseeded randomness                      | Non-reproducible failures                   | Require `seed` param on `new_game`       |
| One connection per player                | Agent can't drive full game loop            | Add multi-actor single-session control   |
| Generic rejection errors                 | Agent can't distinguish rule violations     | Return structured error with reason code |
| Replaying full games to reach edge cases | Slow iteration                              | Add `snapshot` / `restore` tools         |
| Session drops on rebuild                 | Loop broken                                 | Fix lifecycle wrapper for all processes  |
| Implementation-coupled assertions        | Tests break on refactor                     | Assert on game surface state only        |
