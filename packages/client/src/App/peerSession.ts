import { PeerSession } from "kingdomino-lobby";

/**
 * Lazy singleton PeerSession for the client.
 * Defers construction (and the PeerJS server connection) until first use,
 * so importing this module in tests/Storybook does not trigger network requests.
 * Derives host/port from window.location so it works in both dev (Vite proxy)
 * and production (same-origin server).
 */
let _peerSession: PeerSession | null = null;

export function getPeerSession(): PeerSession {
  if (!_peerSession) {
    const host = window.location.hostname;
    const port = window.location.port
      ? Number.parseInt(window.location.port, 10)
      : window.location.protocol === "https:" ? 443 : 80;
    _peerSession = new PeerSession({ host, port });
  }
  return _peerSession;
}
