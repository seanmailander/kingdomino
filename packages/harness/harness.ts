/**
 * Lifecycle wrapper for the MCP server.
 *
 * Responsibilities:
 * 1. Run tsc to compile TypeScript
 * 2. Spawn the MCP server as a child process
 * 3. Proxy all stdio between the agent and child process
 * 4. Intercept "rebuild" tool calls
 * 5. On rebuild: kill child, recompile, relaunch (without closing the agent connection)
 *
 * The agent sees this wrapper as the MCP server. The actual server is hidden.
 * The rebuild tool is handled by the wrapper, never reaching the child.
 */

import { spawn, ChildProcess } from 'child_process'
import { execSync } from 'child_process'
import * as readline from 'readline'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// ── Configuration ───────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const HARNESS_DIR = dirname(__filename)
const DIST_DIR = `${HARNESS_DIR}/dist-harness`
const SERVER_ENTRY = `${DIST_DIR}/mcp-server.js`
const TSCONFIG = `${HARNESS_DIR}/tsconfig.json`

// ── State ───────────────────────────────────────────────────────────────────

let serverProcess: ChildProcess | null = null
let isRebuildInProgress = false

// ── Build & Launch ──────────────────────────────────────────────────────────

/**
 * Compile TypeScript.
 */
function build(): void {
  console.error('[harness] Compiling TypeScript...')
  try {
    execSync(`npx tsc -p ${TSCONFIG}`, {
      stdio: ['pipe', 'pipe', 'inherit'],
      cwd: HARNESS_DIR,
    })
    console.error('[harness] Build succeeded')
  } catch (error) {
    console.error('[harness] Build failed:', error)
    throw error
  }
}

/**
 * Spawn the MCP server child process.
 */
function launchServer(): ChildProcess {
  console.error('[harness] Launching server...')
  const proc = spawn('node', [SERVER_ENTRY], {
    stdio: ['pipe', 'pipe', 'inherit'],
    cwd: HARNESS_DIR,
  })

  proc.on('error', (error) => {
    console.error('[harness] Server error:', error)
    process.exit(1)
  })

  proc.on('exit', (code) => {
    console.error(`[harness] Server exited with code ${code}`)
    if (!isRebuildInProgress) {
      process.exit(code || 0)
    }
  })

  console.error('[harness] Server launched')
  return proc
}

/**
 * Kill the server process gracefully.
 */
function killServer(): void {
  if (serverProcess) {
    console.error('[harness] Killing server...')
    serverProcess.kill('SIGTERM')
    serverProcess = null
  }
}

/**
 * Rebuild: compile and relaunch without closing the wrapper's connection.
 */
async function rebuild(): Promise<void> {
  console.error('[harness] Rebuild requested')
  isRebuildInProgress = true
  try {
    killServer()
    build()
    serverProcess = launchServer()
  } finally {
    isRebuildInProgress = false
  }
}

// ── JSON-RPC Message Handling ───────────────────────────────────────────────

/**
 * Parse a JSON-RPC message and check if it's a rebuild request.
 */
function isRebuildRequest(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) {
    return false
  }
  const msg = message as Record<string, unknown>
  const params = msg.params as Record<string, unknown> | undefined
  return params?.name === 'rebuild'
}

/**
 * Create a response to the rebuild tool call.
 */
function createRebuildResponse(id: unknown): unknown {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      ok: true,
      rebuilt: true,
    },
  }
}

// ── Main: Proxy stdin ↔ child process ───────────────────────────────────────

async function main(): Promise<void> {
  console.error('[harness] Starting...')

  // Initial build and launch
  build()
  serverProcess = launchServer()

  // Set up readline for stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })

  rl.on('line', async (line: string) => {
    if (!line.trim()) {
      return
    }

    try {
      const request = JSON.parse(line)

      // Check for rebuild request
      if (isRebuildRequest(request)) {
        await rebuild()
        const response = createRebuildResponse(request.id)
        process.stdout.write(JSON.stringify(response) + '\n')
        return
      }

      // Forward to server
      if (serverProcess && serverProcess.stdin) {
        serverProcess.stdin.write(line + '\n')
      }
    } catch (error) {
      console.error('[harness] Error handling line:', error)
    }
  })

  rl.on('close', () => {
    console.error('[harness] Input closed')
    killServer()
    process.exit(0)
  })

  // Forward server output to stdout
  if (serverProcess && serverProcess.stdout) {
    serverProcess.stdout.on('data', (data) => {
      process.stdout.write(data)
    })
  }
}

// ── Entry point ─────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('[harness] Fatal error:', error)
  killServer()
  process.exit(1)
})
