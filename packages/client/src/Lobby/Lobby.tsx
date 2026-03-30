import { useState } from "react";

import type { PlayerSlotConfig, PlayerSlotType, RosterConfig } from "./lobby.types";

type LobbyProps = {
  onStart: (config: RosterConfig) => void;
  onLeave: () => void;
};

const SLOT_TYPES: PlayerSlotType[] = ["local", "couch", "ai", "remote"];
const SLOT_TYPE_LABELS: Record<PlayerSlotType, string> = {
  local: "Local",
  couch: "Couch",
  ai: "AI",
  remote: "Remote",
};

export function Lobby({ onStart, onLeave }: LobbyProps) {
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(2);
  const [slots, setSlots] = useState<PlayerSlotConfig[]>([{ type: "local" }, { type: "ai" }]);

  const changePlayerCount = (count: 2 | 3 | 4) => {
    setPlayerCount(count);
    setSlots((prev) => {
      if (count > prev.length) {
        return [...prev, ...Array.from({ length: count - prev.length }, () => ({ type: "ai" as PlayerSlotType }))];
      }
      return prev.slice(0, count);
    });
  };

  const changeSlotType = (index: number, type: PlayerSlotType) => {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, type, peerId: type === "remote" ? slot.peerId : undefined } : slot)));
  };

  const changeSlotPeerId = (index: number, peerId: string) => {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, peerId } : slot)));
  };

  const startDisabled = slots.some((slot) => slot.type === "remote" && !slot.peerId?.trim());

  return (
    <>
      <h2>Lobby</h2>

      <div>
        <span>Players: </span>
        {([2, 3, 4] as const).map((count) => (
          <button key={count} aria-pressed={playerCount === count} onClick={() => changePlayerCount(count)}>
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
                <button key={type} aria-pressed={slot.type === type} onClick={() => changeSlotType(i, type)}>
                  {SLOT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            {slot.type === "remote" && (
              <input
                type="text"
                placeholder="Peer ID…"
                value={slot.peerId ?? ""}
                onChange={(e) => changeSlotPeerId(i, e.target.value)}
              />
            )}
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
