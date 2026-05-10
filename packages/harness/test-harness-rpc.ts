import { spawn } from 'child_process'
import * as readline from 'readline'

const harness = spawn('node', ['--experimental-strip-types', 'packages/harness/harness.ts'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  cwd: process.cwd(),
})

const rl = readline.createInterface({
  input: harness.stdout!,
  terminal: false,
})

let requestId = 0

function sendRequest(method: string, params: any) {
  const id = ++requestId
  const request = {
    jsonrpc: '2.0',
    id,
    method,
    params,
  }
  console.log(`[request ${id}] ${method}`, JSON.stringify(params))
  harness.stdin!.write(JSON.stringify(request) + '\n')
  return new Promise((resolve) => {
    const handler = (line: string) => {
      try {
        const response = JSON.parse(line)
        if (response.id === id) {
          rl.off('line', handler)
          console.log(`[response ${id}]`, JSON.stringify(response, null, 2))
          resolve(response)
        }
      } catch (e) {}
    }
    rl.on('line', handler)
  })
}

async function test() {
  console.log('=== Test 1: new_game ===')
  await sendRequest('tools/call', {
    name: 'new_game',
    arguments: {
      seed: 42,
      players: [
        { id: 'p1', behavior: 'random' },
        { id: 'p2', behavior: 'passive' },
      ],
    },
  })

  console.log('\n=== Test 2: get_game_state ===')
  await sendRequest('tools/call', {
    name: 'get_game_state',
    arguments: {},
  })

  console.log('\n=== Test 3: new_game again ===')
  await sendRequest('tools/call', {
    name: 'new_game',
    arguments: {
      seed: 42,
      players: [
        { id: 'p1', behavior: 'random' },
        { id: 'p2', behavior: 'passive' },
      ],
    },
  })

  console.log('\n=== Test 4: get_game_state ===')
  await sendRequest('tools/call', {
    name: 'get_game_state',
    arguments: {},
  })

  harness.kill()
  process.exit(0)
}

test().catch(console.error)
