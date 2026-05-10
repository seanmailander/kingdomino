import { spawn } from 'child_process'
import * as readline from 'readline'

interface GameState {
  phase: string
  players: Array<{ id: string; score: number }>
}

const harness = spawn('node', ['--experimental-strip-types', 'packages/harness/harness.ts'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  cwd: process.cwd(),
})

const rl = readline.createInterface({
  input: harness.stdout!,
  terminal: false,
})

let requestId = 0
const pendingRequests = new Map<number, (data: any) => void>()

function sendRequest(method: string, params: any): Promise<any> {
  return new Promise((resolve) => {
    const id = ++requestId
    const request = { jsonrpc: '2.0', id, method, params }
    pendingRequests.set(id, resolve)
    harness.stdin!.write(JSON.stringify(request) + '\n')
  })
}

rl.on('line', (line: string) => {
  try {
    const response = JSON.parse(line)
    if (response.id && pendingRequests.has(response.id)) {
      const resolve = pendingRequests.get(response.id)!
      pendingRequests.delete(response.id)
      resolve(response.result || response.error)
    }
  } catch (e) {}
})

async function runGame(seed: number): Promise<GameState> {
  await sendRequest('tools/call', {
    name: 'new_game',
    arguments: {
      seed,
      players: [
        { id: 'p1', behavior: 'random' },
        { id: 'p2', behavior: 'passive' },
      ],
    },
  })

  // Play to completion so final scores are meaningful
  const finalResp = await sendRequest('tools/call', {
    name: 'auto_play_until',
    arguments: { condition: 'phase == finished', max_turns: 500 },
  })

  const state = finalResp.state as any
  return {
    phase: state.phase,
    players: state.players.map((p: any) => ({ id: p.id, score: p.score })),
  }
}

async function test() {
  console.log('🧪 Testing Kingdomino Determinism with seed=42\n')

  const runs: GameState[] = []

  for (let i = 1; i <= 3; i++) {
    console.log(`▶️  Run ${i}`)
    const state = await runGame(42)
    runs.push(state)
    console.log(`   Phase: ${state.phase}`)
    console.log(`   P1 Score: ${state.players[0].score}`)
    console.log(`   P2 Score: ${state.players[1].score}`)
    console.log()
  }

  console.log('📊 Verification Results:\n')

  const run1 = runs[0]
  const run2 = runs[1]
  const run3 = runs[2]

  const phasesMatch = run1.phase === run2.phase && run2.phase === run3.phase
  const scores1Match =
    run1.players[0].score === run2.players[0].score &&
    run2.players[0].score === run3.players[0].score
  const scores2Match =
    run1.players[1].score === run2.players[1].score &&
    run2.players[1].score === run3.players[1].score

  console.log(
    `✅ Phases identical (all "${run1.phase}"): ${phasesMatch ? '✓' : '✗'}`,
  )
  console.log(
    `✅ P1 scores identical (${run1.players[0].score}): ${scores1Match ? '✓' : '✗'}`,
  )
  console.log(
    `✅ P2 scores identical (${run1.players[1].score}): ${scores2Match ? '✓' : '✗'}`,
  )

  const allMatch = phasesMatch && scores1Match && scores2Match
  console.log(`\n${allMatch ? '🎉 DETERMINISM VERIFIED' : '❌ DETERMINISM FAILED'}`)

  harness.kill()
  process.exit(allMatch ? 0 : 1)
}

test().catch(console.error)
