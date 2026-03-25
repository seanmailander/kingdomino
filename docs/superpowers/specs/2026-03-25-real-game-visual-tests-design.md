# Real Game Visual Tests Design

Date: 2026-03-25

## Goal

Replace the current scaffold-based rule stories with stories that exercise the actual game implementation end to end. The default path for visual rules testing should use a deterministic test connection that simulates both players through the real game flow, while a smaller set of UI-centric stories continues to rely on browser interactions.

## Scope

- Integrate the real game implementation into the existing `*.stories.tsx` rule stories.
- Add a third connection type, `test`, alongside `solo` and `multiplayer`.
- Design most visual rule tests around the `test` connection.
- Keep the initial implementation scoped to the current two-player architecture.
- Keep remaining stories that specifically test UI flows, such as lobby interactions, browser-driven.
- Preserve intentional brittleness in story tests so end-to-end regressions surface quickly.

## Recommended Approach

Use a first-class `TestConnection` as the main seam for visual rule testing.

This connection should satisfy the same connection contract as the existing runtime connections and run through the same top-level flow machinery. Instead of returning a single canned response, it should simulate the opposing player with deterministic scripted moves. Stories should render the real app and real game UI, then verify visible outcomes after the true application flow has run.

This keeps stories honest while still allowing simple setup helpers inside the test connection layer.

## Implementation Prerequisites

The following prerequisites are required before the design can be realized:

1. Refactor `LobbyFlow` so it can start with a selected connection mode or explicit connection instance instead of hardcoding `SoloConnection`.
2. Implement `TestConnection` as a real connection type that satisfies the existing connection contract.
3. Replace the current scaffold-based rule stories with stories that render the real app or real game surface through that flow.

These are not objections to the design. They are the first required implementation tasks implied by the current architecture.

## Architecture

### Connection Model

Add a third connection implementation next to `connection.solo.ts` and `connection.multiplayer.ts`.

`connection.testing.ts` should:

- Implement the same `send`, `waitFor`, and `destroy` shape expected by the current flow.
- Simulate both sides of the game conversation deterministically.
- Accept scenario scripts or helper configuration for predefined picks, placements, and optionally seeds or deck order.
- Fail loudly when a scripted move becomes invalid for the current game state.

Initial API direction:

- Constructor-based configuration is preferred, for example `new TestConnection({ me, them, scenario })`.
- `scenario` should be deterministic and small, with predefined remote picks and placements in turn order.
- If a scenario needs deterministic round order or card order, it may also provide fixed handshake and deck values.
- Invalid or exhausted scenario data should throw immediately rather than silently falling back.

The goal is not to build AI. The goal is to produce deterministic, brittle, end-to-end tests using the real game logic.

### Game Flow Integration

`LobbyFlow` should remain the orchestrator.

Instead of directly assuming `SoloConnection`, it should be refactored to start with a selected connection mode or explicit connection instance. The current code hardcodes `SoloConnection`, so this refactor is a required prerequisite for the rest of the design.

The real app flow should remain:

1. Establish connection.
2. Build shared seed through `ConnectionManager`.
3. Determine pick order.
4. Begin rounds through `GameSession`.
5. Process picks and placements through the real event loop.
6. Re-render through the store and app components.

Stories should rely on this same path so they validate the integrated system rather than isolated helpers.

Story integration note:

- Stories that exercise the full flow will need to cooperate with the app-level store functions used by `LobbyFlow`, including room changes and lobby start/leave signaling.
- The initial implementation may use story support wrappers or controlled test bootstrapping around the existing store contract rather than refactoring the store out of the flow first.

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
