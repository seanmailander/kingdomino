import { computed, effect, signal } from "alien-signals";
import { useEffect, useMemo, useState } from "react";

import type { GameSession } from "../game/state/GameSession";
import type { GameEventMap } from "../game/state/GameSession";
import { type Room, Splash, computeHint } from "./App";

// ── Session signal ────────────────────────────────────────────────────────────

const sessionSignal = signal<GameSession | null>(null);

/**
 * Version counter — incremented on every game event and room change.
 * React hooks track this to know when to re-render.
 */
const versionSignal = signal(0);
const bumpVersion = () => versionSignal(versionSignal() + 1);

const ALL_EVENTS: ReadonlyArray<keyof GameEventMap> = [
  "player:joined",
  "game:started",
  "round:started",
  "pick:made",
  "place:made",
  "round:complete",
  "game:ended",
];

export const setCurrentSession = (session: GameSession | null): void => {
  if (session) {
    for (const event of ALL_EVENTS) {
      session.events.on(event, bumpVersion);
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

// ── Lobby coordination ────────────────────────────────────────────────────────
//
// Replaces action dispatching for start/leave commands from the Lobby UI.
// The game flow module calls await awaitLobbyStart() and the Lobby button
// calls triggerLobbyStart() — no action types involved.

let lobbyStartResolver: (() => void) | null = null;

export const awaitLobbyStart = (): Promise<void> =>
  new Promise(resolve => {
    lobbyStartResolver = resolve;
  });

export const triggerLobbyStart = (): void => {
  lobbyStartResolver?.();
  lobbyStartResolver = null;
};

let lobbyLeaveResolver: (() => void) | null = null;

export const awaitLobbyLeave = (): Promise<void> =>
  new Promise(resolve => {
    lobbyLeaveResolver = resolve;
  });

export const triggerLobbyLeave = (): void => {
  lobbyLeaveResolver?.();
  lobbyLeaveResolver = null;
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
      setVersion(prev => (prev === v ? prev : v));
    });
  }, [versionComputed]);

  const session = sessionSignal();
  const room = roomSignal();
  const hint = computeHint(session, room);

  return { session, room, hint };
};
