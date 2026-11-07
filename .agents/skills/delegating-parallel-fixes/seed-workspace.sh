#!/usr/bin/env bash
# Create one Orca workspace for one bd issue, seed it with PROBLEM.md, optionally start an agent.
# Usage: seed-workspace.sh <workspace-name> <bd-id> [--launch] [--blocked-by <bd-id>] [--note "<text>"]
# Run from inside any Orca-managed worktree of this repo (the new workspace becomes its child).
set -euo pipefail

name=$1 id=$2; shift 2
launch=0 blocker="" note=""
while [ $# -gt 0 ]; do
  case $1 in
    --launch) launch=1 ;;
    --blocked-by) blocker=$2; shift ;;
    --note) note=$2; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

here=$(git rev-parse --show-toplevel)
common=$(git rev-parse --git-common-dir)
grep -qx PROBLEM.md "$common/info/exclude" || echo PROBLEM.md >> "$common/info/exclude"

bd show "$id" >/dev/null # fail fast on a bad id

comment="bd $id${blocker:+ · BLOCKED by $blocker}"
path=$(orca worktree create --name "$name" --parent-worktree active --comment "$comment" --json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.ok){console.error(s);process.exit(1)}console.log(j.result.worktree.path)})')

{
  echo "# $name — bd \`$id\`"; echo
  echo '```'; (cd "$here" && bd show "$id"); echo '```'; echo
  [ -n "$blocker" ] && { echo "> **BLOCKED** by \`$blocker\`. Do not start until it is merged; then rebase on main."; echo; }
  [ -n "$note" ] && { echo "> $note"; echo; }
  cat <<EOF
## How to work

1. Follow \`AGENTS.md\`. Claim: \`bd update $id --claim\`.
2. Green baseline first: \`cd packages/client && npm test\` (plus tests of the package you touch).
3. Red/green TDD from the acceptance criteria; smallest fix at the root cause.
4. UI changes follow the Storybook visual-TDD workflow in \`AGENTS.md\`.
5. Unrelated bugs → new bd issue; do not widen scope. Do not commit \`package-lock.json\` churn from setup.
6. When green: commit, push, open a PR referencing \`$id\`, \`bd close $id\`,
   \`orca worktree set --worktree active --comment "..." --workspace-status in-review\`.

This file is git-ignored; do not commit it.
EOF
} > "$path/PROBLEM.md"

if [ -n "$blocker" ]; then
  orca worktree set --worktree "name:$name" --workspace-status todo --json >/dev/null
elif [ "$launch" = 1 ]; then
  orca agent launch --agent pi --worktree "name:$name" \
    --prompt "Read PROBLEM.md in this workspace root and fix that one issue, following its 'How to work' steps and AGENTS.md. Stay in scope." \
    --json | grep -E '"handle"|"outcome": "' || true
fi
echo "$path"
