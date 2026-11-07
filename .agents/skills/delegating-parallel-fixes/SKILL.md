---
name: delegating-parallel-fixes
description: Use when a list of independent fixes (audit findings, bug batch, review items) should be handed to parallel agents, one Orca workspace each, tracked in bd
---

# Delegating Parallel Fixes

Turn a list of problems into: one bd issue each → one Orca workspace each, seeded with `PROBLEM.md` → agents started on the unblocked ones.
Full worked example: `docs/audits/repo-audit.md` (7 must-fix items, 6 launched, 1 blocked).

## Steps

1. **Check existing issues first.** Run `bd list`, which may already have the bug. Reuse it with `bd update <id> --append-notes "..."`. `bd update` has no `--silent` flag.
2. **Confirm findings still hold on `main`.** New workspaces branch from `origin/main`, not from your branch:
   `git fetch -q && git diff --stat HEAD origin/main`.
3. **Plan what runs in parallel.** Decide before you create anything:
   - Two fixes change the same flow or design (e.g. how moves reach actors): **block** the later one with `--deps blocked-by:<id>`. Seed its workspace, but do not start an agent.
   - Two fixes touch the same file in different blocks: run them in parallel. Tell each to keep its diff to its own block.
   - The result of one fix changes the other's behaviour: run in parallel, but write down the merge order (`--note`).
4. **File one bd issue per fix.** Put a self-contained description in it: file:line, how to reproduce, the fix, and the acceptance test. The agent only sees this text.
   ```bash
   bd create --silent -t bug -p P1 -l audit --title "..." -d "..." [--deps blocked-by:<id>]
   ```
   File should-fix and lean items in bd too, without workspaces (P2–P4).
5. **Create and seed the workspaces.** Run this from inside an Orca worktree of this repo:
   ```bash
   S=.agents/skills/delegating-parallel-fixes/seed-workspace.sh
   $S fix-foo kingdomino-abc --launch
   $S fix-bar kingdomino-def --blocked-by kingdomino-abc          # seeded, status todo, no agent
   $S fix-baz kingdomino-ghi --launch --note "Merge after fix-foo; rebase and re-run stories."
   ```
   Each one takes about a minute, because Orca's setup hook runs `npm install`.
6. **Write the summary file:** findings, a table of workspace / bd id / state, the parallel reasoning, and the command that starts each blocked item later:
   ```bash
   orca agent launch --agent pi --worktree name:<ws> --prompt "Read PROBLEM.md in this workspace root and fix that one issue, following its 'How to work' steps and AGENTS.md. Stay in scope."
   ```
7. **Commit the summary, push, and run `bd dolt push`.**

## Gotchas

- `orca` is at `/Applications/Orca.app/Contents/Resources/bin/orca`. Run `orca skills get orca-cli` for the full reference. Use `--json`.
- Do **not** use `orca orchestration task-create` or `dispatch` for hand-offs. Those are for supervised runs where results come back to you.
- `PROBLEM.md` is kept out of git through `$(git rev-parse --git-common-dir)/info/exclude`, which every worktree shares. The script handles this.
- Setup dirties `package-lock.json` in every new worktree (`kingdomino-5e7`). Agents must not commit it. It also blocks `git pull --rebase` until it is stashed.
- Watch progress with `orca worktree ps --json`, or read a terminal with `orca terminal read --terminal <handle> --json`.
