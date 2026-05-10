# Harness Quickstart — Running Game Scenarios

Practical reference for running Kingdomino games through the MCP harness extension.
Read this before writing any scenario code.

---

## What the Harness Is

An MCP server (`packages/harness/mcp-server.ts`) that imports the game engine directly
and exposes it as structured tools. It owns all game state. You drive every player from
one session — no separate processes, no sockets.

The harness is already running when you have access to the custom tools listed below.
After changing harness source, call `harness_reload` to hot-reload without dropping
your session.

---

## Minimal Complete Game

```
1. new_game        — create session, deal first round
2. auto_play_until — run to completion
3. read scores     — from state.players[*].score
```

```python
new_game(seed=42, players=[
  { id: "Alice", behavior: "random" },
  { id: "Bob",   behavior: "random" },
])

auto_play_until(condition="phase == finished", max_turns=500)
# → state.phase == "finished", state.players has final scores
```

A 4-player game completes in roughly 75 turns. Always set `max_turns` to at least 200
for safety; 500 is comfortable.

---

## Available Tools

| Tool | What it does |
|------|-------------|
| `new_game(seed, players)` | Start a fresh game; deals the first round immediately |
| `get_game_state()` | Read current state without side effects |
| `get_legal_actions(player_id)` | List every legal action for one player right now |
| `take_action(player_id, action, params)` | Apply one action; returns new state or structured error |
| `auto_turn(player_id)` | Behavior-driven single action for one player |
| `auto_play_until(condition, max_turns)` | Run until condition is true or turn limit hit |
| `snapshot()` | Save current state; returns `snapshot_id` |
| `restore(snapshot_id)` | Rewind to a saved state |
| `harness_reload` | Recompile and hot-reload after source changes |

---

## Player Behaviors

Pass `behavior` in each player config to `new_game`:

| Behavior | What it does |
|----------|-------------|
| `"random"` | Picks uniformly at random from legal actions (seeded — deterministic) |
| `"passive"` | Always lowest-impact legal action |
| `"aggressive"` | Maximises score / damage each turn |
| `"scripted"` | Follows a predetermined action sequence you supply |
| `"cheater"` | Attempts illegal actions — use to verify rejection logic |

---

## Reading Game State

After any tool call the returned `state` has this shape:

```json
{
  "phase": "playing" | "finished",
  "variant": "standard",
  "players": [
    {
      "id": "Alice",
      "score": 19,
      "board": [ /* 13×13 grid, sparse */ ]
    }
  ],
  "currentRound": {
    "phase": "picking" | "placing",
    "currentActor": "Bob",
    "deal": {
      "slots": [
        { "cardId": 9,  "pickedBy": null },
        { "cardId": 29, "pickedBy": "Alice" }
      ]
    }
  } | null
}
```

Key fields:
- `state.phase` — `"finished"` means the game is over; scores are final
- `state.currentRound.currentActor` — only this player has legal actions right now
- `state.currentRound.phase` — `"picking"` or `"placing"` (one player acts at a time)
- `state.currentRound.deal.slots` — cards in the current deal; `pickedBy: null` means still available
- `state.players[i].score` — live score, updates after every placement

---

## `auto_play_until` Conditions

The condition string uses dot-path `==` syntax evaluated against the state object:

```
"phase == finished"         ← game over
"phase == playing"          ← game in progress
```

The harness evaluates this against the serialized state before each turn. The condition
is checked at the *start* of each turn, so the game always ends on the turn it
transitions — no extra turns run after the game finishes.

---

## Determinism

Same seed → identical game every time. This is guaranteed end-to-end:

- Card dealing uses `getNextFourCards(hexSeed, remainingDeck)` — seeded shuffle
- Pick order uses `chooseOrderFromSeed(hexSeed, playerIds)` — seeded shuffle
- All behavior decisions use the same seeded RNG derived from the numeric seed
- Boards, scores, and turn counts are bit-for-bit identical across runs

**To verify determinism:** Run the same seed three times and compare `state.players[*].score`
and `turns_played`. They must all match.

---

## Common Patterns

### Run a game and get the winner

```python
new_game(seed=42, players=[...])
result = auto_play_until(condition="phase == finished", max_turns=500)
scores = [(p.id, p.score) for p in result.state.players]
winner = max(scores, key=lambda x: x[1])
```

### Compare two seeds

```python
new_game(seed=1); auto_play_until(...)   # scores A
new_game(seed=2); auto_play_until(...)   # scores B
```

### Snapshot and replay from mid-game

```python
new_game(seed=42, players=[...])
auto_play_until(condition="phase == playing", max_turns=30)
snap = snapshot()
auto_play_until(condition="phase == finished", max_turns=500)   # run A
restore(snapshot_id=snap.snapshot_id)
auto_play_until(condition="phase == finished", max_turns=500)   # run B (identical)
```

### Test illegal move rejection

```python
new_game(seed=42, players=[{ id: "P1", behavior: "cheater" }, ...])
legal = get_legal_actions(player_id="P1")
# try an action not in legal list:
result = take_action(player_id="P1", action="pick", params={ cardId: 999 })
# result.ok == false, result.reason == "action_not_legal"
```

### Reload after changing harness source

```python
# edit packages/harness/mcp-server.ts ...
harness_reload()
# session continues — no reconnect needed
new_game(...)
```

---

## Gotchas

**`auto_play_until` errors are not failures.**
The `errors` array in the response lists only genuine problems (behavior chose
an illegal action, engine threw). Players with no legal actions on a given turn
are silently skipped — this is normal, since only one player can act at a time.
A clean game ends with no `errors` key in the response at all.

**Card ID 0 is valid.**
The deck contains cards `0`–`47`. Card ID `0` is a real card. Any check like
`if (cardId)` will silently skip it — the harness has already fixed this internally,
but watch for it in any scenario code you write.

**`currentRound` is null between rounds.**
When the last player places their domino, `ROUND_COMPLETE` fires, the next round
starts synchronously, and `currentRound` is populated again before the response
returns. You will not normally observe `currentRound: null` during a running game.
It is `null` only at the start (before `new_game` has been called) and at the end
(after `phase` transitions to `"finished"`).

**Pick order changes every round.**
In Kingdomino, whoever picked the lowest-numbered card in round N goes first in
round N+1. The harness tracks this automatically via `Deal.nextRoundPickOrder()`.
Do not assume a fixed player order across rounds.

**Behaviors only act when they are `currentActor`.**
In `auto_play_until`, the harness tries all players each turn but silently skips
anyone with no legal actions. Only the `currentActor` ever has legal actions,
so exactly one player acts per turn (pick or place). 96 actions total (12 rounds
× 4 players × 2 actions) means a 4-player game needs at least 96 turns; budget 200+.

---

## After Changing the Engine

If you modify `packages/kingdomino-engine/` or `packages/harness/`:

```python
harness_reload()
```

This recompiles and relaunches the MCP server in-process. Your session stays open.
Then run a fresh `new_game` — old game state is discarded on reload.

If TypeScript reports errors during reload, fix them before continuing. The harness
will report the compile error and leave the old server running so you do not lose
your session.
