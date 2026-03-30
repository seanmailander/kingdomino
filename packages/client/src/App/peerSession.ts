import { PeerSession } from "kingdomino-lobby";

/**
 * Singleton PeerSession for the client.
 * Derives host/port from window.location so it works in both dev (Vite proxy)
 * and production (same-origin server).
 */
function createPeerSession(): PeerSession {
  const host = window.location.hostname;
  const port = window.location.port
    ? Number.parseInt(window.location.port, 10)
    : window.location.protocol === "https:" ? 443 : 80;
  return new PeerSession({ host, port });
}

export const peerSession = createPeerSession();
