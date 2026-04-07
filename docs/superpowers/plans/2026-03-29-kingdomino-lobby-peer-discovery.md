# Kingdomino Lobby & Peer Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `kingdomino-lobby` package — PeerJS client registration, peer discovery, and WebRTC connection establishment — producing wired `MultiplayerConnection` objects that downstream callers use for seed commitment and game moves.

**Architecture:** The lobby is the bridge between "I know the server address" and "I have a live, named connection to another player." It creates a PeerJS `Peer`, registers with the signaling server to obtain a peer ID, discovers waiting peers via the PeerJS REST API, and establishes WebRTC `DataConnection`s — each wrapped as a fully wired `MultiplayerConnection` from `kingdomino-protocol`. The lobby has no game logic; it only produces connections.

**Tech Stack:** `peerjs` (WebRTC/signaling), `kingdomino-protocol` (MultiplayerConnection, MultiplayerTransport), Vitest (tests with `vi.mock` for peerjs).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `packages/kingdomino-lobby/package.json` | Add `peerjs` dependency |
| Create | `packages/kingdomino-lobby/src/webrtc.transport.ts` | Wraps a PeerJS DataConnection as a `MultiplayerTransport` (internal helper) |
| Create | `packages/kingdomino-lobby/src/peer.session.ts` | `PeerSession` class: registration, discovery, connect/accept |
| Create | `packages/kingdomino-lobby/src/peer.session.test.ts` | Unit tests — all PeerJS mocked with `vi.mock` |
| Modify | `packages/kingdomino-lobby/src/index.ts` | Export public API |

**Boundary:** The lobby returns `MultiplayerConnection` (from `kingdomino-protocol`). Callers wire up `ConnectionManager`, `RemotePlayerActor`, and `CommitmentSeedProvider` from it.

```
PeerJS DataConnection
  → WebRtcTransport (MultiplayerTransport)
    → MultiplayerConnection (wired: data events → connection.receive())
      ← caller creates: ConnectionManager + RemotePlayerActor + CommitmentSeedProvider
```

---

## Task 1: Add peerjs dependency and install

**Files:**
- Modify: `packages/kingdomino-lobby/package.json`

- [ ] **Step 1: Add peerjs to dependencies**

Edit `packages/kingdomino-lobby/package.json`:
```json
{
  "name": "kingdomino-lobby",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "tscheck": "tsc --noEmit"
  },
  "dependencies": {
    "kingdomino-protocol": "*",
    "peerjs": "^1.5.4"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `cd packages/kingdomino-lobby && npm install`
Expected: peerjs linked from workspace root node_modules, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/kingdomino-lobby/package.json
git commit -m "chore(lobby): add peerjs dependency"
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Task 2: Create WebRtcTransport internal helper

**Files:**
- Create: `packages/kingdomino-lobby/src/webrtc.transport.ts`
- Test: `packages/kingdomino-lobby/src/peer.session.test.ts` (will add tests in Task 4+)

The `WebRtcTransport` satisfies the `MultiplayerTransport` contract using a PeerJS DataConnection.

- [ ] **Step 1: Create the file**

`packages/kingdomino-lobby/src/webrtc.transport.ts`:
```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/kingdomino-lobby && npm run tscheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/kingdomino-lobby/src/webrtc.transport.ts
git commit -m "feat(lobby): add WebRtcTransport internal helper"
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Task 3: PeerSession — skeleton and PeerJS registration

**Files:**
- Create: `packages/kingdomino-lobby/src/peer.session.ts`
- Create: `packages/kingdomino-lobby/src/peer.session.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/kingdomino-lobby/src/peer.session.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { PeerSession } from "./peer.session";

// ---------------------------------------------------------------------------
// PeerJS mock factory
// ---------------------------------------------------------------------------
// We build a minimal fake of the peerjs Peer class. Each test gets a fresh
// fake via makePeer() so that event handlers do not bleed across tests.

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
    (this.listeners as Record<string, unknown[]>)[event]?.push(handler);
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

  constructor(_id: string | undefined, options: Record<string, unknown>) {
    this.options = options;
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    (this.listeners as Record<string, unknown[]>)[event]?.push(handler);
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

  // Test helpers — trigger events
  _emitOpen(id: string) {
    this.listeners.open.forEach((h) => h(id));
  }
  _emitError(err: Error) {
    this.listeners.error.forEach((h) => h(err));
  }
  _emitIncomingConnection(conn: FakeDataConnection) {
    this.listeners.connection.forEach((h) => h(conn));
  }
}

let lastPeer: FakePeer;

vi.mock("peerjs", () => ({
  Peer: vi.fn().mockImplementation((id: string | undefined, options: Record<string, unknown>) => {
    lastPeer = new FakePeer(id, options);
    return lastPeer;
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PeerSession — registration", () => {
  it("resolves ready with the peer ID assigned by the server", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    // Simulate server assigning a peer ID
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
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd packages/kingdomino-lobby && npm test`
Expected: FAIL — `PeerSession` does not exist yet.

- [ ] **Step 3: Create PeerSession with registration**

`packages/kingdomino-lobby/src/peer.session.ts`:
```typescript
import { Peer, type DataConnection } from "peerjs";
import { MultiplayerConnection, type WireMessage } from "kingdomino-protocol";
import { WebRtcTransport } from "./webrtc.transport";

export type PeerSessionOptions = {
  host: string;
  port: number;
  /** Path to the PeerJS server endpoint. Default: "/api/peers" (matches kingdomino-server). */
  path?: string;
};

/**
 * Manages a connection to the PeerJS signaling server.
 * Responsibilities: registration, peer discovery, and establishing
 * WebRTC connections as wired MultiplayerConnection objects.
 *
 * Produces: MultiplayerConnection (from kingdomino-protocol).
 * Does not know about: game rules, seed commitment, player actors.
 */
export class PeerSession {
  private readonly peer: Peer;
  readonly ready: Promise<string>;
  private myId: string | null = null;

  constructor({ host, port, path = "/api/peers" }: PeerSessionOptions) {
    this.peer = new Peer(undefined, {
      host,
      port,
      path,
      key: "default",
    });

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
  async connect(remotePeerId: string): Promise<MultiplayerConnection> {
    const myId = await this.ready;
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
```

- [ ] **Step 4: Run tests to verify registration tests pass**

Run: `cd packages/kingdomino-lobby && npm test`
Expected: PASS for all "registration" tests.

- [ ] **Step 5: Commit**

```bash
git add packages/kingdomino-lobby/src/peer.session.ts packages/kingdomino-lobby/src/peer.session.test.ts
git commit -m "feat(lobby): add PeerSession with registration"
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Task 4: PeerSession — peer discovery

**Files:**
- Modify: `packages/kingdomino-lobby/src/peer.session.test.ts`

- [ ] **Step 1: Add failing discovery tests**

Append to `packages/kingdomino-lobby/src/peer.session.test.ts`:
```typescript
describe("PeerSession — peer discovery", () => {
  beforeEach(() => {
    // Reset fetch mock before each test
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
```

- [ ] **Step 2: Run tests to confirm they pass**

Run: `cd packages/kingdomino-lobby && npm test`
Expected: PASS (discovery is already implemented in PeerSession from Task 3).

- [ ] **Step 3: Commit**

```bash
git add packages/kingdomino-lobby/src/peer.session.test.ts
git commit -m "test(lobby): add peer discovery tests"
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Task 5: PeerSession — outbound WebRTC connection

**Files:**
- Modify: `packages/kingdomino-lobby/src/peer.session.test.ts`

- [ ] **Step 1: Add failing outbound connection tests**

Append to `packages/kingdomino-lobby/src/peer.session.test.ts`:
```typescript
describe("PeerSession — outbound connection", () => {
  it("resolves with a MultiplayerConnection once the DataChannel opens", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("player-1");

    const connectPromise = session.connect("player-2");

    // Simulate DataChannel opening
    const fakeConn = lastPeer._outboundConnections[0];
    fakeConn.listeners.open.forEach((h) => h());

    const mc = await connectPromise;
    expect(mc).toBeDefined();
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

    const startMsg = { type: "START" };
    const waitPromise = mc.waitFor("START");
    fakeConn.listeners.data.forEach((h) => h(startMsg));

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
});
```

- [ ] **Step 2: Run tests to confirm they pass**

Run: `cd packages/kingdomino-lobby && npm test`
Expected: PASS — the wiring in `_wireConnection` satisfies these assertions.

- [ ] **Step 3: Commit**

```bash
git add packages/kingdomino-lobby/src/peer.session.test.ts
git commit -m "test(lobby): add outbound WebRTC connection tests"
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Task 6: PeerSession — inbound connection handling

**Files:**
- Modify: `packages/kingdomino-lobby/src/peer.session.test.ts`

- [ ] **Step 1: Add failing inbound connection tests**

Append to `packages/kingdomino-lobby/src/peer.session.test.ts`:
```typescript
describe("PeerSession — inbound connection", () => {
  it("calls the callback with a wired MultiplayerConnection when a peer connects", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("host-peer");

    const received: unknown[] = [];
    session.onIncomingConnection((conn) => received.push(conn));

    // Simulate incoming connection from a remote peer
    const inbound = new FakeDataConnection("remote-peer");
    lastPeer._emitIncomingConnection(inbound);
    inbound.listeners.open.forEach((h) => h());

    expect(received).toHaveLength(1);
    const mc = received[0] as MultiplayerConnection;
    expect(mc.peerIdentifiers.me).toBe("host-peer");
    expect(mc.peerIdentifiers.them).toBe("remote-peer");
  });
});
```

- [ ] **Step 2: Run tests — confirm pass**

Run: `cd packages/kingdomino-lobby && npm test`
Expected: PASS — `onIncomingConnection` is already implemented.

- [ ] **Step 3: Commit**

```bash
git add packages/kingdomino-lobby/src/peer.session.test.ts
git commit -m "test(lobby): add inbound connection handling tests"
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Task 7: PeerSession — destroy / cleanup

**Files:**
- Modify: `packages/kingdomino-lobby/src/peer.session.test.ts`

- [ ] **Step 1: Add destroy test**

Append to `packages/kingdomino-lobby/src/peer.session.test.ts`:
```typescript
describe("PeerSession — destroy", () => {
  it("calls peer.destroy() when PeerSession.destroy() is called", () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    session.destroy();
    expect(lastPeer.destroyed).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — confirm pass**

Run: `cd packages/kingdomino-lobby && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/kingdomino-lobby/src/peer.session.test.ts
git commit -m "test(lobby): add destroy/cleanup test"
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Task 8: Export public API

**Files:**
- Modify: `packages/kingdomino-lobby/src/index.ts`

- [ ] **Step 1: Update index.ts**

Replace the stub with:
```typescript
// kingdomino-lobby public API
//
// Produces wired MultiplayerConnection objects (from kingdomino-protocol).
// Callers wire up ConnectionManager, RemotePlayerActor, and CommitmentSeedProvider
// from the returned connections.
//
// Boundary: this package knows about network discovery and WebRTC.
// It does not know about game rules, seed commitment, or player actors.

export { PeerSession } from "./peer.session";
export type { PeerSessionOptions } from "./peer.session";
```

- [ ] **Step 2: TypeScript check**

Run: `cd packages/kingdomino-lobby && npm run tscheck`
Expected: no errors.

- [ ] **Step 3: Run all tests to verify still green**

Run: `cd packages/kingdomino-lobby && npm test`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/kingdomino-lobby/src/index.ts
git commit -m "feat(lobby): export public API"
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Task 9: DataConnection close propagates to MultiplayerConnection

This edge case — DataChannel closing destroying the MultiplayerConnection — is important for disconnect detection (architecture-report §8.10).

**Files:**
- Modify: `packages/kingdomino-lobby/src/peer.session.test.ts`

- [ ] **Step 1: Add close-propagation test**

Append to the "outbound connection" describe block in `peer.session.test.ts`:
```typescript
  it("destroys the MultiplayerConnection when the DataChannel closes", async () => {
    const session = new PeerSession({ host: "localhost", port: 3001 });
    lastPeer._emitOpen("player-1");

    const connectPromise = session.connect("player-2");
    const fakeConn = lastPeer._outboundConnections[0];
    fakeConn.listeners.open.forEach((h) => h());

    const mc = await connectPromise;

    // Connection is alive — waitFor should be pending
    const waitPromise = mc.waitFor("START");

    // Simulate DataChannel closing
    fakeConn.listeners.close.forEach((h) => h());

    // waitFor should reject because the connection was destroyed
    await expect(waitPromise).rejects.toThrow();
  });
```

- [ ] **Step 2: Run tests — confirm pass**

Run: `cd packages/kingdomino-lobby && npm test`
Expected: PASS — `_wireConnection` wires the `"close"` event to `conn.destroy()`.

- [ ] **Step 3: Final commit**

```bash
git add packages/kingdomino-lobby/src/peer.session.test.ts
git commit -m "test(lobby): add DataChannel close → MultiplayerConnection destroy test"
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Verification

After all tasks:

```bash
cd packages/kingdomino-lobby && npm test && npm run tscheck
```

Expected:
- All tests pass
- TypeScript reports no errors
- `index.ts` exports `PeerSession` and `PeerSessionOptions`

The package now covers all three responsibilities from architecture-report §9.5:
1. ✅ PeerJS client initialisation and registration (→ `PeerSession` constructor + `ready`)
2. ✅ Peer discovery (→ `discoverPeers()`)
3. ✅ WebRTC connection establishment producing wired `MultiplayerConnection` objects (→ `connect()` + `onIncomingConnection()`)
