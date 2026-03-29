import { describe, it, expect, vi, beforeEach } from "vitest";
import { PeerSession } from "./peer.session";
import { MultiplayerConnection } from "kingdomino-protocol";

// ---------------------------------------------------------------------------
// PeerJS mock
// ---------------------------------------------------------------------------

type FakePeerListeners = {
  open: ((id: string) => void)[];
  connection: ((conn: FakeDataConnection) => void)[];
  error: ((err: Error) => void)[];
};

type FakeDataConnectionListeners = {
  open: (() => void)[];
  data: ((data: unknown) => void)[];
  close: (() => void)[];
  error: ((err: Error) => void)[];
};

class FakeDataConnection {
  listeners: FakeDataConnectionListeners = {
    open: [],
    data: [],
    close: [],
    error: [],
  };
  sent: unknown[] = [];
  closed = false;
  peer: string;

  constructor(remotePeerId: string) {
    this.peer = remotePeerId;
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    const list = (this.listeners as Record<string, unknown[]>)[event];
    if (list) list.push(handler);
    return this;
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
  }
}

class FakePeer {
  listeners: FakePeerListeners = { open: [], connection: [], error: [] };
  destroyed = false;
  _outboundConnections: FakeDataConnection[] = [];
  options: Record<string, unknown>;

  constructor(idOrOptions: string | undefined | Record<string, unknown>, options?: Record<string, unknown>) {
    // Support both new Peer(id, options) and new Peer(options) call signatures
    if (typeof idOrOptions === "object" && idOrOptions !== null) {
      this.options = idOrOptions as Record<string, unknown>;
    } else {
      this.options = options ?? {};
    }
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    const list = (this.listeners as Record<string, unknown[]>)[event];
    if (list) list.push(handler);
    return this;
  }

  connect(remotePeerId: string, _opts?: unknown): FakeDataConnection {
    const conn = new FakeDataConnection(remotePeerId);
    this._outboundConnections.push(conn);
    return conn;
  }

  destroy() {
    this.destroyed = true;
  }

  _emitOpen(id: string) { this.listeners.open.forEach((h) => h(id)); }
  _emitError(err: Error) { this.listeners.error.forEach((h) => h(err)); }
  _emitIncomingConnection(conn: FakeDataConnection) {
    this.listeners.connection.forEach((h) => h(conn));
  }
}

let lastPeer: FakePeer;

vi.mock("peerjs", () => ({
  // Must use a regular function (not arrow) so it can be used as a constructor with `new`
  Peer: vi.fn().mockImplementation(function (
    idOrOptions: string | undefined | Record<string, unknown>,
    options?: Record<string, unknown>,
  ) {
    lastPeer = new FakePeer(idOrOptions, options);
    return lastPeer;
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PeerSession — registration", () => {
  it("resolves ready with the peer ID assigned by the server", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("peer-abc-123");
    const id = await session.ready;
    expect(id).toBe("peer-abc-123");
  });

  it("rejects ready when the PeerJS server reports an error", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitError(new Error("server unavailable"));
    await expect(session.ready).rejects.toThrow("server unavailable");
  });

  it("connects to the signaling server with the provided host and port", () => {
    new PeerSession({ host: "kingdomino.local", port: 9000, path: "/api/peers" });
    expect(lastPeer.options.host).toBe("kingdomino.local");
    expect(lastPeer.options.port).toBe(9000);
    expect(lastPeer.options.path).toBe("/api/peers");
  });
});

describe("PeerSession — peer discovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns remote peer IDs from the server, excluding self", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("me-123");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ["me-123", "peer-A", "peer-B"],
    } as Response);

    const peers = await session.discoverPeers();

    expect(peers).toEqual(["peer-A", "peer-B"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/peers/default/peers",
    );
  });

  it("returns an empty array when no other peers are registered", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("solo-peer");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ["solo-peer"],
    } as Response);

    const peers = await session.discoverPeers();
    expect(peers).toEqual([]);
  });
});

describe("PeerSession — outbound connection", () => {
  it("resolves with a MultiplayerConnection once the DataChannel opens", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("player-1");

    const connectPromise = session.connect("player-2");
    const fakeConn = lastPeer._outboundConnections[0];
    fakeConn.listeners.open.forEach((h) => h());

    const mc = await connectPromise;
    expect(mc).toBeInstanceOf(MultiplayerConnection);
    expect(mc.peerIdentifiers.me).toBe("player-1");
    expect(mc.peerIdentifiers.them).toBe("player-2");
  });

  it("messages sent via the MultiplayerConnection are forwarded to DataConnection.send", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("player-1");

    const connectPromise = session.connect("player-2");
    const fakeConn = lastPeer._outboundConnections[0];
    fakeConn.listeners.open.forEach((h) => h());

    const mc = await connectPromise;
    mc.send({ type: "START" });

    expect(fakeConn.sent).toHaveLength(1);
    expect(fakeConn.sent[0]).toMatchObject({ type: "START" });
  });

  it("data arriving on the DataConnection is fed into MultiplayerConnection.receive", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("player-1");

    const connectPromise = session.connect("player-2");
    const fakeConn = lastPeer._outboundConnections[0];
    fakeConn.listeners.open.forEach((h) => h());

    const mc = await connectPromise;

    const waitPromise = mc.waitFor("START");
    fakeConn.listeners.data.forEach((h) => h({ type: "START" }));

    await expect(waitPromise).resolves.toBeDefined();
  });

  it("rejects when the DataConnection emits an error before opening", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("player-1");

    const connectPromise = session.connect("player-2");
    const fakeConn = lastPeer._outboundConnections[0];
    fakeConn.listeners.error.forEach((h) => h(new Error("connection refused")));

    await expect(connectPromise).rejects.toThrow("connection refused");
  });

  it("destroys the MultiplayerConnection when the DataChannel closes", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("player-1");

    const connectPromise = session.connect("player-2");
    const fakeConn = lastPeer._outboundConnections[0];
    fakeConn.listeners.open.forEach((h) => h());

    const mc = await connectPromise;
    const waitPromise = mc.waitFor("START");

    // Simulate DataChannel closing
    fakeConn.listeners.close.forEach((h) => h());

    // waitFor should reject because the connection was destroyed
    await expect(waitPromise).rejects.toThrow();
  });
});

describe("PeerSession — inbound connection", () => {
  it("calls the callback with a wired MultiplayerConnection when a peer connects", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("host-peer");

    const received: MultiplayerConnection[] = [];
    session.onIncomingConnection((conn) => received.push(conn));

    const inbound = new FakeDataConnection("remote-peer");
    lastPeer._emitIncomingConnection(inbound);
    inbound.listeners.open.forEach((h) => h());

    expect(received).toHaveLength(1);
    expect(received[0].peerIdentifiers.me).toBe("host-peer");
    expect(received[0].peerIdentifiers.them).toBe("remote-peer");
  });
});

describe("PeerSession — destroy", () => {
  it("calls peer.destroy() when PeerSession.destroy() is called", () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    session.destroy();
    expect(lastPeer.destroyed).toBe(true);
  });
});
