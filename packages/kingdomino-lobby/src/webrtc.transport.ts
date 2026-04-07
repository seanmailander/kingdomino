import type { DataConnection } from "peerjs";
import type { MultiplayerTransport, WireMessage } from "kingdomino-protocol";

/**
 * Wraps a PeerJS DataConnection as a MultiplayerTransport for the send direction.
 * Receive direction is wired externally: caller must route DataConnection "data"
 * events to MultiplayerConnection.receive().
 *
 * Uses PeerJS's default serialization (JSON objects passed through directly —
 * no manual stringify/parse needed when the connection is opened with
 * serialization: "json").
 */
export class WebRtcTransport implements MultiplayerTransport {
  constructor(private readonly conn: DataConnection) {}

  send(message: WireMessage): void {
    void this.conn.send(message);
  }

  destroy(): void {
    this.conn.close();
  }
}
