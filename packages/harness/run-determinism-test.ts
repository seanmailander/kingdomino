/**
 * Determinism test: run seed=42 three times, verify identical results.
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── JSON-RPC helpers ────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params: unknown
  id: number
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  result?: unknown
  error?: { code: number; message: string }
  id: number
}

class HarnessClient {
  private proc = spawn('node', ['--experimental-strip-types', 'mcp-server.ts'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  private buf = ''
  private id = 0
  private pending = new Map<number, (r: JsonRpcResponse) => void>()

  constructor() {
    this.proc.stdout!.on('data', (chunk: Buffer) => {
      this.buf += chunk.toString()
      const lines = this.buf.split('\n')
      this.buf = lines.pop()!
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const msg: JsonRpcResponse = JSON.parse(trimmed)
          const cb = this.pending.get(msg.id)
          if (cb) {
            this.pending.delete(msg.id)
            cb(msg)
          }
        } catch {}
      }
    })
    this.proc.stderr!.on('data', (d: Buffer) => {
      // suppress harness stderr unless debugging
    })
  }

  async call(method: string, params: unknown): Promise<unknown> {
    const id = ++this.id
    const req: JsonRpcRequest = { jsonrpc: '2.0', method, params, id }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timeout waiting for ${method} (id=${id})`))
      }, 30_000)
      this.pending.set(id, (resp) => {
        clearTimeout(timer)
        if (resp.error) reject(new Error(`${resp.error.message} (${resp.error.code})`))
        else resolve(resp.result)
      })
      this.proc.stdin!.write(JSON.stringify(req) + '\n')
    })
  }

  async tool(name: string, args: unknown): Promise<unknown> {
    return this.call('tools/call', { name, arguments: args })
  }

  kill() {
    this.proc.kill()
  }
}

// ── Run one full game ────────────────────────────────────────────────────────

async function runFullGame(seed: number): Promise<unknown> {
  const client = new HarnessClient()
  try {
    // Start game
    const startResult = await client.tool('new_game', {
      seed,
      players: [
        { id: 'p1', behavior: 'random' },
        { id: 'p2', behavior: 'random' },
      ],
    }) as any

    if (!startResult.ok) throw new Error(`new_game failed: ${JSON.stringify(startResult)}`)

    // Play to end
    const playResult = await client.tool('auto_play_until', {
      condition: 'phase == finished',
      max_turns: 2000,
    }) as any

    // Get final state
    const stateResult = await client.tool('get_game_state', {}) as any
    return stateResult.state
  } finally {
    client.kill()
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const SEED = 42
const RUNS = 3

console.log(`\n=== Determinism Test: seed=${SEED}, ${RUNS} runs ===\n`)

const results: unknown[] = []

for (let i = 0; i < RUNS; i++) {
  console.log(`Run ${i + 1}/${RUNS} …`)
  const state = await runFullGame(SEED)
  results.push(state)
  const s = state as any
  console.log(`  phase: ${s?.phase}`)
  if (s?.players) {
    for (const p of s.players) {
      console.log(`  ${p.id}: score=${p.score}`)
    }
  }
  console.log()
}

// ── Compare ──────────────────────────────────────────────────────────────────

const serialized = results.map((r) => JSON.stringify(r, null, 2))

let allIdentical = true
for (let i = 1; i < RUNS; i++) {
  if (serialized[i] !== serialized[0]) {
    allIdentical = false
    console.error(`❌  Run ${i + 1} differs from Run 1`)
    // Show first difference
    const a = serialized[0].split('\n')
    const b = serialized[i].split('\n')
    for (let j = 0; j < Math.max(a.length, b.length); j++) {
      if (a[j] !== b[j]) {
        console.error(`   First diff at line ${j + 1}:`)
        console.error(`   Run 1 : ${a[j]}`)
        console.error(`   Run ${i + 1}: ${b[j]}`)
        break
      }
    }
  } else {
    console.log(`✅  Run ${i + 1} == Run 1`)
  }
}

if (allIdentical) {
  console.log(`\n✅  All ${RUNS} runs produced identical results. Seed=${SEED} is deterministic.\n`)
  process.exit(0)
} else {
  console.error(`\n❌  Runs are NOT identical — game is non-deterministic!\n`)
  process.exit(1)
}
