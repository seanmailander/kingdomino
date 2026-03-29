# Project Context

## What This Is

A browser-based multiplayer **Kingdomino** board game by Bruno Cathala — recreated with a twist:
- Game lobbies are for player discovery only
- All play is **peer-to-peer via WebRTC** (PeerJS)
- Works on local networks without internet connectivity (mDNS discovery)
- Server is signaling-only; all game logic lives in the client

## Tech Stack

**Client** (`packages/client/`) — where all game logic and UI live:
- React 18 + TypeScript 5 + Vite 8
- **State:** alien-signals (`signal` / `computed` / `effect`) — **not Redux**
- **Networking:** PeerJS (WebRTC wrapper) for peer-to-peer play
- **Testing:** Vitest 4 (unit + integration) + Storybook 10 with `@storybook/addon-vitest` (visual TDD)
- **Browser tests:** `@vitest/browser-playwright` (Playwright/Chromium, headless)
- **Linting/formatting:** oxlint + oxfmt (at repo root)

**Server** (`packages/server/`) — minimal signaling only:
- Node.js + Express + PeerJS server + multicast-dns; no real test suite

## Key Directories

| Path | Purpose |
|------|---------|
| `client/src/App/` | React shell: `App.tsx`, `store.ts` (alien-signals state), `AppExtras.ts` (room types) |
| `client/src/game/state/` | OOP game state: `GameSession`, `LobbyFlow`, `ConnectionManager`, `Round`, `Deal`, `Player`, `Board` |
| `client/src/game/gamelogic/` | Pure functions: cards, board scoring, deck operations, cryptographic seed utils |
| `client/src/game/visuals/` | React UI components + Storybook stories for visual TDD |
| `client/src/game/tests/` | Unit tests for game logic |
| `client/.storybook/` | Storybook config (framework: `@storybook/react-vite`, MCP addon enabled) |
| `packages/server/` | Express signaling server + mDNS — no game logic |

## Key Abstractions

- **`IGameConnection`** (in `game.flow.ts`) — the connection interface; three implementations:
  - `SoloConnection` — single-player / self-play
  - `MultiplayerConnection` — WebRTC via PeerJS *(not yet fully wired)*
  - `TestConnection` — scripted deterministic scenarios for unit/integration tests
- **`GameSession`** — OOP session manager with `GameEventBus` for typed pub/sub events (`player:joined`, `game:started`, `round:started`, `pick:made`, `place:made`, `round:complete`, `game:ended`)
- **`LobbyFlow`** — orchestrates the splash → lobby → game → end state machine

## Code Conventions (`packages/client/src/CLAUDE.md`)

- Minimize explicit TypeScript type annotations; prefer inference
- **Named exports only** — no default exports
- One primary responsibility per file
- **OOP (classes)** for game state: sessions, rounds, players, connections, flow orchestration
- **Pure functions** for game logic: card manipulation, board scoring, deck operations, seed calculations

## Test Layout

| Location | What |
|----------|------|
| `client/src/game/tests/*.test.ts` | Unit tests for game logic (scoring, placement, deck, board) |
| `client/src/game/gamelogic/*.test.ts` | Unit tests for pure game logic functions |
| `client/src/game/state/*.test.ts` | Integration/flow tests; use `TestConnection` for scripted scenarios |
| `client/src/game/visuals/*.stories.tsx` | Visual TDD via Storybook — `RealGameRuleHarness` wraps `GameSession` + `TestConnection` |
| `client/src/setupTests.ts` | Test setup — extends Vitest `expect` with `jest-extended` matchers |

**Run all client tests:** `cd client && npm test`
Root `npm test` is a placeholder — **not real validation**.

---

# Agent Process Rules

- Using superpowers skill
- Use red/green TDD
- First run the tests

Startup Baseline

- Root `npm test` is a placeholder echo, not real validation.
- Real baseline tests are in `packages/client/`: run `npm test` there first.
- `client` test baseline: Vitest plus Storybook stories; currently green.
- `server` does not currently have a real test suite.

Game Client Visual TDD Rules

- Always start with Storybook MCP discovery before making UI changes.
- Use list-all-documentation to find valid component IDs.
- Use get-documentation for each impacted component before using props or variants.
- Use get-storybook-story-instructions before creating or editing any story.

Visual Change Workflow (test first)

1. Story first: add or update a story that captures the intended visual/behavior change.
2. Red: add or update play/assertions so the story test fails for the current UI.
3. Green: implement the UI change to make the story test pass.
4. Refactor: clean up while keeping story tests green.

Verification Gates

- Run run-story-tests for impacted stories after each change.
- Re-run until all impacted story tests pass.
- Run a broad run-story-tests pass before final handoff when scope is wide or uncertain.
- Use preview-stories and share the returned preview URLs for visual review.

Quality Guardrails

- Do not invent component props, variants, or IDs. Use only documented APIs.
- If a required component or prop is not documented, report it instead of guessing.
- Do not report completion while story tests are failing.

Bug Logging Rule

- When a bug or issue is noticed during any task — even if unrelated to the current work — immediately log it as a todo in the SQL `todos` table with status `pending`, then **continue the original task without switching focus**.
- Use a descriptive kebab-case ID and enough detail in the description to reproduce and fix the bug later.
- Example: `INSERT INTO todos (id, title, description) VALUES ('bug-scoring-edge-case', 'Fix scoring edge case', 'Score calculation returns wrong value when board has no center tile. Noticed in GameSession.calculateScore().');`
- After the original task is complete, surface any logged bugs to the user so they can be prioritized.

---

# Documentation Map

Use this map to navigate all project documentation without filesystem exploration.

## Top-Level Index
- [`docs/README.md`](docs/README.md) — Hub: links to every doc file in the project

## Code Conventions & Architecture
- [`client/src/CLAUDE.md`](client/src/CLAUDE.md) — TypeScript conventions for client/src (typing, exports, OOP vs pure)
- [`client/src/game/readme.md`](client/src/game/readme.md) — Game module architecture: logic / state / visuals layers and their dependencies
- [`client/src/game/testing.md`](client/src/game/testing.md) — Test plan: 50+ domain-driven scenarios across deck, placement, scoring, rounds

## Client & Server Setup
- [`client/README.md`](client/README.md) — Dev scripts: start, build, test, preview
- [`server/README.md`](server/README.md) — Signaling server: purpose, scripts, key files

## Agent Skills
- [`.agents/skills/README.md`](.agents/skills/README.md) — Index of all skills with when-to-invoke summaries and workflow

## Design History
- [`docs/superpowers/README.md`](docs/superpowers/README.md) — Index of all specs and implementation plans with status
