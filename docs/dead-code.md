# Dead Code Audit

Identified via AST analysis (`ast-grep`) on 2026-04-09. Only non-test, non-story consumers were considered — tests should only use public interfaces, so test-only usage does not justify keeping an export.

---

## `kingdomino-protocol`

### `ConnectionManager` — 19 of 21 methods unused

Only `waitForPick()` and `waitForPlaceOrDiscard()` are used (by `RemotePlayerActor`). All other methods were consumed by the old `LobbyFlow.runFlow()` path, now removed.

| Category | Unused methods |
|----------|---------------|
| Send move | `sendStart`, `sendPick`, `sendPlace`, `sendDiscard` |
| Wait move | `waitForPlace`, `waitForDiscard`, `waitForNextMoveMessage` |
| Send control | `sendPauseRequest`, `sendPauseAck`, `sendResumeRequest`, `sendResumeAck`, `sendExitRequest`, `sendExitAck` |
| Wait control | `waitForPauseRequest`, `waitForPauseAck`, `waitForResumeRequest`, `waitForResumeAck`, `waitForExitRequest`, `waitForExitAck` |

### `RandomAIPlayer` — entire class unused

Only consumer is `connection.solo.ts`, which itself has zero non-test consumers after `LobbyFlow.ReadySolo()` was removed. The stateless `AIPlayerActor` in the client replaces it. All 7 public methods are dead: `startGame`, `beginRound`, `receiveHumanMove`, `receiveHumanDiscard`, `generateMove`, `isFirstToAct`, `hasActiveRound`.

### `game.messages.ts` — `startGameMessage` factory unused

Was called by `ConnectionManager.sendStart()`, which is itself unused.

---

## `kingdomino-engine`

### `GameSession` — 3 methods unused

| Method | Notes |
|--------|-------|
| `setPickOrder()` | Only consumer was `RandomAIPlayer` (dead). Session sets pick order internally via `_runGameLoop`. |
| `beginRound()` | Only consumer was `RandomAIPlayer` (dead). Marked `@internal` in architecture docs. |
| `playerById()` | Only consumer was `RandomAIPlayer` (dead). |

`endGame()` is still used by `GameRulesVisualTdd.shared.tsx` (seed-exhaustion callback).

---

## Dead files

| File | Notes |
|------|-------|
| `client/src/game/state/connection.solo.ts` | `SoloConnection` has zero non-test consumers. |
| `kingdomino-protocol/src/ai.player.ts` | `RandomAIPlayer` has zero non-test consumers outside dead `connection.solo.ts`. |

---

## Cross-validation with `dead-code-checker`

`dead-code-checker` (npm) was run both per-package and across all packages (`-f packages`). It uses syntactic analysis within a folder tree, so it **cannot resolve package-name imports** (`kingdomino-engine`, etc.) — most findings in shared packages are false positives for exported constants and functions consumed by other packages. Running cross-package did resolve some intra-monorepo relative imports but did not change the results materially.

New items found only by `dead-code-checker`:

| Item | File | Notes |
|------|------|-------|
| `committmentMessage` | `game.messages.ts` | Factory function, never called. |
| `revealMessage` | `game.messages.ts` | Factory function, never called. |

These were missed by the ast-grep audit because only `ConnectionManager` methods were checked, not the lower-level message factories. Both functions relate to the commitment wire protocol — `CommitmentSeedProvider` uses its own transport layer directly and never goes through these factories.

---

## Reproducing this audit

Requires `ast-grep` (v0.42+).

### Check if a class method is used outside its own file and tests

```bash
# .ts files
ast-grep run --pattern '\$_.<METHOD>(\$\$\$)' --lang ts packages/ --json 2>/dev/null \
  | jq -r '.[].file' | grep -v '.test.' | grep -v '<SOURCE_FILE>' | sort -u

# .tsx files (ast-grep treats ts and tsx as separate languages)
ast-grep run --pattern '\$_.<METHOD>(\$\$\$)' --lang tsx packages/ --json 2>/dev/null \
  | jq -r '.[].file' | grep -v '.test.' | grep -v '.stories.' | sort -u
```

Replace `<METHOD>` with the method name and `<SOURCE_FILE>` with the file that defines it.

### Check optional-chaining calls (`?.method()`)

```bash
ast-grep run --pattern '\$_?.<METHOD>(\$\$\$)' --lang ts packages/ --json 2>/dev/null \
  | jq -r '.[].file' | grep -v '.test.' | sort -u
```

### Check class/constructor usage

```bash
ast-grep run --pattern 'new <CLASS>(\$\$\$)' --lang ts packages/ --json 2>/dev/null \
  | jq -r '.[].file' | grep -v '.test.' | sort -u
```

### Batch-check a list of methods

```bash
for method in methodA methodB methodC; do
  ts=$(ast-grep run --pattern "\$_.$method(\$\$\$)" --lang ts packages/ --json 2>/dev/null \
    | jq -r '.[].file' | grep -v '.test.' | grep -v '<SOURCE_FILE>' | sort -u)
  tsx=$(ast-grep run --pattern "\$_.$method(\$\$\$)" --lang tsx packages/ --json 2>/dev/null \
    | jq -r '.[].file' | grep -v '.test.' | grep -v '.stories.' | sort -u)
  all=$(echo -e "$ts\n$tsx" | grep -v '^$' | sort -u)
  if [ -z "$all" ]; then
    echo "UNUSED: $method"
  else
    echo "USED:   $method -> $(echo $all | tr '\n' ' ')"
  fi
done
```

### Tips

- `$_` matches any single expression (the receiver). `$$$` matches any number of arguments.
- Always scan both `--lang ts` and `--lang tsx` — ast-grep treats them as separate languages.
- Exclude the defining file, test files (`.test.`), and story files (`.stories.`) to find real consumers.
- When a method's only consumer is itself in dead code (e.g. `connection.solo.ts`), add that file to the exclusion list and re-run.
