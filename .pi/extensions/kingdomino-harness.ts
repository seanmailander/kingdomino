/**
 * Kingdomino Harness MCP Integration for pi
 *
 * Connects the Kingdomino game engine harness as an MCP server.
 * Registers all harness tools so the LLM can drive game sessions.
 *
 * Connection strategy:
 *   - Connects eagerly when the extension factory runs (covers hot-reload via /reload)
 *   - Also reconnects on session_start if the process died between reloads
 *   - Tools await ensureConnected() so they work even if connection is still in flight
 *
 * Usage:
 *   /harness-status   — show connection state + registered tool count
 *   /harness-restart  — kill and reconnect the harness process
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { spawn, type ChildProcess } from "child_process";

// ── JSON-RPC types ──────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params: unknown;
  id?: string | number;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  result?: T;
  error?: { code: number; message: string; data?: unknown };
  id?: string | number;
}

// ── KingdominoHarness ───────────────────────────────────────────────────────

class KingdominoHarness {
  private proc: ChildProcess | null = null;
  private buf = "";
  private reqId = 0;
  private pending = new Map<number, (r: JsonRpcResponse) => void>();
  private _ready = false;
  private _connecting: Promise<void> | null = null;

  // ── Connection ────────────────────────────────────────────────────────────

  /**
   * Ensure the harness process is running and verified.
   * Safe to call concurrently — multiple callers share one in-flight promise.
   */
  ensureConnected(harnessPath: string): Promise<void> {
    if (this._ready && this.proc) return Promise.resolve();
    if (this._connecting) return this._connecting;

    this._connecting = this._connect(harnessPath).finally(() => {
      this._connecting = null;
    });
    return this._connecting;
  }

  private async _connect(harnessPath: string): Promise<void> {
    // Kill stale process
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
      this._ready = false;
    }

    const proc = spawn("node", ["--experimental-strip-types", "harness.ts"], {
      cwd: harnessPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.on("error", (err) => {
      console.error("[Kingdomino] harness process error:", err.message);
      this._ready = false;
      this.proc = null;
    });

    proc.on("exit", (code) => {
      console.error(`[Kingdomino] harness process exited (code ${code})`);
      this._ready = false;
      this.proc = null;
    });

    proc.stdout?.on("data", (chunk: Buffer) => {
      this.buf += chunk.toString();
      this._drain();
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write("[Kingdomino harness] " + chunk.toString());
    });

    this.proc = proc;

    // Verify the server is up by calling tools/list
    await new Promise<void>((resolve, reject) => {
      const id = ++this.reqId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Harness startup timeout (10s) — tools/list never responded"));
      }, 10_000);

      this.pending.set(id, (resp) => {
        clearTimeout(timer);
        if (resp.error) {
          reject(new Error(`tools/list error: ${resp.error.message}`));
        } else {
          this._ready = true;
          resolve();
        }
      });

      proc.stdin?.write(
        JSON.stringify({ jsonrpc: "2.0", method: "tools/list", params: {}, id } as JsonRpcRequest) + "\n",
      );
    });
  }

  private _drain(): void {
    const lines = this.buf.split("\n");
    this.buf = lines.pop()!;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        const cb = this.pending.get(msg.id as number);
        if (cb) {
          this.pending.delete(msg.id as number);
          cb(msg);
        }
      } catch {
        console.error("[Kingdomino] unparseable harness response:", trimmed);
      }
    }
  }

  // ── RPC call ──────────────────────────────────────────────────────────────

  async call<T = unknown>(harnessToolName: string, args: unknown): Promise<T> {
    if (!this.proc || !this._ready) throw new Error("Harness not connected");

    const id = ++this.reqId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Harness call timed out: ${harnessToolName}`));
      }, 30_000);

      this.pending.set(id, (resp) => {
        clearTimeout(timer);
        if (resp.error) {
          const detail = resp.error.data != null ? `: ${JSON.stringify(resp.error.data)}` : "";
          reject(new Error(`${resp.error.message} (${resp.error.code})${detail}`));
        } else {
          resolve(resp.result as T);
        }
      });

      this.proc!.stdin!.write(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: { name: harnessToolName, arguments: args },
          id,
        } as JsonRpcRequest) + "\n",
      );
    });
  }

  // ── Status ────────────────────────────────────────────────────────────────

  isConnected(): boolean {
    return this._ready && this.proc !== null;
  }

  disconnect(): void {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
    this._ready = false;
    this._connecting = null;
  }
}

// ── Extension ───────────────────────────────────────────────────────────────

export default function kingdominoHarnessExtension(pi: ExtensionAPI) {
  const harness = new KingdominoHarness();
  const harnessDir = process.cwd() + "/packages/harness";

  // ── Helper: wrap a harness tool call ───────────────────────────────────

  async function callHarness(harnessName: string, params: unknown) {
    try {
      await harness.ensureConnected(harnessDir);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Harness connection failed: ${msg}` }],
      };
    }
    try {
      const result = await harness.call(harnessName, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Harness error [${harnessName}]: ${msg}` }],
      };
    }
  }

  // ── Register tools (TypeBox schemas so parameters are visible to LLM) ──

  pi.registerTool({
    name: "new_game",
    label: "New Game",
    description: "Start a new Kingdomino game with seeded RNG",
    parameters: Type.Object({
      seed: Type.Number({ description: "Random seed for determinism" }),
      players: Type.Array(
        Type.Object({
          id: Type.String({ description: "Player ID" }),
          behavior: Type.Union(
            [
              Type.Literal("random"),
              Type.Literal("passive"),
              Type.Literal("aggressive"),
              Type.Literal("scripted"),
              Type.Literal("cheater"),
            ],
            { description: "AI behavior" },
          ),
          script: Type.Optional(
            Type.Array(Type.String(), { description: "Scripted action list (required when behavior is 'scripted')" }),
          ),
        }),
        { description: "Array of player configs" },
      ),
    }),
    async execute(_id, params) { return callHarness("new_game", params); },
  });

  pi.registerTool({
    name: "get_game_state",
    label: "Get Game State",
    description: "Retrieve the full current game state",
    parameters: Type.Object({}),
    async execute(_id, _params) { return callHarness("get_game_state", {}); },
  });

  pi.registerTool({
    name: "take_action",
    label: "Take Action",
    description: "Execute a player action (pick, place, discard)",
    parameters: Type.Object({
      player_id: Type.String({ description: "Player ID" }),
      action: Type.String({ description: "Action name: pick | place | discard" }),
      params: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Action parameters" })),
    }),
    async execute(_id, params) { return callHarness("take_action", params); },
  });

  pi.registerTool({
    name: "auto_turn",
    label: "Auto Turn",
    description: "Auto-play one turn for a player using their behavior",
    parameters: Type.Object({
      player_id: Type.String({ description: "Player ID" }),
    }),
    async execute(_id, params) { return callHarness("auto_turn", params); },
  });

  pi.registerTool({
    name: "auto_play_until",
    label: "Auto Play Until",
    description: "Auto-play until a condition is met or max_turns reached",
    parameters: Type.Object({
      condition: Type.String({ description: "e.g. 'phase == finished'" }),
      max_turns: Type.Optional(Type.Number({ description: "Safety ceiling (default 200)" })),
    }),
    async execute(_id, params) { return callHarness("auto_play_until", params); },
  });

  pi.registerTool({
    name: "snapshot",
    label: "Snapshot",
    description: "Save a checkpoint of current game state",
    parameters: Type.Object({}),
    async execute(_id, _params) { return callHarness("snapshot", {}); },
  });

  pi.registerTool({
    name: "restore",
    label: "Restore",
    description: "Restore a saved game snapshot",
    parameters: Type.Object({
      snapshot_id: Type.String({ description: "Snapshot ID from snapshot()" }),
    }),
    async execute(_id, params) { return callHarness("restore", params); },
  });

  pi.registerTool({
    name: "get_legal_actions",
    label: "Get Legal Actions",
    description: "Query legal moves for a player",
    parameters: Type.Object({
      player_id: Type.String({ description: "Player ID" }),
    }),
    async execute(_id, params) { return callHarness("get_legal_actions", params); },
  });

  pi.registerTool({
    // Renamed from "rebuild" to avoid collision with pi's own /reload
    name: "harness_reload",
    label: "Harness Reload",
    description: "Recompile and hot-reload the harness engine (no connection drop)",
    parameters: Type.Object({}),
    async execute(_id, _params) { return callHarness("rebuild", {}); },
  });

  // ── Eager connection at factory-load time ────────────────────────────────
  // This covers hot-reload (/reload) where session_start won't fire again.
  harness.ensureConnected(harnessDir).then(() => {
    console.error("[Kingdomino] Harness connected at factory-load time");
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Kingdomino] Harness connection failed at load: ${msg}`);
  });

  // ── session_start: reconnect if needed + notify ──────────────────────────
  pi.on("session_start", async (_event, ctx) => {
    try {
      await harness.ensureConnected(harnessDir);
      ctx.ui.notify("✅ Kingdomino harness ready", "info");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.ui.notify(`❌ Harness unavailable: ${msg}`, "warning");
    }
  });

  // ── /harness-status ──────────────────────────────────────────────────────
  pi.registerCommand("harness-status", {
    description: "Show Kingdomino harness connection status",
    handler: async (_args, ctx) => {
      const status = harness.isConnected() ? "✅ Connected" : "❌ Disconnected";
      ctx.ui.notify(`Harness: ${status}`, "info");
    },
  });

  // ── /harness-restart ─────────────────────────────────────────────────────
  pi.registerCommand("harness-restart", {
    description: "Kill and reconnect the Kingdomino harness process",
    handler: async (_args, ctx) => {
      harness.disconnect();
      ctx.ui.notify("Reconnecting harness…", "info");
      try {
        await harness.ensureConnected(harnessDir);
        ctx.ui.notify("✅ Harness reconnected", "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`❌ Reconnect failed: ${msg}`, "warning");
      }
    },
  });

  // ── session_end: clean up ────────────────────────────────────────────────
  pi.on("session_end", async () => {
    harness.disconnect();
  });
}
