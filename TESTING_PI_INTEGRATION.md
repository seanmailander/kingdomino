# Testing the Pi-Harness Integration

**Guide:** How to test and verify the pi ↔ Kingdomino harness integration end-to-end.

---

## Prerequisites

```bash
# 1. Build the harness
cd /Users/seanmailander/src/kingdomino/packages/harness
npm install
npm run build
npm test  # Should show 13 tests passing ✅

# 2. Verify all client tests pass
cd ../client
npm test  # Should show 108 tests passing ✅

# 3. Ensure pi is installed globally
pi --version  # Should show @earendil-works/pi-coding-agent version
```

---

## Test 1: Extension Auto-Discovery

**Objective:** Verify pi auto-discovers and loads the kingdomino-harness extension.

```bash
cd /Users/seanmailander/src/kingdomino

# Start pi - extension should load
pi

# Expected:
# ✓ Startup header shows "✅ Kingdomino harness connected"
# ✓ 9 game tools available in tool menu
# ✓ No errors in console
```

### Manual Verification

In pi interactive mode:

```
Type: /harness-status

Expected response:
✅ Harness Status: ✅ Connected (9 tools)
```

---

## Test 2: Connection Lifecycle

**Objective:** Verify harness connects, disconnects, and reconnects cleanly.

### Startup

```bash
pi
# Extension auto-connects on session_start

Expected:
- No timeout errors
- Status command shows "Connected"
```

### Status Check

```
Type: /harness-status

Expected:
✅ Harness Status: ✅ Connected (9 tools)
```

### Restart

```
Type: /harness-restart

Expected:
1. "Harness disconnected, reconnecting..." notification
2. "✅ Kingdomino harness connected" confirmation
3. Status: "✅ Connected (9 tools)"
```

### Cleanup

```
Type: /quit

Expected:
- Process terminates cleanly
- No orphaned harness process
```

Verify:
```bash
ps aux | grep "node.*harness"
# Should show no processes
```

---

## Test 3: Tool Invocation

**Objective:** Test each tool works via the extension.

### Test 3a: new_game

```
Prompt: "Start a 2-player game with seed 42"

Expected flow:
1. LLM chooses to call: new_game(seed=42, players=[{id: "p1", behavior: "random"}, {id: "p2", behavior: "passive"}])
2. Extension sends JSON-RPC to harness
3. Harness creates game session
4. Response: {ok: true, game: {id: "...", phase: "draft", round: 1}}
5. Pi displays: Game created with 2 players, phase: draft
```

### Test 3b: get_game_state

```
Prompt: "What's the current game state?"

Expected flow:
1. LLM calls: get_game_state()
2. Response includes: phase, players, scores, board snapshots
3. Pi displays: Full game state JSON
4. Agent summarizes: "Game in draft phase, both players at 0 points"
```

### Test 3c: auto_play_until

```
Prompt: "Play the game automatically until it ends"

Expected flow:
1. LLM calls: auto_play_until(condition="gameEnded == true", maxTurns=1000)
2. Harness auto-plays all rounds with configured behaviors
3. Response: {ok: true, turnsExecuted: 47, finalState: {...}}
4. Pi displays: Game complete in 47 turns
5. Agent extracts: Final scores, winner
```

### Test 3d: snapshot + restore

```
Prompt: "Save the game state, make a move, then rewind"

Expected flow:
1. LLM calls: snapshot()  → snap-id: "snap-1234567890"
2. LLM calls: take_action(player_id="p1", action="place_domino", params={...})
3. LLM calls: restore(snapshot_id="snap-1234567890")
4. All succeed with no errors
5. Agent: "State restored to before the placement"
```

---

## Test 4: End-to-End Scenario

**Objective:** Run a complete agent workflow with game testing.

### Scenario Script

Copy this and paste into pi:

```
Start a 3-player game with aggressive behavior. Play until round 2 is complete. 
Then show me the board state for each player.
```

### Expected Steps

1. **new_game** called with 3 aggressive players
2. **auto_play_until** runs to `round == 3` (after round 2)
3. **get_game_state** returns state with boards
4. **Agent summarizes:** Describes each player's board, current scores, next player to move

### Expected Timing

- Total time: < 3 seconds
- No timeout errors
- Clear console output

---

## Test 5: Error Handling

**Objective:** Verify graceful error handling.

### Test 5a: Illegal Move

```
Prompt: "Start a game and try to place a domino at an invalid location"

Expected:
1. take_action called with invalid params
2. Harness returns: {ok: false, reason: "invalid_placement", legalActions: [...]}
3. Pi displays error clearly
4. Agent recognizes error and suggests legal alternatives
```

### Test 5b: Harness Crash Recovery

```
Manually kill the harness process:
ps aux | grep "node.*harness" | grep -v grep | awk '{print $2}' | xargs kill

Then in pi:
Type: /harness-restart

Expected:
1. Notification: "Harness disconnected, reconnecting..."
2. Harness restarts
3. Notification: "✅ Kingdomino harness connected"
4. Tools work again immediately
```

---

## Test 6: Hot-Reload

**Objective:** Verify `rebuild` tool and code changes work.

### Step 1: Baseline Game

```
pi → Prompt: "Start a game with seed=100 and play until completion"

Record final scores:
- P1: X points
- P2: Y points
```

### Step 2: Make a Code Change

```bash
# Edit game logic (just for testing, revert after)
edit packages/game-core/src/scoring.ts

# Add a comment or log statement (don't break code)
```

### Step 3: Rebuild

```
pi → Type: /harness-restart

Expected:
1. Code recompiled
2. Harness restarted
3. Connection preserved
```

### Step 4: Re-run Same Game

```
pi → Prompt: "Start a game with seed=100 and play until completion"

Verify:
- Same final scores as Step 1 (determinism)
- New code is active
```

### Step 5: Cleanup

```bash
# Revert any changes made in Step 2
git checkout packages/game-core/src/scoring.ts
```

---

## Test 7: Performance

**Objective:** Verify performance is acceptable for agent use.

### Metrics to Track

Use `/session` command in pi to see token/cost usage.

| Operation | Target | Command |
|-----------|--------|---------|
| Startup | <1s | Launch pi, wait for extension load |
| new_game | <200ms | `new_game(seed=0, players=[...])` |
| get_game_state | <100ms | `get_game_state()` |
| auto_play_until | <2s | Auto-play full game with default behaviors |
| snapshot | <50ms | `snapshot()` |
| restore | <50ms | `restore(snap-id)` |
| Hot-reload | <3s | `/harness-restart` |

### Test Script

```bash
# Time harness startup
time pi --no-session <<< "/quit"

# Time tool calls (in a session)
# Use /session to see timing
```

---

## Test 8: Multiple Sessions

**Objective:** Verify extension works across session branching.

### Workflow

```
1. pi  # Start session A
   Prompt: "Start a game with seed=1"
   Record session ID

2. /new  # Start fresh session B
   Prompt: "Start a game with seed=2"
   Record session ID

3. /resume  # Switch back to session A
   Verify: Game with seed=1 state is intact

4. Type: /fork
   Select a previous message in A
   Prompt: "Continue from here with different move"
   
5. /resume session B
   Verify: Seed=2 game state unchanged
```

---

## Test 9: Documentation Examples

**Objective:** Verify all examples in documentation work.

### Example 1: From PI_HARNESS_INTEGRATION.md

```
Prompt: "Start a Kingdomino game with 2 random players and play until completion"

Expected output (from doc):
"Game complete. P1 scored 45, P2 scored 38. Final winner: P1"
```

### Example 2: From HARNESS_AGENT_GUIDE.md

```
Prompt: "Create a 3-seed determinism test. Run the same game 3 times with seed=99 
         and verify all outcomes are identical."

Expected:
Agent creates loop, runs 3 times, compares scores and board states.
Result: "All 3 runs produced identical outcomes. Determinism verified."
```

---

## Debugging Checklist

If tests fail, use this checklist:

### Extension Not Loading

```bash
# Check extension file exists
ls -la .pi/extensions/kingdomino-harness.ts

# Check TypeScript syntax (in pi's environment)
pi -e .pi/extensions/kingdomino-harness.ts

# Check pi logs
cat ~/.pi/agent/sessions/*/*/messages.jsonl | tail -20
```

### Harness Not Starting

```bash
# Manual startup test
cd packages/harness
npm run build
node dist/harness.js

# Should print nothing initially (waiting for RPC)
# Send a test call:
echo '{"jsonrpc":"2.0","method":"get_game_state","params":{},"id":1}' | node dist/harness.js

# Should get JSON response with game state
```

### Tool Call Timeout

```bash
# Check harness still running
ps aux | grep "node.*harness"

# Check harness stderr
# Monitor with: tail -f /tmp/harness-*.log

# Check game logic performance
cd packages/harness
npm test  # Verify all tests still pass
```

### Wrong Results

```bash
# Verify determinism with hello world test
cd packages/harness
npm test -- hello-world.test.ts

# Should show 3/3 tests passing
```

---

## Quick Test Command

Run this to verify everything works:

```bash
#!/bin/bash

echo "🧪 Testing Pi-Harness Integration..."

# 1. Verify harness is built
echo "✓ Checking harness build..."
cd packages/harness || exit 1
npm run build > /dev/null 2>&1 || { echo "❌ Build failed"; exit 1; }

# 2. Verify tests pass
echo "✓ Running harness tests..."
npm test > /dev/null 2>&1 || { echo "❌ Tests failed"; exit 1; }

# 3. Test harness directly
echo "✓ Testing harness JSON-RPC..."
echo '{"jsonrpc":"2.0","method":"get_game_state","params":{},"id":1}' | \
  node dist/harness.js > /tmp/harness-test.out 2>&1 &
HARNESS_PID=$!
sleep 1

# Check response
if grep -q '"ok"' /tmp/harness-test.out; then
  echo "✓ Harness JSON-RPC working"
  kill $HARNESS_PID 2>/dev/null
else
  echo "❌ Harness JSON-RPC failed"
  cat /tmp/harness-test.out
  kill $HARNESS_PID 2>/dev/null
  exit 1
fi

# 4. Verify extension file
echo "✓ Checking extension file..."
test -f ../.pi/extensions/kingdomino-harness.ts || { echo "❌ Extension file missing"; exit 1; }

echo ""
echo "✅ All integration tests passed!"
echo ""
echo "Next: Run 'pi' and type /harness-status"
```

Save as `test-pi-integration.sh` and run:

```bash
chmod +x test-pi-integration.sh
./test-pi-integration.sh
```

---

## Report Template

After testing, use this template to report results:

```markdown
## Pi-Harness Integration Test Report

**Date:** [date]
**Tester:** [name]
**Environment:** [OS, Node version, pi version]

### Test Results

| Test | Status | Notes |
|------|--------|-------|
| Test 1: Extension Discovery | ✅/❌ | |
| Test 2: Connection Lifecycle | ✅/❌ | |
| Test 3a: new_game | ✅/❌ | |
| Test 3b: get_game_state | ✅/❌ | |
| Test 3c: auto_play_until | ✅/❌ | |
| Test 3d: snapshot/restore | ✅/❌ | |
| Test 4: E2E Scenario | ✅/❌ | |
| Test 5a: Illegal Move | ✅/❌ | |
| Test 5b: Crash Recovery | ✅/❌ | |
| Test 6: Hot-Reload | ✅/❌ | |
| Test 7: Performance | ✅/❌ | |
| Test 8: Multiple Sessions | ✅/❌ | |
| Test 9: Documentation | ✅/❌ | |

### Summary

- Passed: X/13
- Failed: Y/13
- Issues: [list any problems]
- Recommended Fixes: [suggestions]

### Sign-off

- [ ] All tests passing
- [ ] Documentation accurate
- [ ] Ready for agent use
```

---

## Next Steps

After verifying integration:

1. ✅ **Commit changes:**
   ```bash
   git add .pi/extensions/kingdomino-harness.ts PI_HARNESS_INTEGRATION.md TESTING_PI_INTEGRATION.md
   git commit -m "feat: connect kingdomino harness to pi via MCP extension"
   ```

2. ✅ **Start agent development:**
   ```bash
   pi
   # Now prompt agent with game scenarios
   ```

3. ⏳ **Monitor and refine:**
   - Track tool call performance
   - Add new tools as needed
   - Document agent discoveries

---

**Status:** Integration ready for testing ✅
