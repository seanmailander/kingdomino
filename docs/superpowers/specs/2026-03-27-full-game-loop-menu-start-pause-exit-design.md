# Full Game Loop Design (Menu, Start, Pause, Exit)

Date: 2026-03-27
Status: Draft for implementation planning
Decision: Approach A (Explicit room-state machine + control protocol)

## Goals

- Deliver a full game loop with explicit menu, start, pause, and exit states.
- Support synchronized pause/resume across peers.
- Require confirmation before exiting an in-progress game.
- Enforce strict pause lock: while paused, only Resume and Exit are allowed.

## Constraints

- Game play remains peer-to-peer via existing connection abstractions.
- Flow authority should stay in the app/game flow layer, not scattered across UI.
- Safe teardown is preferred over ambiguous partial states when connectivity fails.

## Architecture

Introduce an authoritative app-flow state machine with these top-level states:

1. Menu
2. Lobby
3. GameActive
4. GamePaused
5. GameEnded

Rules:

1. Gameplay actions are legal only in GameActive.
2. GamePaused hard-locks gameplay and allows only Resume and Exit.
3. Pause/resume transitions are synchronized with protocol handshake.
4. Exit from in-progress game always uses local confirm before protocol exit.
5. Any control-path protocol failure resolves to safe teardown to Menu.

Boundaries:

- Flow/state machine: transition legality and orchestration.
- Session/round logic: game rules only.
- UI: render current state and dispatch user intents.
- Connection layer: transport typed control messages only.

## Components and Module Changes

### App room model

- Extend room model to include Menu, GamePaused, GameEnded.
- Keep state-driven hint text for active/paused/ended modes.

### Store control state and intents

Add signal-backed control state:

- room (authoritative UI state)
- controlPending (none | pause | resume | exit)
- pauseRequester (local | remote | null)

Add intent resolver pairs, mirroring existing lobby start/leave style:

- awaitPauseIntent / triggerPauseIntent
- awaitResumeIntent / triggerResumeIntent
- awaitExitIntent / triggerExitIntent
- awaitExitConfirm / triggerExitConfirm

### Protocol messages

Add typed control messages:

- control:pause-request
- control:pause-ack
- control:resume-request
- control:resume-ack
- control:exit-request
- control:exit-ack

### ConnectionManager

Add control wrappers to send/wait for control messages and shared timeout constants.

### Flow orchestration

Make flow the transition authority:

- Menu -> Lobby -> GameActive
- GameActive <-> GamePaused
- GameActive/GamePaused -> GameEnded -> Menu

Integrate pause/resume/exit handshake orchestration and legal transition checks.

### UI

- Splash acts as menu entry point.
- Game adds pause action and paused overlay mode.
- Add PauseOverlay and ExitConfirmDialog components.
- Block gameplay controls in any state other than GameActive.

### Test scaffolds

- Extend TestConnection and flow integration scripts for deterministic control-message tests.
- Add visual stories for paused and exit-confirm states.

## Data Flow

### Start

1. Menu action triggers flow readiness.
2. Flow creates session and connection; transition to Lobby.
3. Start handshake succeeds; transition to GameActive.

### Pause

1. Local pause intent in GameActive sets controlPending=pause and sends pause-request.
2. Remote validates request in GameActive and returns pause-ack.
3. On ack, both peers transition to GamePaused.
4. Gameplay input is locked on both peers.

### Resume

1. In GamePaused, either peer sends resume-request.
2. Remote returns resume-ack.
3. On ack, both peers transition to GameActive.
4. Round loop continues from suspended state.

### Exit

1. In GamePaused, Exit opens local confirm dialog.
2. Cancel keeps GamePaused and sends no network message.
3. Confirm sends exit-request.
4. Peer returns exit-ack and also enters cleanup.
5. Both teardown session/connection and return to Menu.

### Incoming remote control intents

- Remote pause/resume/exit events are handled by flow whether local user is idle or mid-dialog.
- Remote exit overrides local dialog state and proceeds to teardown.

### Fallback behavior

- Handshake timeout or disconnect in control path triggers deterministic teardown to Menu.
- No half-paused or half-exited state is allowed.

## Error Handling

### Transition validation

- Validate each incoming control message against current state.
- Handle duplicate or stale messages idempotently where possible.

### Timeouts

- Use bounded waits for control acknowledgements.
- On timeout: clear pending control, emit user hint, teardown to Menu.

### Transport failures

- Any control send/wait transport failure is terminal for current session.
- Cleanup must be idempotent and safe on repeated invocation.

### Races

- Concurrent pause requests: deterministic tie-break or idempotent dual-ack handling.
- Exit has priority over pause/resume in conflicting races.

### UI consistency

- Disable controls while controlPending is set.
- Auto-close confirm dialogs on remote exit/disconnect.

## Testing Plan

### Unit

- Transition-table legality and illegal transition rejection.
- Idempotence for duplicate control messages.

### Integration (flow + protocol)

- Local pause request + remote ack => both paused.
- Remote pause request => local paused + ack sent.
- Resume handshake success path.
- Exit confirm accept => teardown + Menu.
- Exit confirm cancel => remain paused.
- Timeout/disconnect during pending control => safe teardown.

### Interaction guards

- While paused, pick/place/keyboard gameplay handlers are blocked.
- Resume/Exit remain active.

### Store behavior

- New control resolver queues behave like existing lobby resolver queues.
- App reset clears all control resolvers and pending control state.

### Visual TDD (Storybook)

- GameActive story with pause control visible.
- GamePaused story with Resume/Exit only.
- Exit confirm dialog story.
- Story play assertions confirm locked gameplay controls while paused.

## Non-Goals (for this design)

- Multiplayer transport rewiring beyond typed control messages.
- New gameplay rules unrelated to pause/exit control loop.
- Cosmetic redesign beyond necessary paused/confirm UI states.

## Risks and Mitigations

- Risk: state drift across peers during races.
  - Mitigation: centralized transition legality + idempotent handlers + exit-priority rule.
- Risk: dangling pending resolvers causing stale UI behavior.
  - Mitigation: reset and cleanup routines clear all resolver queues.
- Risk: control-path hangs.
  - Mitigation: explicit handshake timeouts and deterministic fallback.

## Acceptance Criteria

1. App can run complete loop: Menu -> Lobby -> GameActive -> GamePaused -> GameActive -> GameEnded -> Menu.
2. Pause/resume transitions are synchronized across peers.
3. Exit from paused state requires confirmation and exits both peers cleanly.
4. Gameplay input is blocked while paused.
5. Timeout/disconnect in control path never leaves ambiguous state.
6. New unit/integration/story tests pass for impacted areas.
