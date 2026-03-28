# Full Game Loop (Menu, Start, Pause, Exit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete client game loop with explicit menu/start/pause/exit states, synchronized pause/resume handshakes, and confirm-before-exit behavior.

**Architecture:** Extend the existing flow-first orchestration by introducing explicit room/control states in app store + typed control protocol messages in the game transport layer. Keep game rule logic inside `GameSession`/`Round`, while making `LobbyFlow` the single transition authority for pause/resume/exit. Enforce strict paused interaction lock by gating gameplay handlers outside `GameActive`.

**Tech Stack:** React 18 + TypeScript 5, alien-signals state, Vitest 4, Storybook 10 visual tests.

---

## File Structure (Planned Changes)

- Modify: `client/src/App/AppExtras.ts`
  - Add new room constants/types (`Menu`, `GamePaused`, `GameEnded`) and hint logic.
- Modify: `client/src/App/store.ts`
  - Add control intent resolver queues and pending control signal state.
- Create: `client/src/App/store.control.test.ts`
  - Unit tests for new resolver/pending-control lifecycle behavior.
- Modify: `client/src/game/state/game.messages.ts`
  - Add typed control message constants, types, payload extraction, and constructors.
- Create: `client/src/game/state/game.messages.control.test.ts`
  - Unit tests validating control message constructors and payload typing behavior.
- Modify: `client/src/game/state/ConnectionManager.ts`
  - Add send/wait helpers for pause/resume/exit control messages + timeout helper.
- Modify: `client/src/game/state/game.flow.ts`
  - Implement authoritative state machine transitions and control handshake orchestration.
- Modify: `client/src/game/state/game.flow.test.ts`
  - Add integration tests for pause/resume/exit happy paths and timeout/disconnect fallback.
- Modify: `client/src/game/state/connection.testing.ts`
  - Extend scripted transport to support control messages in deterministic tests.
- Modify: `client/src/game/visuals/Game.tsx`
  - Add pause action and paused/confirm UI mounting points.
- Create: `client/src/game/visuals/PauseOverlay.tsx`
  - Render pause state controls (Resume, Exit).
- Create: `client/src/game/visuals/ExitConfirmDialog.tsx`
  - Render confirm/cancel UI for exit.
- Modify: `client/src/game/visuals/Card.tsx`
  - Guard pick interaction when room/control state is not active.
- Modify: `client/src/game/visuals/BoardArea.tsx`
  - Guard placement interaction when room/control state is not active.
- Modify: `client/src/game/visuals/useKeyPress.ts`
  - Ignore gameplay key handlers while paused or control is pending.
- Create: `client/src/game/visuals/GamePauseControls.test.tsx`
  - Component interaction tests for pause lock + exit confirm behavior.
- Modify: `client/src/game/visuals/PlayRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/GameRulesVisualTdd.shared.tsx`
- Add focused visual states for paused and exit-confirm behavior.
- Modify: `README.md`
  - Move or mark the TODO item as addressed after implementation (no behavior change).

### Task 1: Room and Store Control State

**Files:**

- Modify: `client/src/App/AppExtras.ts`
- Modify: `client/src/App/store.ts`
- Test: `client/src/App/store.control.test.ts`

- [ ] **Step 1: Write failing store control-state tests**

```ts
import { describe, expect, it } from "vitest";
import {
  awaitPauseIntent,
  triggerPauseIntent,
  awaitExitConfirm,
  triggerExitConfirm,
  resetAppState,
} from "./store";

describe("store control intents", () => {
  it("resolves pause waiters when pause is triggered", async () => {
    const waiter = awaitPauseIntent();
    triggerPauseIntent();
    await expect(waiter).resolves.toBeUndefined();
  });

  it("clears pending waiters on reset", async () => {
    const waiter = awaitExitConfirm();
    resetAppState();
    triggerExitConfirm(true);
    await expect(waiter).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/App/store.control.test.ts`
Expected: FAIL because new store exports and behavior do not exist.

- [ ] **Step 3: Implement minimal store + room model changes**

```ts
export const Menu = "Menu" as const;
export const GamePaused = "GamePaused" as const;
export const GameEnded = "GameEnded" as const;

type ControlPending = "none" | "pause" | "resume" | "exit";
const controlPendingSignal = signal<ControlPending>("none");

export const awaitPauseIntent = () =>
  new Promise<void>((resolve) => {
    pauseResolvers.push(resolve);
  });
```

- [ ] **Step 4: Run targeted tests and type-check**

Run: `cd client && npm test -- src/App/store.control.test.ts`
Expected: PASS.

Run: `cd client && npm run tscheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/App/AppExtras.ts client/src/App/store.ts client/src/App/store.control.test.ts
git commit -m "feat(app): add menu/paused room state and control intent store APIs"
```

### Task 2: Typed Control Protocol Messages

**Files:**

- Modify: `client/src/game/state/game.messages.ts`
- Test: `client/src/game/state/game.messages.control.test.ts`

- [ ] **Step 1: Write failing protocol message tests**

```ts
import { describe, expect, it } from "vitest";
import {
  PAUSE_REQUEST,
  PAUSE_ACK,
  RESUME_REQUEST,
  RESUME_ACK,
  EXIT_REQUEST,
  EXIT_ACK,
  pauseRequestMessage,
  pauseAckMessage,
  resumeRequestMessage,
  resumeAckMessage,
  exitRequestMessage,
  exitAckMessage,
} from "./game.messages";

describe("control game messages", () => {
  it("creates pause request message", () => {
    expect(pauseRequestMessage()).toEqual({ type: PAUSE_REQUEST });
  });

  it("creates pause ack message", () => {
    expect(pauseAckMessage()).toEqual({ type: PAUSE_ACK });
  });

  it("creates resume request message", () => {
    expect(resumeRequestMessage()).toEqual({ type: RESUME_REQUEST });
  });

  it("creates resume ack message", () => {
    expect(resumeAckMessage()).toEqual({ type: RESUME_ACK });
  });

  it("creates exit request message", () => {
    expect(exitRequestMessage()).toEqual({ type: EXIT_REQUEST });
  });

  it("creates exit ack message", () => {
    expect(exitAckMessage()).toEqual({ type: EXIT_ACK });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/game/state/game.messages.control.test.ts`
Expected: FAIL due to missing message constants/builders.

- [ ] **Step 3: Implement minimal control message types and constructors**

```ts
export const PAUSE_REQUEST = "CONTROL_PAUSE_REQUEST";
export const PAUSE_ACK = "CONTROL_PAUSE_ACK";
export const RESUME_REQUEST = "CONTROL_RESUME_REQUEST";
export const RESUME_ACK = "CONTROL_RESUME_ACK";
export const EXIT_REQUEST = "CONTROL_EXIT_REQUEST";
export const EXIT_ACK = "CONTROL_EXIT_ACK";

export type PauseRequestMessage = { type: typeof PAUSE_REQUEST };
export const pauseRequestMessage = (): PauseRequestMessage => ({ type: PAUSE_REQUEST });

export type PauseAckMessage = { type: typeof PAUSE_ACK };
export const pauseAckMessage = (): PauseAckMessage => ({ type: PAUSE_ACK });

export type ResumeRequestMessage = { type: typeof RESUME_REQUEST };
export const resumeRequestMessage = (): ResumeRequestMessage => ({ type: RESUME_REQUEST });

export type ResumeAckMessage = { type: typeof RESUME_ACK };
export const resumeAckMessage = (): ResumeAckMessage => ({ type: RESUME_ACK });

export type ExitRequestMessage = { type: typeof EXIT_REQUEST };
export const exitRequestMessage = (): ExitRequestMessage => ({ type: EXIT_REQUEST });

export type ExitAckMessage = { type: typeof EXIT_ACK };
export const exitAckMessage = (): ExitAckMessage => ({ type: EXIT_ACK });
```

- [ ] **Step 4: Run protocol tests**

Run: `cd client && npm test -- src/game/state/game.messages.control.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/game/state/game.messages.ts client/src/game/state/game.messages.control.test.ts
git commit -m "feat(protocol): add typed pause/resume/exit control messages"
```

### Task 3: ConnectionManager + Flow Control Handshakes

**Files:**

- Modify: `client/src/game/state/ConnectionManager.ts`
- Modify: `client/src/game/state/game.flow.ts`
- Modify: `client/src/game/state/game.flow.test.ts`
- Modify: `client/src/game/state/connection.testing.ts`

- [ ] **Step 1: Write failing flow integration tests for pause/resume/exit**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { LobbyFlow } from "./game.flow";
import { getRoom, setCurrentSession, setRoom, triggerLobbyLeave } from "../../App/store";
import { Splash, Lobby, GamePaused } from "../../App/AppExtras";

describe("LobbyFlow control transitions", () => {
  afterEach(async () => {
    triggerLobbyLeave();
    await vi.waitFor(() => expect(getRoom()).toBe(Splash));
  });

it("enters paused state after pause request/ack handshake", async () => {
  // setup flow + scripted connection
  const flow = new LobbyFlow();
  setCurrentSession(null);
  setRoom(Splash);
  // ready flow, start lobby, trigger start, then trigger pause intent
  // trigger pause intent
  await vi.waitFor(() => expect(getRoom()).toBe(GamePaused));
});

it("handles duplicate pause messages idempotently", async () => {
  // script remote to emit pause-request twice
  // assert single stable transition to GamePaused and no throw
  await vi.waitFor(() => expect(getRoom()).toBe(GamePaused));
});

it("resolves concurrent pause requests deterministically", async () => {
  // while local pause pending, emit remote pause-request
  // assert both peers converge to GamePaused
  await vi.waitFor(() => expect(getRoom()).toBe(GamePaused));
});

it("prioritizes exit over resume in race", async () => {
  // from GamePaused, trigger local resume intent then remote exit-request
  // assert transition goes to Menu teardown path
  await vi.waitFor(() => expect(getRoom()).toBe(Splash));
});

it("returns to Menu on control handshake timeout", async () => {
  // setup flow with non-responding control peer
  // trigger pause intent
  // assert room resets to Menu
  await vi.waitFor(() => expect(getRoom()).toBe(Splash));
});

it("returns to Menu on disconnect while control is pending", async () => {
  // setup flow where connection.destroy/reject occurs before ack
  // assert safe reset to splash/menu state
  await vi.waitFor(() => expect(getRoom()).toBe(Splash));
});

});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/game/state/game.flow.test.ts`
Expected: FAIL because control orchestration is not implemented.

- [ ] **Step 3: Implement minimal handshake orchestration in flow + connection manager helpers**

```ts
// Legal transition table (flow-owned)
// GameActive + pause-request -> pending(pause) -> GamePaused (on pause-ack)
// GamePaused + resume-request -> pending(resume) -> GameActive (on resume-ack)
// GamePaused + exit-confirmed -> pending(exit) -> Menu teardown (on exit-ack)

async function handleLocalPauseRequest() {
  if (getRoom() !== Game) return;
  setControlPending("pause");
  await connectionManager.sendPauseRequest();
  await connectionManager.waitForPauseAck(CONTROL_TIMEOUT_MS);
  setRoom(GamePaused);
  setControlPending("none");
}

async function handleIncomingPauseRequest() {
  if (getRoom() === GamePaused) {
    await connectionManager.sendPauseAck(); // idempotent ack
    return;
  }
  if (getRoom() !== Game) return;
  await connectionManager.sendPauseAck();
  setRoom(GamePaused);
}

async function handleIncomingExitRequest() {
  // exit wins races against pending pause/resume
  setControlPending("none");
  await connectionManager.sendExitAck();
  resetAppState();
}

// Duplicate/idempotent control handling
// If already GamePaused and pause-request arrives, reply pause-ack and stay paused.
// If already GameActive and resume-request arrives, reply resume-ack and stay active.

// Race rule
// If exit-request arrives while pending resume/pause, clear pending and exit first.

if (timedOut) {
  resetAppState();
  return;
}
```

- [ ] **Step 4: Extend test transport for control messages**

```ts
// Add explicit script switches in TestConnectionScenario, for example:
// control: { duplicatePauseAck?: boolean; concurrentPause?: boolean; denyAck?: "pause"|"resume"|"exit" }

case PAUSE_REQUEST:
  this.emitIncoming(PAUSE_ACK, undefined);
  if (this.scenario.control?.duplicatePauseAck) {
    this.emitIncoming(PAUSE_ACK, undefined);
  }
  if (this.scenario.control?.concurrentPause) {
    this.emitIncoming(PAUSE_REQUEST, undefined);
  }
  return;
case RESUME_REQUEST:
  if (this.scenario.control?.denyAck === "resume") return;
  this.emitIncoming(RESUME_ACK, undefined);
  return;
case EXIT_REQUEST:
  if (this.scenario.control?.denyAck === "exit") return;
  this.emitIncoming(EXIT_ACK, undefined);
  return;
```

- [ ] **Step 5: Run targeted flow tests**

Run: `cd client && npm test -- src/game/state/game.flow.test.ts`
Expected: PASS for new control-path scenarios.

- [ ] **Step 6: Commit**

```bash
git add client/src/game/state/ConnectionManager.ts client/src/game/state/game.flow.ts client/src/game/state/game.flow.test.ts client/src/game/state/connection.testing.ts
git commit -m "feat(flow): add synchronized pause/resume/exit control handshakes"
```

### Task 4: Paused UI and Interaction Lock

**Files:**

- Modify: `client/src/game/visuals/Game.tsx`
- Create: `client/src/game/visuals/PauseOverlay.tsx`
- Create: `client/src/game/visuals/ExitConfirmDialog.tsx`
- Modify: `client/src/game/visuals/Card.tsx`
- Modify: `client/src/game/visuals/BoardArea.tsx`
- Modify: `client/src/game/visuals/useKeyPress.ts`
- Test: `client/src/game/visuals/GamePauseControls.test.tsx`

- [ ] **Step 1: Write failing UI interaction tests**

```tsx
it("disables pick/place while paused", async () => {
  render(<Game session={session} />);
  // set store room to GamePaused
  // click card and board
  // assert no pick/place handlers fired
});

it("shows exit confirm before sending exit intent", async () => {
  // click Exit from PauseOverlay
  // expect confirm dialog first
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/game/visuals/GamePauseControls.test.tsx`
Expected: FAIL because pause overlay and gating are missing.

- [ ] **Step 3: Implement minimal paused UI controls**

```tsx
{
  room === "GamePaused" && (
    <PauseOverlay onResume={triggerResumeIntent} onExit={triggerExitIntent} />
  );
}
{
  showExitConfirm && (
    <ExitConfirmDialog
      onConfirm={() => triggerExitConfirm(true)}
      onCancel={() => triggerExitConfirm(false)}
    />
  );
}
```

- [ ] **Step 4: Add gameplay guards in Card/BoardArea/useKeyPress**

```ts
// Guard all gameplay interaction handlers, not just rendering:
// Card.tsx: inline card onClick handler for session.handleLocalPick(id)
// BoardArea.tsx: handleClick(x, y) placement path calling session.handleLocalPlacement(...)
// BoardArea.tsx: handleRotate and handleFlip callbacks bound to buttons and keypress
// useKeyPress.ts: onKeyup listener callback before action() invocation

if (room !== "GameActive") {
  return;
}
```

Guard rule: `room !== "GameActive"` blocks input for `GamePaused` and `GameEnded`.

- [ ] **Step 5: Run targeted UI tests**

Run: `cd client && npm test -- src/game/visuals/GamePauseControls.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/game/visuals/Game.tsx client/src/game/visuals/PauseOverlay.tsx client/src/game/visuals/ExitConfirmDialog.tsx client/src/game/visuals/Card.tsx client/src/game/visuals/BoardArea.tsx client/src/game/visuals/useKeyPress.ts client/src/game/visuals/GamePauseControls.test.tsx
git commit -m "feat(ui): add paused overlay, exit confirmation, and gameplay lock"
```

### Task 5: Visual TDD Stories for Pause and Exit

**Files:**

- Modify: `client/src/game/visuals/PlayRulesVisualTdd.stories.tsx`
- Modify: `client/src/game/visuals/GameRulesVisualTdd.shared.tsx`

- [ ] **Step 1: Add failing story play assertions for paused behavior**

```tsx
export const PausedState: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole("button", { name: /resume/i })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /exit/i })).toBeVisible();
    await expect(canvas.queryByText(/pick your card/i)).toBeNull();
  },
};
```

- [ ] **Step 2: Run focused story tests (expected fail first if UI not complete)**

Run: Storybook MCP `run-story-tests` on the updated `PlayRulesVisualTdd` stories.
Expected: FAIL until paused/exit UI behavior is wired.

- [ ] **Step 3: Adjust story harness args/state setup to reflect real paused and confirm states**

```tsx
// Extend shared harness props first:
type RuleHarnessControls = {
  initialRoom?: "Game" | "GamePaused";
  showExitConfirm?: boolean;
};

// In GameRulesVisualTdd.shared.tsx, plumb controls into store setup
// before rendering App so stories can deterministically enter paused/confirm modes.

export const PausedState = {
  args: { initialRoom: "GamePaused" },
};

export const ExitConfirmState = {
  args: { initialRoom: "GamePaused", showExitConfirm: true },
};
```

- [ ] **Step 4: Re-run focused story tests and open previews**

Run: Storybook MCP `run-story-tests` for affected stories.
Expected: PASS.

Run: Storybook MCP `preview-stories` for affected stories.
Expected: URLs available for manual check.

- [ ] **Step 5: Commit**

```bash
git add client/src/game/visuals/PlayRulesVisualTdd.stories.tsx
git commit -m "test(storybook): cover paused and exit-confirm game states"
```

### Task 6: Full Verification and Documentation Update

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Update roadmap bullet to reflect completion**

```md
- full game loop (menu, start, pause, exit) ✅
```

- [ ] **Step 2: Run full client test suite**

Run: `cd client && npm test`
Expected: PASS.

- [ ] **Step 3: Run type-check and build**

Run: `cd client && npm run tscheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Run broad story test pass**

Run: Storybook MCP `run-story-tests` with no story filter.
Expected: PASS with no accessibility regressions.

- [ ] **Step 5: Final commit**

```bash
git add README.md
git commit -m "docs: mark full game loop milestone complete"
```

- [ ] **Step 6: Prepare PR summary**

```md
- Added authoritative menu/lobby/active/paused/ended loop states
- Added synchronized control protocol for pause/resume/exit
- Added pause lock UI + exit confirmation
- Added unit, integration, and story coverage for control flow
```
