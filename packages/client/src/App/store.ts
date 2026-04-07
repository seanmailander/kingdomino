import { computed, effect, signal } from "alien-signals";
import { useEffect, useMemo, useState } from "react";

import type { GameSession, GameEvent } from "kingdomino-engine";
import { GAME_STARTED, ROUND_STARTED, PICK_MADE, PLACE_MADE, DISCARD_MADE, ROUND_COMPLETE, GAME_PAUSED, GAME_RESUMED, GAME_ENDED } from "kingdomino-engine";
import type { GameEndedEntry } from "kingdomino-engine";
import { type Room, Splash, computeHint } from "./AppExtras";
import type { RosterConfig } from "../Lobby/lobby.types";

// ── Session signal ────────────────────────────────────────────────────────────

const sessionSignal = signal<GameSession | null>(null);

/**
 * Version counter — incremented on every game event and room change.
 * React hooks track this to know when to re-render.
 */
const versionSignal = signal(0);
const bumpVersion = () => versionSignal(versionSignal() + 1);

// ── Game-over scores signal ───────────────────────────────────────────────────

const gameOverScoresSignal = signal<GameEndedEntry[]>([]);

export const getGameOverScores = (): GameEndedEntry[] => gameOverScoresSignal();

const ALL_EVENTS: ReadonlyArray<GameEvent["type"]> = [
  GAME_STARTED,
  ROUND_STARTED,
  PICK_MADE,
  PLACE_MADE,
  DISCARD_MADE,
  ROUND_COMPLETE,
  GAME_PAUSED,
  GAME_RESUMED,
  GAME_ENDED,
];

let sessionUnsubscribers: Array<() => void> = [];

export const setCurrentSession = (session: GameSession | null): void => {
  // Unsubscribe from all events on the previous session, if any.
  for (const unsubscribe of sessionUnsubscribers) {
    unsubscribe();
  }
  sessionUnsubscribers = [];

  if (session) {
    // Capture game:ended payload before bumping version so data is ready when React re-renders
    const unsubscribeEnded = session.events.on(GAME_ENDED, ({ scores }) => {
      gameOverScoresSignal(scores);
    });
    sessionUnsubscribers.push(unsubscribeEnded);

    for (const event of ALL_EVENTS) {
      const unsubscribe = session.events.on(event, bumpVersion);
      // Capture unsubscribe functions so we can dispose them when the session changes.
      sessionUnsubscribers.push(unsubscribe);
    }
  }
  sessionSignal(session);
  bumpVersion();
};

export const getCurrentSession = (): GameSession | null => sessionSignal();

// ── Room signal ───────────────────────────────────────────────────────────────

const roomSignal = signal<Room>(Splash);

export const setRoom = (room: Room): void => {
  roomSignal(room);
  bumpVersion();
};

export const getRoom = (): Room => roomSignal();

/**
 * Resolves once the room is no longer `room`.
 * If the room is already different, resolves immediately.
 */
export const onceRoomIsNot = (room: Room): Promise<void> => {
  return new Promise((resolve) => {
    let resolved = false;
    const dispose = effect(() => {
      if (roomSignal() !== room && !resolved) {
        resolved = true;
        // Use a lambda to avoid accessing `dispose` before initialization (TDZ safety)
        queueMicrotask(() => dispose());
        resolve();
      }
    });
  });
};

// ── Lobby coordination ────────────────────────────────────────────────────────
//
// Replaces action dispatching for start/leave commands from the Lobby UI.
// The game flow module calls await awaitLobbyStart() and the Lobby button
// calls triggerLobbyStart() — no action types involved.

let lobbyStartResolvers: Array<(config: RosterConfig) => void> = [];

export const awaitLobbyStart = (): Promise<RosterConfig> =>
  new Promise((resolve) => {
    lobbyStartResolvers.push(resolve);
  });

export const triggerLobbyStart = (config: RosterConfig): void => {
  const resolvers = lobbyStartResolvers;
  lobbyStartResolvers = [];
  for (const resolve of resolvers) {
    resolve(config);
  }
};

let lobbyLeaveResolvers: Array<() => void> = [];

export const awaitLobbyLeave = (): Promise<void> =>
  new Promise((resolve) => {
    lobbyLeaveResolvers.push(resolve);
  });

export const triggerLobbyLeave = (): void => {
  const resolvers = lobbyLeaveResolvers;
  lobbyLeaveResolvers = [];
  for (const resolve of resolvers) {
    resolve();
  }
};

// ── Pause / exit coordination ─────────────────────────────────────────────────

let pauseIntentResolvers: Array<(value: undefined) => void> = [];

export const awaitPauseIntent = (): Promise<void> =>
  new Promise((resolve) => {
    pauseIntentResolvers.push(resolve);
  });

export const triggerPauseIntent = (): void => {
  const resolvers = pauseIntentResolvers;
  pauseIntentResolvers = [];
  for (const resolve of resolvers) {
    resolve(undefined);
  }
};

let resumeIntentResolvers: Array<(value: undefined) => void> = [];

export const awaitResumeIntent = (): Promise<void> =>
  new Promise((resolve) => {
    resumeIntentResolvers.push(resolve);
  });

export const triggerResumeIntent = (): void => {
  const resolvers = resumeIntentResolvers;
  resumeIntentResolvers = [];
  for (const resolve of resolvers) {
    resolve(undefined);
  }
};

let exitConfirmResolvers: Array<(value: boolean | undefined) => void> = [];

export const awaitExitConfirm = (): Promise<boolean | undefined> =>
  new Promise((resolve) => {
    exitConfirmResolvers.push(resolve);
  });

export const triggerExitConfirm = (confirmed: boolean): void => {
  const resolvers = exitConfirmResolvers;
  exitConfirmResolvers = [];
  for (const resolve of resolvers) {
    resolve(confirmed);
  }
};

export const resetAppState = (): void => {
  gameOverScoresSignal([]);
  lobbyStartResolvers = [];
  lobbyLeaveResolvers = [];
  const pendingPause = pauseIntentResolvers;
  pauseIntentResolvers = [];
  for (const resolve of pendingPause) resolve(undefined);
  const pendingResume = resumeIntentResolvers;
  resumeIntentResolvers = [];
  for (const resolve of pendingResume) resolve(undefined);
  const pendingExit = exitConfirmResolvers;
  exitConfirmResolvers = [];
  for (const resolve of pendingExit) resolve(undefined);
  setCurrentSession(null);
  setRoom(Splash);
};

// ── React hooks ──────────────────────────────────────────────────────────────

/**
 * Single composite hook for App.tsx. Re-renders on any game event or room change.
 * Returns the live session (or null before the game starts) and the current room.
 */
export const useApp = () => {
  const versionComputed = useMemo(() => computed(() => versionSignal()), []);
  const [, setVersion] = useState(() => versionComputed());

  useEffect(() => {
    return effect(() => {
      const v = versionComputed();
      setVersion((prev) => (prev === v ? prev : v));
    });
  }, [versionComputed]);

  const session = sessionSignal();
  const room = roomSignal();
  const hint = computeHint(session, room);

  return { session, room, hint };
};
