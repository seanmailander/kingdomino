import { computed, effect, signal } from "alien-signals";

import type { GameSession, GameEvent } from "kingdomino-engine";
import { GAME_STARTED, ROUND_STARTED, PICK_MADE, PLACE_MADE, DISCARD_MADE, ROUND_COMPLETE, GAME_PAUSED, GAME_RESUMED, GAME_ENDED } from "kingdomino-engine";
import type { GameEndedEntry } from "kingdomino-engine";
import { type Room, Splash, computeHint } from "./AppExtras";
import type { RosterConfig } from "../Lobby/lobby.types";

const ALL_EVENTS: ReadonlyArray<GameEvent["type"]> = [
  GAME_STARTED, ROUND_STARTED, PICK_MADE, PLACE_MADE, DISCARD_MADE,
  ROUND_COMPLETE, GAME_PAUSED, GAME_RESUMED, GAME_ENDED,
];

export class GameStore {
  // ── Signals ──────────────────────────────────────────────────────────────
  private readonly _session = signal<GameSession | null>(null);
  private readonly _room = signal<Room>(Splash);
  private readonly _version = signal(0);
  private readonly _gameOverScores = signal<GameEndedEntry[]>([]);

  // ── Resolver queues ──────────────────────────────────────────────────────
  private lobbyStartResolvers: Array<(config: RosterConfig) => void> = [];
  private lobbyLeaveResolvers: Array<() => void> = [];
  private pauseIntentResolvers: Array<(value: undefined) => void> = [];
  private resumeIntentResolvers: Array<(value: undefined) => void> = [];
  private exitConfirmResolvers: Array<(value: boolean | undefined) => void> = [];

  // ── Session event subscriptions ──────────────────────────────────────────
  private sessionUnsubscribers: Array<() => void> = [];

  // ── Version (exposed for useApp hook) ────────────────────────────────────
  get version() {
    return this._version;
  }

  private bumpVersion() {
    this._version(this._version() + 1);
  }

  // ── Session ──────────────────────────────────────────────────────────────
  getSession(): GameSession | null {
    return this._session();
  }

  setCurrentSession(session: GameSession | null): void {
    for (const unsub of this.sessionUnsubscribers) unsub();
    this.sessionUnsubscribers = [];

    if (session) {
      const unsubEnded = session.events.on(GAME_ENDED, ({ scores }) => {
        this._gameOverScores(scores);
      });
      this.sessionUnsubscribers.push(unsubEnded);

      for (const event of ALL_EVENTS) {
        const unsub = session.events.on(event, () => this.bumpVersion());
        this.sessionUnsubscribers.push(unsub);
      }
    }
    this._session(session);
    this.bumpVersion();
  }

  // ── Game over scores ─────────────────────────────────────────────────────
  getGameOverScores(): GameEndedEntry[] {
    return this._gameOverScores();
  }

  // ── Room ─────────────────────────────────────────────────────────────────
  getRoom(): Room {
    return this._room();
  }

  setRoom(room: Room): void {
    this._room(room);
    this.bumpVersion();
  }

  onceRoomIsNot(room: Room): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false;
      const dispose = effect(() => {
        if (this._room() !== room && !resolved) {
          resolved = true;
          queueMicrotask(() => dispose());
          resolve();
        }
      });
    });
  }

  // ── Lobby coordination ───────────────────────────────────────────────────
  awaitLobbyStart(): Promise<RosterConfig> {
    return new Promise((resolve) => {
      this.lobbyStartResolvers.push(resolve);
    });
  }

  triggerLobbyStart(config: RosterConfig): void {
    const resolvers = this.lobbyStartResolvers;
    this.lobbyStartResolvers = [];
    for (const resolve of resolvers) resolve(config);
  }

  awaitLobbyLeave(): Promise<void> {
    return new Promise((resolve) => {
      this.lobbyLeaveResolvers.push(resolve);
    });
  }

  triggerLobbyLeave(): void {
    const resolvers = this.lobbyLeaveResolvers;
    this.lobbyLeaveResolvers = [];
    for (const resolve of resolvers) resolve();
  }

  // ── Pause / resume / exit ────────────────────────────────────────────────
  awaitPauseIntent(): Promise<void> {
    return new Promise((resolve) => {
      this.pauseIntentResolvers.push(resolve);
    });
  }

  triggerPauseIntent(): void {
    const resolvers = this.pauseIntentResolvers;
    this.pauseIntentResolvers = [];
    for (const resolve of resolvers) resolve(undefined);
  }

  awaitResumeIntent(): Promise<void> {
    return new Promise((resolve) => {
      this.resumeIntentResolvers.push(resolve);
    });
  }

  triggerResumeIntent(): void {
    const resolvers = this.resumeIntentResolvers;
    this.resumeIntentResolvers = [];
    for (const resolve of resolvers) resolve(undefined);
  }

  awaitExitConfirm(): Promise<boolean | undefined> {
    return new Promise((resolve) => {
      this.exitConfirmResolvers.push(resolve);
    });
  }

  triggerExitConfirm(confirmed: boolean): void {
    const resolvers = this.exitConfirmResolvers;
    this.exitConfirmResolvers = [];
    for (const resolve of resolvers) resolve(confirmed);
  }

  // ── Computed helpers ─────────────────────────────────────────────────────
  computeHint() {
    return computeHint(this._session(), this._room());
  }

  // ── Dispose ──────────────────────────────────────────────────────────────
  dispose(): void {
    for (const unsub of this.sessionUnsubscribers) unsub();
    this.sessionUnsubscribers = [];
    this.lobbyStartResolvers = [];
    this.lobbyLeaveResolvers = [];
    this.pauseIntentResolvers = [];
    this.resumeIntentResolvers = [];
    this.exitConfirmResolvers = [];
    this._session(null);
  }
}
