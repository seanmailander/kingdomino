export const STALE_AFTER_MS = 3000;

export type Lobby = {
  [playerId: string]: { lastSeen: number; partnerId?: string };
};

// Player A is new, gets added to waiting list
// Player B is new, gets matched to A, waits for A to reach out
// Player A polls again, learns B's id, reaches out
export const letMeIn = (lobby: Lobby, playerId: string, now: number) => {
  // Players who closed the tab stop polling; drop them so nobody pairs with a ghost
  for (const id of Object.keys(lobby)) {
    if (now - lobby[id].lastSeen > STALE_AFTER_MS) delete lobby[id];
  }

  const partnerId = lobby[playerId]?.partnerId;
  if (partnerId) {
    delete lobby[playerId];
    return { otherPlayerId: partnerId };
  }

  // Only pair with someone still unpaired
  const otherPlayerId = Object.keys(lobby).find((id) => id !== playerId && !lobby[id].partnerId);
  if (!otherPlayerId) {
    lobby[playerId] = { lastSeen: now };
    return { checkBackInMs: 1000 };
  }

  lobby[otherPlayerId].partnerId = playerId;
  delete lobby[playerId];
  return { waitForConnection: true as const };
};
