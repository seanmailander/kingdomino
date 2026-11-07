import { GameDriver } from "kingdomino-protocol";
import type { WireMessage, WaitForOneOfFn } from "kingdomino-protocol";
import {
  GameSession,
  Player,
  GAME_PHASE_PLAYING,
  GAME_PHASE_PAUSED,
  GAME_PAUSED,
  GAME_RESUMED,
  STANDARD,
} from "kingdomino-engine";
import type { GameVariant } from "kingdomino-engine";
import type { GameBonuses } from "kingdomino-engine";
import type { RosterConfig } from "../../Lobby/lobby.types";
import type { RosterFactory } from "./RosterFactory";

// ── Connection interface ───────────────────────────────────────────────────────

export interface IGameConnection {
  readonly peerIdentifiers: { me: string; them: string };
  send: (message: WireMessage) => void;
  waitForOneOf: WaitForOneOfFn;
  destroy: () => void;
}

export const FLOW_SPLASH = "splash" as const;
export const FLOW_LOBBY = "lobby" as const;
export const FLOW_GAME = "game" as const;
export const FLOW_PAUSED = "paused" as const;
export const FLOW_ENDED = "ended" as const;

/** Internal phase names used by LobbyFlow — independent of UI room constants. */
export type FlowPhase =
  | typeof FLOW_SPLASH
  | typeof FLOW_LOBBY
  | typeof FLOW_GAME
  | typeof FLOW_PAUSED
  | typeof FLOW_ENDED;

/**
 * Adapter interface that decouples LobbyFlow from any specific UI framework or store.
 * The App layer provides AppFlowAdapter; tests can provide a test double.
 */
export interface FlowAdapter {
  setSession(session: GameSession | null): void;
  setPhase(phase: FlowPhase): void;
  awaitStart(): Promise<RosterConfig>;
  awaitLeave(): Promise<void>;
  awaitPause(): Promise<void>;
  awaitResume(): Promise<void>;
  awaitExitConfirm(): Promise<boolean | undefined>;
}

type LobbyFlowOptions = {
  adapter: FlowAdapter;
  /** Factory that builds actors and a seed provider from the lobby roster config. */
  rosterFactory: RosterFactory;
  variant?: GameVariant;
  bonuses?: GameBonuses;
};

// ── LobbyFlow class ───────────────────────────────────────────────────────────

export class LobbyFlow {
  private isRunning = false;
  private session: GameSession | null = null;
  private readonly adapter: FlowAdapter;
  private readonly rosterFactory: RosterFactory;
  private readonly variant: GameVariant;
  private readonly bonuses: GameBonuses;

  constructor(options: LobbyFlowOptions) {
    this.adapter = options.adapter;
    this.rosterFactory = options.rosterFactory;
    this.variant = options.variant ?? STANDARD;
    this.bonuses = options.bonuses ?? {};
  }

  /**
   * Factory-driven entry point. Begins the lobby phase, waits for the UI to
   * configure the roster, then builds actors via the injected RosterFactory
   * and drives the game with GameDriver.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    void this.runFlowWithFactory();
  }

  private async runFlowWithFactory(): Promise<void> {
    try {
      this.adapter.setSession(null);
      this.adapter.setPhase(FLOW_LOBBY);

      const lobbyResult = await Promise.race([
        this.adapter.awaitStart().then((config) => ({ outcome: "start" as const, config })),
        this.adapter.awaitLeave().then(() => ({ outcome: "leave" as const, config: null })),
      ]);

      if (lobbyResult.outcome === "leave") {
        this.adapter.setPhase(FLOW_SPLASH);
        return;
      }

      const { players, seedProvider, localPlayerId } = await this.rosterFactory.build(
        lobbyResult.config!,
      );

      const session = new GameSession({
        variant: this.variant,
        bonuses: this.bonuses,
        localPlayerId: localPlayerId ?? players[0].id,
        seedProvider,
      });
      this.session = session;

      for (const { id } of players) {
        session.addPlayer(new Player(id));
      }
      this.adapter.setSession(session);
      this.adapter.setPhase(FLOW_GAME);

      // Sync engine phase changes to adapter
      session.events.on(GAME_PAUSED, () => this.adapter.setPhase(FLOW_PAUSED));
      session.events.on(GAME_RESUMED, () => this.adapter.setPhase(FLOW_GAME));

      // Wire local pause/resume/exit intents; re-arm each after it fires until this game is over.
      // TODO(remote-control): Add peer handshake for remote slots
      const onEachIntent = <T>(wait: () => Promise<T>, act: (value: T) => void) => {
        void wait().then((value) => {
          if (this.session !== session) return;
          act(value);
          onEachIntent(wait, act);
        });
      };
      onEachIntent(() => this.adapter.awaitPause(), () => {
        if (session.phase === GAME_PHASE_PLAYING) session.pause();
      });
      onEachIntent(() => this.adapter.awaitResume(), () => {
        if (session.phase === GAME_PHASE_PAUSED) session.resume();
      });
      const exitConfirmed = new Promise<"exit">((resolve) =>
        onEachIntent(() => this.adapter.awaitExitConfirm(), (confirmed) => {
          if (confirmed) resolve("exit");
        }),
      );

      const actorMap = new Map(players.map(({ id, actor }) => [id, actor]));
      const driver = new GameDriver(session, actorMap);
      const gameFinished = driver.driveUntilEnd().then(() => "ended" as const);
      session.startGame();
      const outcome = await Promise.race([gameFinished, exitConfirmed]);

      if (outcome === "exit") {
        // Abandoned mid-game: the paused driver never resumes; release actors and go home.
        this.session = null;
        for (const { actor } of players) actor.destroy();
        this.adapter.setSession(null);
        this.adapter.setPhase(FLOW_SPLASH);
        return;
      }

      this.adapter.setPhase(FLOW_ENDED);
    } catch (e) {
      console.error(e);
      this.adapter.setSession(null);
      this.adapter.setPhase(FLOW_SPLASH);
    } finally {
      this.session = null;
      this.isRunning = false;
    }
  }
}
