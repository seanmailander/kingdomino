# Dead Code Audit

Identified via AST analysis (`ast-grep`) on 2026-04-09. Only non-test, non-story consumers were considered — tests should only use public interfaces, so test-only usage does not justify keeping an export.

---

## Completed removals

| Item | Commit | Notes |
|------|--------|-------|
| `connection.solo.ts` + test | `8b23312` | `SoloConnection` — zero consumers after `ReadySolo()` removal |
| `ai.player.ts` + test | `285ace3` | `RandomAIPlayer` — replaced by stateless `AIPlayerActor` |
| `startMessage` factory | `ddc64d5` | Only caller was `ConnectionManager.sendStart()` (also removed) |
| 18 `ConnectionManager` methods | `f216743` | Kept only `waitForPick()` and `waitForPlaceOrDiscard()` |
| `GameSession.playerById()` | `cf6425d` | Only consumer was dead `RandomAIPlayer` |

---

## Current findings

### `kingdomino-protocol` — message factories are test-only

All 11 remaining factory functions in `game.messages.ts` have no production consumers. They are used only by `TestConnection` (`connection.testing.ts`) and `game.messages.control.test.ts`.

| Factory | Test consumers |
|---------|----------------|
| `pickMessage`, `placeMessage`, `discardMessage` | `connection.testing.ts` |
| `committmentMessage`, `revealMessage` | `connection.testing.ts` |
| `pauseRequestMessage`, `pauseAckMessage`, `resumeRequestMessage`, `resumeAckMessage`, `exitRequestMessage`, `exitAckMessage` | `connection.testing.ts`, `game.messages.control.test.ts` |

Not dead code — they serve test infrastructure. But no production code depends on them.

### `kingdomino-engine` — over-exported internal functions

These are used internally within `kingdomino-engine` but have no external consumers. They are needlessly exported via `export *` from `index.ts`. Could be un-exported (made module-private) to shrink the public API surface.

| Function | Defined in | Internal consumer |
|----------|-----------|-------------------|
| `tileIsValid` | `board.ts` | `board.ts` |
| `getNeighbors` | `board.ts` | `board.ts` |
| `staysWithinBounds` | `board.ts` | `board.ts` |
| `findPlacementWithinBounds` | `board.ts` | `board.ts` |
| `seedStringToBytes` | `utils.ts` | `utils.ts` |
| `seededShuffle` | `utils.ts` | `utils.ts` |
| `getTile` | `cards.ts` | `cards.ts` |
| `generateCardMap` | `cards.ts` | `cards.ts` |
| `noCrown`, `oneCrown`, `twoCrown`, `threeCrown` | `cards.ts` | `cards.ts` |

### Kept intentionally

| Item | Reason |
|------|--------|
| `GameSession.setPickOrder()` | `@internal` but heavily used as test seam |
| `GameSession.beginRound()` | `@internal` but heavily used as test seam |
| `GameSession.endGame()` | Used by `GameRulesVisualTdd.shared.tsx` (seed-exhaustion callback) |
| `TestConnection` | Test infrastructure exported from `kingdomino-protocol` for use by client tests/stories |

---

## Reproducing this audit

Requires `ast-grep` (v0.42+) and `jq`.

### Full re-audit script

Run from the repo root:

```bash
#!/usr/bin/env bash
# Dead code audit for kingdomino-* packages
# Checks all public methods/functions/classes for non-test, non-story consumers

set -euo pipefail

check_method() {
  local method=$1 exclude_file=$2
  local ts tsx ts2 tsx2 all
  ts=$(ast-grep run --pattern "\$_.$method(\$\$\$)" --lang ts packages/ --json 2>/dev/null \
    | jq -r '.[].file' | grep -v '.test.' | grep -v "$exclude_file" | sort -u)
  tsx=$(ast-grep run --pattern "\$_.$method(\$\$\$)" --lang tsx packages/ --json 2>/dev/null \
    | jq -r '.[].file' | grep -v '.test.' | grep -v '.stories.' | sort -u)
  ts2=$(ast-grep run --pattern "\$_?.$method(\$\$\$)" --lang ts packages/ --json 2>/dev/null \
    | jq -r '.[].file' | grep -v '.test.' | grep -v "$exclude_file" | sort -u)
  tsx2=$(ast-grep run --pattern "\$_?.$method(\$\$\$)" --lang tsx packages/ --json 2>/dev/null \
    | jq -r '.[].file' | grep -v '.test.' | grep -v '.stories.' | sort -u)
  all=$(echo -e "$ts\n$tsx\n$ts2\n$tsx2" | grep -v '^$' | sort -u)
  if [ -z "$all" ]; then echo "UNUSED: $method"; else echo "USED:   $method -> $(echo $all | tr '\n' ' ')"; fi
}

check_fn() {
  local fn=$1 exclude_file=$2
  local ts tsx all
  ts=$(ast-grep run --pattern "$fn(\$\$\$)" --lang ts packages/ --json 2>/dev/null \
    | jq -r '.[].file' | grep -v '.test.' | grep -v "$exclude_file" | sort -u)
  tsx=$(ast-grep run --pattern "$fn(\$\$\$)" --lang tsx packages/ --json 2>/dev/null \
    | jq -r '.[].file' | grep -v '.test.' | grep -v '.stories.' | sort -u)
  all=$(echo -e "$ts\n$tsx" | grep -v '^$' | sort -u)
  if [ -z "$all" ]; then echo "UNUSED: $fn"; else echo "USED:   $fn -> $(echo $all | tr '\n' ' ')"; fi
}

check_class() {
  local cls=$1
  local ts tsx all
  ts=$(ast-grep run --pattern "$cls" --lang ts packages/ --json 2>/dev/null \
    | jq -r '.[].file' | grep -v '.test.' | grep -v '.stories.' | grep -v 'index.ts' | sort -u)
  tsx=$(ast-grep run --pattern "$cls" --lang tsx packages/ --json 2>/dev/null \
    | jq -r '.[].file' | grep -v '.test.' | grep -v '.stories.' | sort -u)
  all=$(echo -e "$ts\n$tsx" | grep -v '^$' | sort -u)
  if [ -z "$all" ]; then echo "UNUSED: $cls"; else echo "USED:   $cls -> $(echo $all | tr '\n' ' ')"; fi
}

echo "=== ConnectionManager methods ==="
for m in waitForPick waitForPlaceOrDiscard; do check_method $m ConnectionManager.ts; done

echo ""
echo "=== GameSession methods ==="
for m in addPlayer startGame setPickOrder beginRound handlePick handleLocalPick \
  handlePlacement handleLocalPlacement handleDiscard handleLocalDiscard \
  pause resume endGame myPlayer hasEnoughPlayers isMyTurn isMyPlace \
  localCardToPlace localEligiblePositions localValidDirectionsAt \
  hasLocalValidPlacement deal boardFor; do
  check_method $m GameSession.ts
done

echo ""
echo "=== GameDriver ==="
check_method driveUntilEnd game.driver.ts

echo ""
echo "=== game.messages.ts factories ==="
for fn in pickMessage placeMessage discardMessage committmentMessage revealMessage \
  pauseRequestMessage pauseAckMessage resumeRequestMessage resumeAckMessage \
  exitRequestMessage exitAckMessage; do
  check_fn $fn game.messages.ts
done

echo ""
echo "=== kingdomino-engine gamelogic exports ==="
for fn in getEmptyBoard getFlippedPosition tileIsValid isWithinBounds getNeighbors \
  getEligiblePositions getValidDirections staysWithinBounds staysWithin5x5 staysWithin7x7 \
  findPlacementWithin5x5 findPlacementWithin7x7 findPlacementWithinBounds \
  scoreBoard largestRegion totalCrowns isCastleCentered; do
  check_fn $fn board.ts
done
for fn in seedStringToBytes seededShuffle hashIt commit verify combine \
  getNextFourCards chooseOrderFromSeed; do
  check_fn $fn utils.ts
done
for fn in getTile generateCardMap generateDeck getCard; do
  check_fn $fn cards.ts
done
check_fn determineWinners winners.ts

echo ""
echo "=== Classes ==="
for cls in RemotePlayerActor MultiplayerConnection TestConnection \
  CommitmentSeedProvider RandomSeedProvider PeerSession \
  LobbyFlow AppFlowAdapter LocalPlayerActor CouchPlayerActor \
  AIPlayerActor DefaultRosterFactory GameDriver; do
  check_class $cls
done
```

### Tips

- `$_` matches any single expression (the receiver). `$$$` matches any number of arguments.
- Always scan both `--lang ts` and `--lang tsx` — ast-grep treats them as separate languages.
- Exclude the defining file, test files (`.test.`), and story files (`.stories.`) to find real consumers.
- When a method's only consumer is itself in dead code, add that file to the exclusion list and re-run.
- Run `npm run tscheck --workspaces` after each removal to verify no non-test code broke.
- `dead-code-checker` (npm, `-f packages`) can cross-check but cannot resolve package-name imports — expect many false positives in shared packages.
