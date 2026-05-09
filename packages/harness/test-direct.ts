import { GameSession, Player } from 'kingdomino-engine'
import { createRng } from './seed.ts'

// Test 1: Create a game directly
console.log('Creating game with seed 42...')
const rng = createRng(42)
const game = new GameSession()
const p1 = new Player('p1')
const p2 = new Player('p2')
game.addPlayer(p1)
game.addPlayer(p2)
game.startGame()

console.log('Game phase:', game.phase)
console.log('Number of players:', game.players.length)
console.log('P1 score:', p1.score())
console.log('P2 score:', p2.score())

// Test 2: Create another game with same seed
console.log('\nCreating second game with seed 42...')
const rng2 = createRng(42)
const game2 = new GameSession()
const p1b = new Player('p1')
const p2b = new Player('p2')
game2.addPlayer(p1b)
game2.addPlayer(p2b)
game2.startGame()

console.log('Game2 phase:', game2.phase)
console.log('P1 score:', p1b.score())
console.log('P2 score:', p2b.score())

console.log('\nDeterminism check:')
console.log('Scores match:', p1.score() === p1b.score() && p2.score() === p2b.score())
