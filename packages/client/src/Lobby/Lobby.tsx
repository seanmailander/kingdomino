import { useState } from "react";
import type { MultiplayerConnection } from "kingdomino-protocol";

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

export function Lobby({ onStart, onLeave, joinMatchmaking }: LobbyProps) {
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(2);
  const [slots, setSlots] = useState<PlayerSlotConfig[]>([{ type: SLOT_LOCAL }, { type: SLOT_AI }]);
  const [connectingSlots, setConnectingSlots] = useState<Set<number>>(new Set());

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

  return (
    <>
      <h2>Lobby</h2>

      <div>
        <span>Players: </span>
        {([2, 3, 4] as const).map((count) => (
          <button
            key={count}
            aria-pressed={playerCount === count}
            onClick={() => changePlayerCount(count)}
          >
            {count}
          </button>
        ))}
      </div>

      <ul>
        {slots.map((slot, i) => (
          <li key={i}>
            <span>Player {i + 1}</span>
            <div>
              {SLOT_TYPES.map((type) => (
                <button
                  key={type}
                  aria-pressed={slot.type === type}
                  onClick={() => changeSlotType(i, type)}
                >
                  {SLOT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            {slot.type === SLOT_LOCAL && atLeastOneRemote ? (
              <span aria-hidden="true">{slot.peerId} (You)</span>
            ) : null}
            {slot.type === SLOT_REMOTE &&
              (connectingSlots.has(i) ? (
                <span aria-busy="true">Connecting…</span>
              ) : (
                <span>{slot.peerId}</span>
              ))}
          </li>
        ))}
      </ul>

      <div>
        <button disabled={startDisabled} onClick={() => onStart(slots as RosterConfig)}>
          Start game
        </button>
        <button onClick={onLeave}>Leave</button>
      </div>
    </>
  );
}
