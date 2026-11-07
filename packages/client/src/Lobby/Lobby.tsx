import { useState } from "react";
import type { MultiplayerConnection } from "kingdomino-protocol";

import "./Lobby.css";
import type { PlayerSlotConfig, PlayerSlotType, RosterConfig } from "./lobby.types";
import { SLOT_LOCAL, SLOT_COUCH, SLOT_AI, SLOT_REMOTE } from "./lobby.types";

type LobbyProps = {
  onStart: (config: RosterConfig) => void;
  onLeave: () => void;
  joinMatchmaking: () => Promise<MultiplayerConnection>;
};

const SLOT_TYPES: PlayerSlotType[] = [SLOT_LOCAL, SLOT_COUCH, SLOT_AI, SLOT_REMOTE];
const SLOT_TYPE_LABELS: Record<PlayerSlotType, string> = {
  [SLOT_LOCAL]: "Local",
  [SLOT_COUCH]: "Couch",
  [SLOT_AI]: "AI",
  [SLOT_REMOTE]: "Remote",
};
const SLOT_TYPE_HINTS: Record<PlayerSlotType, string> = {
  [SLOT_LOCAL]: "You, on this device",
  [SLOT_COUCH]: "Another person, sharing this device",
  [SLOT_AI]: "Computer opponent",
  [SLOT_REMOTE]: "Another person, over the network",
};

export function Lobby({ onStart, onLeave, joinMatchmaking }: LobbyProps) {
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(2);
  const [slots, setSlots] = useState<PlayerSlotConfig[]>([{ type: SLOT_LOCAL }, { type: SLOT_AI }]);
  const [connectingSlots, setConnectingSlots] = useState<Set<number>>(new Set());
  const [failedSlots, setFailedSlots] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<"start" | "leave" | null>(null);

  const changePlayerCount = (count: 2 | 3 | 4) => {
    setPlayerCount(count);
    setSlots((prev) => {
      if (count > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: count - prev.length }, () => ({
            type: SLOT_AI as PlayerSlotType,
          })),
        ];
      }
      // Destroy any remote connections on slots being removed
      prev.slice(count).forEach((slot) => {
        if (slot.type === SLOT_REMOTE) slot.connection?.destroy();
      });
      return prev.slice(0, count);
    });
    setFailedSlots((prev) => new Set([...prev].filter((i) => i < count)));
    setConnectingSlots((prev) => {
      const next = new Set(prev);
      for (const idx of prev) {
        if (idx >= count) next.delete(idx);
      }
      return next;
    });
  };

  const changeSlotType = (index: number, type: PlayerSlotType) => {
    // Clean up if switching away from a remote slot
    const current = slots[index];
    if (current.type === SLOT_REMOTE) {
      current.connection?.destroy();
      setConnectingSlots((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }

    setSlots((prev) => prev.map((slot, i) => (i === index ? { type } : slot)));
    setFailedSlots((prev) => new Set([...prev].filter((i) => i !== index)));

    if (type === SLOT_REMOTE) {
      setConnectingSlots((prev) => new Set([...prev, index]));
      joinMatchmaking()
        .then((conn) => {
          setSlots((prev) =>
            prev.map((slot, i) =>
              i === index && slot.type === SLOT_REMOTE
                ? { ...slot, peerId: conn.peerIdentifiers.them, connection: conn }
                : slot.type === SLOT_LOCAL
                  ? { ...slot, peerId: conn.peerIdentifiers.me }
                  : slot,
            ),
          );
          setConnectingSlots((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        })
        .catch(() => {
          // Matchmaking failed — revert slot to AI and clear connecting state
          setFailedSlots((prev) => new Set([...prev, index]));
          setSlots((prev) =>
            prev.map((slot, i) => (i === index && slot.type === SLOT_REMOTE ? { type: SLOT_AI } : slot)),
          );
          setConnectingSlots((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        });
    }
  };

  const startDisabled = slots.some(
    (slot, i) => slot.type === SLOT_REMOTE && (connectingSlots.has(i) || !slot.connection),
  );

  const atLeastOneRemote = slots.some((slot) => slot.type === SLOT_REMOTE);

  const remoteWaiting = slots.filter((slot, i) => slot.type === SLOT_REMOTE && connectingSlots.has(i)).length;
  const status =
    pending === "start"
      ? "Starting game…"
      : pending === "leave"
        ? "Leaving lobby…"
        : remoteWaiting
          ? `Waiting for ${remoteWaiting} remote player(s) to connect…`
          : `Ready: ${slots.map((s, i) => `P${i + 1} ${SLOT_TYPE_LABELS[s.type]}`).join(", ")}`;

  return (
    <div className="lobby">
      <h2>Lobby</h2>

      <div className="lobby-row">
        <span>Players: </span>
        <div className="lobby-seg">
          {([2, 3, 4] as const).map((count) => (
            <button
              key={count}
              aria-pressed={playerCount === count}
              disabled={!!pending}
              onClick={() => changePlayerCount(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      <ul className="lobby-slots">
        {slots.map((slot, i) => (
          <li key={i} className={`lobby-slot lobby-slot--${slot.type}`}>
            <strong>Player {i + 1}</strong>
            <div className="lobby-seg">
              {SLOT_TYPES.map((type) => (
                <button
                  key={type}
                  aria-pressed={slot.type === type}
                  disabled={!!pending}
                  onClick={() => changeSlotType(i, type)}
                >
                  {SLOT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            <small className="lobby-slot-hint">
              {SLOT_TYPE_HINTS[slot.type]}
              {slot.type === SLOT_LOCAL && atLeastOneRemote && slot.peerId ? ` — ${slot.peerId} (You)` : null}
              {slot.type === SLOT_REMOTE &&
                (connectingSlots.has(i) ? (
                  <span aria-busy="true"> — Connecting…</span>
                ) : (
                  <> — <span>{slot.peerId}</span></>
                ))}
              {failedSlots.has(i) && slot.type !== SLOT_REMOTE ? (
                <span role="alert" className="lobby-error"> — Matchmaking failed, reverted to AI</span>
              ) : null}
            </small>
          </li>
        ))}
      </ul>

      <p className="lobby-status" role="status">
        {status}
      </p>

      <div className="lobby-row">
        <button
          className="primary"
          disabled={startDisabled || !!pending}
          onClick={() => {
            setPending("start");
            onStart(slots as RosterConfig);
          }}
        >
          {pending === "start" ? "Starting…" : "Start game"}
        </button>
        <button
          disabled={!!pending}
          onClick={() => {
            setPending("leave");
            onLeave();
          }}
        >
          Leave
        </button>
      </div>
    </div>
  );
}
