### Player-Agnostic GameSession Principle

Update the architecture direction for `GameSession` so it remains player-agnostic.

Design principle:

- `GameSession` is the core engine of the game.
- It should not grant special treatment to a local player or contain local-only codepaths.
- It should behave more like a traditional server-side game engine handling players uniformly.
- The distinction between local and remote interaction should live outside the session core, at the UI and connection boundary.

This means the UI for the human-controlled player should be treated as an interface layered on top of one side of a connection. In solo mode, the other side of that connection can be backed by AI, random behavior, or hardcoded responses. In test mode, the other side should be deterministic and scriptable.

Note for follow-up:

- TODO: gradually remove local-player special treatment from the game-session architecture and isolate it into the UI and connection layers.
- This document does not fully specify the downstream refactor required to remove existing convenience methods and local-player assumptions from `GameSession`.
- In the first implementation phase, the architecture should move in this direction without requiring that full refactor to be completed up front.

### UI Boundaries

Production UI components should not gain Storybook-specific branches.

If a story needs deterministic state, connection mode selection, or scenario scripting, that configuration should live in story support code or connection construction. `Game.tsx`, `Lobby.tsx`, and other visual components should continue rendering based on application state, not story-only flags.

## Test Strategy

### Majority Path: Test Connection Stories

Most rule stories should use `TestConnection` and the real app flow.

These stories should:

- Render the real app or real game surface.
- Use browser interactions only where needed to progress the visible UI.
- Let the test connection simulate the other player.
- Assert visible game outcomes, not internal implementation details.

Examples include:

- turn order from domino selection
- legal placement enforcement
- discard when unplaceable
- final turn behavior
- scoring and ranking presentation

For this phase, these scenarios should remain within the current two-player model already assumed by the game flow and connection layer.

### Remaining Path: Browser-Driven UI Stories

Stories that primarily validate UI orchestration rather than simulated peer play should remain browser-driven.

Examples include:

- lobby start flow
- lobby leave flow
- other direct interaction flows where the point of the test is the web UI itself

These should still use real components and clicks rather than helper shortcuts.

### Brittleness As A Feature

These tests are allowed to be brittle by design.

If a flow breaks because the integrated game no longer proceeds correctly through lobby, connection, pick order, turn sequencing, placement, or scoring, the story should fail. The stories are intended to provide high-friction confirmation that the real game works as a complete user-facing system.

## Error Handling

- Invalid scripted moves from `TestConnection` should fail immediately.
- Missing or inconsistent scenario setup should fail immediately.
- Story helpers should not silently repair broken state.
- Test failures should point toward the broken end-to-end behavior rather than masking it behind abstraction.
- Deterministic handshake values used by `TestConnection` should satisfy the existing trusted-seed flow rather than bypassing it through special-case production code.

## Implementation Notes

- Keep setup helpers small and deterministic.
- Prefer scenario scripts over broad test-only conditionals in production code.
- Reuse the existing `ConnectionManager`, `LobbyFlow`, and store-driven rendering path.
- Prefer using generic player-based session operations in new test orchestration code where practical, even if legacy local-player convenience methods still exist during the transition.
- Where possible, keep assertions at the DOM and visible-state level.
- Use web interactions for the subset of stories where direct UI behavior is the feature under test.

## Open Constraint

This document intentionally does not fully spec out all consequences of making `GameSession` entirely player-agnostic. That change is recorded as a design principle and follow-up note, not as a full refactor plan.
