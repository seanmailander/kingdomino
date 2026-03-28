# Superpowers Specs & Plans

Design specs live in `docs/superpowers/specs/`.  
Implementation plans live in `docs/superpowers/plans/`.

Specs are written by the `brainstorming` skill. Plans are written by the `writing-plans` skill.

---

## Design Specs

| File | Topic | Status |
|------|-------|--------|
| [2026-03-25-real-game-visual-tests-design.md](specs/2026-03-25-real-game-visual-tests-design.md) | Player-agnostic GameSession architecture and visual test boundaries | design-only |
| [2026-03-26-discard-protocol-design.md](specs/2026-03-26-discard-protocol-design.md) | Fix discard deadlock in flow and peer protocol | approved |
| [2026-03-26-single-player-ai-design.md](specs/2026-03-26-single-player-ai-design.md) | RandomAIPlayer with mirrored GameSession | approved |
| [2026-03-27-full-game-loop-menu-start-pause-exit-design.md](specs/2026-03-27-full-game-loop-menu-start-pause-exit-design.md) | Complete game loop with menu, start, pause, exit states | draft |
| [2026-03-28-solo-game-story-e2e-refactor-design.md](specs/2026-03-28-solo-game-story-e2e-refactor-design.md) | Refactor SoloGameVisualTdd to pure App/UI e2e story | planned |

---

## Implementation Plans

| File | Topic | Status |
|------|-------|--------|
| [2026-03-27-single-player-ai.md](plans/2026-03-27-single-player-ai.md) | Implement RandomAIPlayer with independent session | planned |
| [2026-03-27-full-game-loop-menu-start-pause-exit.md](plans/2026-03-27-full-game-loop-menu-start-pause-exit.md) | Implement complete game loop with pause/resume | planned |
| [2026-03-28-decouple-game-layers.md](plans/2026-03-28-decouple-game-layers.md) | Remove coupling violations between game logic, state, and UI layers | planned |
| [2026-03-28-docs-consolidation.md](plans/2026-03-28-docs-consolidation.md) | Add index files and cross-references for documentation discovery | in-progress |
| [2026-03-28-solo-game-story-e2e-refactor.md](plans/2026-03-28-solo-game-story-e2e-refactor.md) | Replace harness-based story with pure App e2e rendering | planned |
