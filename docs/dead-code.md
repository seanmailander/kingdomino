# Dead Code Audit

Identified via AST analysis (`ast-grep`) on 2026-04-09. Only non-test, non-story consumers were considered — tests should only use public interfaces, so test-only usage does not justify keeping an export.

**Status**: All safe removals completed. Remaining items are kept intentionally.

---

## Removed

| Item | Commit | Notes |
|------|--------|-------|
| `connection.solo.ts` + test | `8b23312` | `SoloConnection` — zero consumers after `ReadySolo()` removal |
| `ai.player.ts` + test | `285ace3` | `RandomAIPlayer` — replaced by stateless `AIPlayerActor` |
| `startMessage` factory | `ddc64d5` | Only caller was `ConnectionManager.sendStart()` (also removed) |
| 18 `ConnectionManager` methods | `f216743` | Kept only `waitForPick()` and `waitForPlaceOrDiscard()` |
| `GameSession.playerById()` | `cf6425d` | Only consumer was dead `RandomAIPlayer` |

---

## Kept intentionally

| Item | Reason |
|------|--------|
| `GameSession.setPickOrder()` | `@internal` but heavily used as test seam |
| `GameSession.beginRound()` | `@internal` but heavily used as test seam |
| `GameSession.endGame()` | Used by `GameRulesVisualTdd.shared.tsx` (seed-exhaustion callback) |
| `committmentMessage` / `revealMessage` | Used by `TestConnection` (test infrastructure in `kingdomino-protocol`) |

---

## Cross-validation with `dead-code-checker`

`dead-code-checker` (npm) was run both per-package and across all packages (`-f packages`). It uses syntactic analysis within a folder tree, so it **cannot resolve package-name imports** (`kingdomino-engine`, etc.) — most findings in shared packages are false positives for exported constants and functions consumed by other packages. Running cross-package did resolve some intra-monorepo relative imports but did not change the results materially.

---

## Reproducing this audit

Requires `ast-grep` (v0.42+).

### Check if a class method is used outside its own file and tests

```bash
# .ts files
ast-grep run --pattern '$_.<METHOD>($$$)' --lang ts packages/ --json 2>/dev/null \
  | jq -r '.[].file' | grep -v '.test.' | grep -v '<SOURCE_FILE>' | sort -u

# .tsx files (ast-grep treats ts and tsx as separate languages)
ast-grep run --pattern '$_.<METHOD>($$$)' --lang tsx packages/ --json 2>/dev/null \
  | jq -r '.[].file' | grep -v '.test.' | grep -v '.stories.' | sort -u
```

Replace `<METHOD>` with the method name and `<SOURCE_FILE>` with the file that defines it.

### Check optional-chaining calls (`?.method()`)

```bash
ast-grep run --pattern '$_?.<METHOD>($$$)' --lang ts packages/ --json 2>/dev/null \
  | jq -r '.[].file' | grep -v '.test.' | sort -u
```

### Check class/constructor usage

```bash
ast-grep run --pattern 'new <CLASS>($$$)' --lang ts packages/ --json 2>/dev/null \
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
- Run `npm run tscheck --workspaces` after each removal to verify no non-test code broke.
