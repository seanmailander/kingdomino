import { GameSession, Player } from 'kingdomino-engine'

// Direct engine usage — creates two games and inspects their state.
// Note: seeded determinism requires driving rounds via the MCP harness
// (new_game → auto_play_until). Direct GameSession construction uses an
// internal unseeded deck shuffle, so scores are not guaranteed to match.

console.log('Creating game A...')
const game = new GameSession()
game.addPlayer(new Player('p1'))
game.addPlayer(new Player('p2'))
game.startGame()

console.log('Game A phase:', game.phase)
console.log('Number of players:', game.players.length)
console.log('P1 score:', game.players[0].score())
console.log('P2 score:', game.players[1].score())

console.log('\nCreating game B...')
const game2 = new GameSession()
game2.addPlayer(new Player('p1'))
game2.addPlayer(new Player('p2'))
game2.startGame()

console.log('Game B phase:', game2.phase)
console.log('P1 score:', game2.players[0].score())
console.log('P2 score:', game2.players[1].score())
