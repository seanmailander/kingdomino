# Repo audit — Kingdomino

Audited at `72926b4` (findings re-checked against `main` @ `83907ed`; only harness startup + `orca.yaml` changed).
Two findings (#1, #3) were confirmed by running the engine in a throwaway test; the rest come from reading the code.

**What this repo does:** A browser version of the board game Kingdomino. It has a pure game engine, a React client, and a small server that only introduces players to each other (signaling). Games run peer-to-peer over WebRTC.
**Load assumed:** a few players on one local network, one game per browser tab.

---

## Work plan (Orca workspaces + beads)

Every must-fix has its own Orca workspace with `PROBLEM.md` at the root (git-ignored through `.git/info/exclude`).
Tracking lives in **bd** (beads). Run `bd show <id>` for the full description and acceptance criteria.

| # | Must-fix | bd | Orca workspace | Status at hand-off |
|---|----------|----|----------------|--------------------|
| 1 | Game freezes after first move vs AI | `kingdomino-e0k` | `fix-local-actor-stall` | agent started |
| 2 | Online play: moves never sent, seat IDs differ | `kingdomino-7w5` | `fix-remote-move-sync` | **seeded only — blocked by e0k** |
| 3 | Illegal placements accepted | `kingdomino-wwo` | `fix-placement-legality` | agent started |
| 4 | Flip only affects preview | `kingdomino-8uy` | `fix-flip-placement` | agent started |
| 5 | Commitment reflection forces zero seed | `kingdomino-699` | `fix-commitment-reflection` | agent started |
| 6 | Server crash with no IPv6 | `kingdomino-o7m` | `fix-server-ipv6-crash` | agent started |
| 7 | Matchmaking ghosts / hangs | `kingdomino-qcw` | `fix-matchmaking-ghosts` | agent started |

### Why this parallel split

- **Run in parallel now (6):** #1, #3, #4, #5, #6, #7 touch separate code:
  - #1: client UI to actor wiring
  - #3: engine `board.ts`
  - #4: `BoardArea.tsx`
  - #5: the commitment package
  - #6 and #7: different blocks of `server/index.ts`. Expect a small, easy merge.
- **#2 waits for #1.** Both change how local moves flow through actors (#2 must broadcast the moves #1 rewires). Doing them in parallel would cause conflicting designs. Start it when `kingdomino-e0k` closes:
  `orca agent launch --agent pi --worktree name:fix-remote-move-sync --prompt "Read PROBLEM.md and start."`
- **#3 / #4 are related, not blocking.** #4 uses `localValidDirectionsAt`, whose results change with #3. Merge #3 first, then rebase #4 and re-run its stories.
- **Should-fix / lean items are filed in bd without workspaces.** Dependencies are already set: `thg` is blocked by `e0k`, and `977` is blocked by `wwo`.

| # | Item | bd | Priority |
|---|------|----|----------|
| 8 | Pause-menu Exit does nothing | `kingdomino-4ri` | P2 |
| 9 | Second couch player can't move | `kingdomino-thg` | P2 (after e0k) |
| 10 | AI plays while paused | `kingdomino-bq3` | P2 |
| 11 | Matchmaking URLs hard-coded `http://` | `kingdomino-wz2` | P2 |
| 12 | End-to-end tests (real UI path, two peers) | `kingdomino-l34` | P2 |
| 13 | Delete dead harness scripts / dup test | `kingdomino-2kb` | P3 |
| 14 | Dedupe direction tables + flood fill | `kingdomino-977` | P3 (after wwo) |
| 15 | Drop body-parser | `kingdomino-b1y` | P3 |
| 16 | Unused params/methods | `kingdomino-com` | P4 |
| 17 | Harness ignores variant | `kingdomino-v3k` | P4 |

---

## Findings

### Must fix

1. **The game freezes after your first move against an AI** (`client/src/game/visuals/Card.tsx:30`, `BoardArea.tsx:70,124`, `kingdomino-protocol/src/game.driver.ts:74`)
   - **What this is:** `GameDriver` asks each player's actor for its move; for the human it awaits `LocalPlayerActor.awaitPick()`.
   - **Problem:** The UI never resolves that actor; it calls `session.handleLocalPick/Placement/Discard` directly. The driver waits forever, so the AI never moves. Confirmed: 1 pick made, then stuck on "p2 to pick".
   - **Fix:** UI calls `localActor.resolvePick(id)` / `resolvePlacement(...)` (actor from the roster via the store); the driver already applies moves. The story harness (`GameRulesVisualTdd.shared.tsx:446`) already works this way.
   - **If we skip it:** No game against an AI can finish in the real app. Stories pass only because they use the actor path.

2. **Online play cannot work: your own moves are never sent** (`client/src/game/state/default.roster.factory.ts`, `game.flow.ts`)
   - **What this is:** `RemotePlayerActor` waits for PICK/PLACE/DISCARD messages from the other browser.
   - **Problem:** Nothing in the client sends your moves (`pickMessage` etc. are only used in tests). Also each browser numbers players from its own lobby, so "me" is `p1` on both sides and both humans think they go first.
   - **Fix:** Send each local move on `PICK_MADE`/`PLACE_MADE`/`DISCARD_MADE`; derive seat IDs identically on both peers (e.g. sorted peer IDs).
   - **If we skip it:** The "Remote" slot connects, then hangs on the first turn.

3. **Illegal placements are accepted** (`kingdomino-engine/src/gamelogic/board.ts:71-108`)
   - **What this is:** `getEligiblePositions` + `getValidDirections` decide where a domino may go.
   - **Problem:** A spot is legal if it touches *either* terrain of the domino; the engine never checks that the half placed there matches. Confirmed: grain/wood domino, grain half next to wood, wood half touching nothing: accepted. `getValidDirections` ignores its card argument. The discard rule uses the same check.
   - **Fix:** In `getValidDirections`, keep a direction only if half A at (x,y) or half B at (x+dx,y+dy) has a neighbour that is the castle or the same terrain.
   - **If we skip it:** Wrong boards and scores; a remote player can cheat.

4. **"Flip card" only changes the preview** (`client/src/game/visuals/BoardArea.tsx:68-71`)
   - **Problem:** `BoardOverlay` draws the flipped domino; the click handler places it unflipped.
   - **Fix:** Apply `getFlippedPosition(x, y, direction, flipped)` in `handleClick`, as the overlay already does.
   - **If we skip it:** The domino lands differently from what the player saw.

5. **A cheating peer can force a known shuffle** (`kingdomino-commitment/src/CommitmentSeedProvider.ts:19-26`)
   - **Problem:** A peer can echo your commitment, then your secret. Verification passes and XOR of a value with itself is zero, so the cheater knows every future deal.
   - **Fix:** `if (theirCommittment === myCommittment) throw ...` plus a mirrored-transport test.
   - **If we skip it:** The fairness protocol can be beaten.

6. **The server crashes at startup if the network has no IPv6** (`server/index.ts:116-120`)
   - **Problem:** `v6Addresses[0].address` throws on IPv4-only interfaces (Docker, some Wi-Fi). `.pop()` may also pick a VPN/Docker bridge.
   - **Fix:** `v6Addresses[0]?.address`, and omit the AAAA answer when missing.
   - **If we skip it:** No server, no online games on those networks.

7. **Matchmaking pairs you with ghosts and hangs** (`server/index.ts:39-84`, `kingdomino-lobby/src/peer.session.ts:33-39,130-138`)
   - **Problem:** A player who closes the tab while waiting is never removed, so the next player pairs with them. A third player within 5 s of a pairing waits for someone who will never call. `peer-unavailable` fires on the `Peer`, so `connect()` never fails.
   - **Fix:** Track `lastSeen` per poll and skip stale entries; only pair with `WAITING_TO_PAIR`; add timeouts to `connect()` and the inbound wait.
   - **If we skip it:** "Connecting…" spins forever.

### Should fix

8. **Pause-menu Exit does nothing** (`App/GameStore.ts:142-152`, `Game.tsx:28-31`). `triggerExitConfirm` has no real waiter. Fix: `LobbyFlow` awaits `awaitExitConfirm()` and returns to splash on `true`.
9. **Second couch player can never move** (`default.roster.factory.ts:66-67`, `GameSession.isMyTurn`). Only one local ID. Fix: session accepts a set of local IDs.
10. **AI keeps playing while paused** (`game.driver.ts:60-103`). Fix: wait for `GAME_RESUMED` before each actor call when paused.
11. **Matchmaking URLs hard-coded to `http://`** (`peer.session.ts:49,110`). Mixed content under HTTPS. Fix: scheme from `peer.options.secure`.
12. **No test covers the real UI path or a two-browser game.** Add one two-peer `LobbyFlow` test (pattern: `remote.player.actor.test.ts:14`) and one story clicking the real `App`.
13. **Dead files** (lean): five unreferenced harness scripts (~490 lines), `harness/snapshots.ts` + `stateSnapshots` stub, and the duplicate `client/src/game/state/discard-rule.test.ts`. Delete.
14. **The same rules are copied** (lean): direction tables in `Board.ts` and `board.ts`, plus `directionDelta`; `scoreBoard` and `largestRegion` are the same flood fill. One table, one `regions(grid)`.
15. **`body-parser` is not needed** (`server/index.ts:2,11`). Use `express.json()`.

### Nice to have

16. **Unused arguments/methods:** AI `_humanPlayerId` (+ `firstHumanId`), `ConnectionManager`'s `_send`, `FlowAdapter.getPhase`/`oncePhaseIsNot`, no-op `AppFlowAdapter.reset`.
17. **Harness has its own round loop and 5×5-only legality** (`harness/mcp-server.ts:83-95,143-180`). Use `findPlacementWithinBounds` with the session variant.

---

**Verdict:** Fix 1 first (the app cannot finish a game vs AI), then 3 and 4 (wrong rules), then 2, 5, 7 if online play matters.
**Lean:** about −750 lines, −1 dependency possible.
**Not checked:** `chacha-rng` internals (relied on its tests), most of `harness/mcp-server.ts`, visual/CSS components, Storybook config, CI workflows. Full test suite and a real two-browser game were not run.
