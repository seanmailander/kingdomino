import { Peer, type DataConnection } from "peerjs";
import { MultiplayerConnection, type WireMessage } from "kingdomino-protocol";
import { WebRtcTransport } from "./webrtc.transport";

export type PeerSessionOptions = {
  host: string;
  port: number;
  /** Path to the PeerJS server endpoint. Default: "/api/peers" (matches kingdomino-server). */
  path?: string;
};

type MatchmakingResponse =
  | { checkBackInMs: number }
  | { otherPlayerId: string }
  | { waitForConnection: true };

/**
 * Manages a connection to the PeerJS signaling server.
 * Responsibilities: registration, peer discovery, and establishing
 * WebRTC connections as wired MultiplayerConnection objects.
 *
 * Produces: MultiplayerConnection (from kingdomino-protocol).
 * Does not know about: game rules, seed commitment, or player actors.
 */
export class PeerSession {
  private readonly peer: Peer;
  readonly ready: Promise<string>;
  private myId: string | null = null;

  constructor({ host, port, path = "/api/peers" }: PeerSessionOptions) {
    this.peer = new Peer({ host, port, path, key: "default" });

    this.ready = new Promise<string>((resolve, reject) => {
      this.peer.on("open", (id) => {
        this.myId = id;
        resolve(id);
      });
      this.peer.on("error", reject);
    });
  }

  /**
   * Discover other registered peers on the signaling server.
   * Returns peer IDs of all connected peers, excluding self.
   */
  async discoverPeers(): Promise<string[]> {
    const myId = await this.ready;
    const { host, port, path } = this.peer.options;
    const url = `http://${host}:${port}${path}/default/peers`;
    const resp = await fetch(url);
    const all: string[] = await resp.json();
    return all.filter((id) => id !== myId);
  }

  /**
   * Open an outbound WebRTC connection to a remote peer.
   * Resolves with a fully wired MultiplayerConnection once the DataChannel opens.
   */
  connect(remotePeerId: string): Promise<MultiplayerConnection> {
    const myId = this.myId;
    if (!myId) {
      // Not yet registered — wait for ready then retry
      return this.ready.then(() => this.connect(remotePeerId));
    }

    const dataConn = this.peer.connect(remotePeerId, {
      serialization: "json",
      reliable: true,
    });

    return new Promise<MultiplayerConnection>((resolve, reject) => {
      dataConn.on("open", () => {
        resolve(this._wireConnection(myId, remotePeerId, dataConn));
      });
      dataConn.on("error", (err: Error) => reject(err));
    });
  }

  /**
   * Register a callback for inbound connections from remote peers.
   * The callback receives a fully wired MultiplayerConnection.
   */
  onIncomingConnection(callback: (conn: MultiplayerConnection) => void): void {
    this.peer.on("connection", (dataConn: DataConnection) => {
      dataConn.on("open", () => {
        callback(this._wireConnection(this.myId!, dataConn.peer, dataConn));
      });
    });
  }

  /** Destroy all connections and disconnect from the signaling server. */
  destroy(): void {
    this.peer.destroy();
  }

  /**
   * Join the server matchmaking queue via POST /api/letMeIn.
   * Polls until paired, then returns a wired MultiplayerConnection.
   *
   * The server assigns one of two roles:
   *  - Initiator (`otherPlayerId`): we call connect() to them.
   *  - Receiver (`waitForConnection`): we await their inbound connection.
   *
   * Polls are spaced by `checkBackInMs` when no peer is available yet.
   */
  async joinMatchmaking(): Promise<MultiplayerConnection> {
    const myId = await this.ready;
    const { host, port } = this.peer.options;
    const url = `http://${host}:${port}/api/letMeIn`;

    while (true) {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: myId }),
      });
      const data: MatchmakingResponse = await resp.json();

      if ("checkBackInMs" in data) {
        await new Promise<void>((resolve) => setTimeout(resolve, data.checkBackInMs));
        continue;
      }

      if ("otherPlayerId" in data) {
        return this.connect(data.otherPlayerId);
      }

      if ("waitForConnection" in data) {
        return new Promise<MultiplayerConnection>((resolve) => {
          this.peer.once("connection", (dataConn: DataConnection) => {
            dataConn.on("open", () => {
              resolve(this._wireConnection(myId, dataConn.peer, dataConn));
            });
          });
        });
      }

      throw new Error("Unexpected matchmaking response from server");
    }
  }

  private _wireConnection(me: string, them: string, dataConn: DataConnection): MultiplayerConnection {
    const transport = new WebRtcTransport(dataConn);
    const conn = new MultiplayerConnection({ me, them, transport });

    dataConn.on("data", (raw: unknown) => {
      conn.receive(raw as WireMessage);
    });

    dataConn.on("close", () => {
      conn.destroy();
    });

    return conn;
  }
}
