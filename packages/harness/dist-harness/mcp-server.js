/**
 * MCP Server for Kingdomino game harness.
 *
 * Imports the game engine directly and manages game state.
 * Exposes structured tools for game orchestration and testing.
 *
 * All game state lives in module scope — single source of truth.
 * All responses are structured JSON (never prose errors).
 * Randomness is always seeded and deterministic.
 */
import { MCPServer } from './mcp';
import { createRng } from './seed';
import { resolveBehavior } from './behaviors';
import { GameSession, Player, STANDARD, up, down, left, right, } from 'kingdomino-engine';
// ── Module-scope state ──────────────────────────────────────────────────────
/**
 * Single game session. Null until new_game is called.
 */
let gameSession = null;
/**
 * Seeded RNG. Created when new_game is called with a seed.
 */
let rng = null;
/**
 * Registry of player behaviors, keyed by player ID.
 */
const behaviorRegistry = new Map();
/**
 * Store snapshots of serialized game state (not the session object).
 * This ensures snapshots are plain data that survive serialization.
 */
const stateSnapshots = new Map();
let nextSnapshotIndex = 0;
// ── MCP Server setup ────────────────────────────────────────────────────────
const server = new MCPServer({
    name: 'kingdomino-game-harness',
    version: '0.1.0',
});
// ── Helper: Serialize game state ────────────────────────────────────────────
/**
 * Convert GameSession to a JSON-serializable state object.
 * This is what the agent sees as "the game state".
 */
function serializeGameState(session) {
    const players = session.players.map((p) => ({
        id: p.id,
        board: p.board.snapshot(),
        score: p.score(),
    }));
    return {
        phase: session.phase,
        players,
        currentRound: session.currentRound
            ? {
                phase: session.currentRound.phase,
                deal: session.currentRound.deal
                    ? {
                        cards: session.currentRound.deal.cards,
                    }
                    : null,
                pickOrder: session.currentRound.pickOrder?.map((p) => p.id) ?? [],
            }
            : null,
        variant: session.variant,
    };
}
// ── Helper: Get legal actions ───────────────────────────────────────────────
/**
 * Determine what actions a player can legally take.
 * Returns action objects with name and optional params.
 */
function getLegalActionsForPlayer(session, playerId) {
    const player = session.players.find((p) => p.id === playerId);
    if (!player) {
        return [];
    }
    const actions = [];
    const round = session.currentRound;
    if (!round) {
        return [];
    }
    // In picking phase, player can pick a card if it's their turn
    if (round.phase === 'picking') {
        const deal = round.deal;
        if (deal && deal.cards) {
            const pickOrder = round.pickOrder;
            const currentPlayer = pickOrder?.[0]; // First in pick order is current
            if (currentPlayer && currentPlayer.id === playerId) {
                // All cards in the deal are legal picks
                for (const card of deal.cards) {
                    actions.push({
                        action: 'pick',
                        params: { cardId: card },
                    });
                }
            }
        }
    }
    // In placing phase, player can place their drafted card
    if (round.phase === 'placing') {
        const placingPlayer = round.placingPlayer;
        if (placingPlayer && placingPlayer.id === playerId) {
            // For now, return a generic "place" action
            // In a real implementation, this would validate board positions
            actions.push({
                action: 'place',
                params: { x: 0, y: 0, direction: 'N' },
            });
        }
    }
    return actions;
}
// ── Tool: new_game ─────────────────────────────────────────────────────────
/**
 * Initialize a new game with seeded random and player behaviors.
 *
 * @param seed - Seed for deterministic randomness
 * @param players - Array of player configs: { id, behavior, script? }
 */
server.tool('new_game', {
    name: 'new_game',
    description: 'Initialize a new game with seeded randomness and player behaviors',
    inputSchema: {
        type: 'object',
        properties: {
            seed: {
                type: 'number',
                description: 'Seed for deterministic randomness',
            },
            players: {
                type: 'array',
                description: 'Array of player configurations',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Player ID' },
                        behavior: {
                            type: 'string',
                            enum: ['scripted', 'random', 'passive', 'aggressive', 'cheater'],
                        },
                        script: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Script for scripted behavior',
                        },
                    },
                    required: ['id', 'behavior'],
                },
            },
        },
        required: ['seed', 'players'],
    },
}, async (input) => {
    const { seed, players: playerConfigs } = input;
    // Clear old state
    behaviorRegistry.clear();
    stateSnapshots.clear();
    nextSnapshotIndex = 0;
    // Create seeded RNG
    rng = createRng(seed);
    // Create session
    gameSession = new GameSession({
        variant: STANDARD,
        bonuses: {},
    });
    // Add players and register behaviors
    for (const playerConfig of playerConfigs) {
        const player = new Player(playerConfig.id);
        gameSession.addPlayer(player);
        // Resolve and register behavior
        const behaviorSpec = playerConfig.behavior === 'scripted'
            ? { behavior: 'scripted', script: playerConfig.script || [] }
            : { behavior: playerConfig.behavior };
        const behavior = resolveBehavior(behaviorSpec);
        behaviorRegistry.set(playerConfig.id, behavior);
    }
    // Start the game
    gameSession.startGame();
    const state = serializeGameState(gameSession);
    return {
        ok: true,
        state,
    };
});
// ── Tool: get_game_state ────────────────────────────────────────────────────
server.tool('get_game_state', {
    name: 'get_game_state',
    description: 'Get the current full game state',
    inputSchema: {
        type: 'object',
        properties: {},
    },
}, async () => {
    if (!gameSession) {
        return {
            ok: false,
            error: 'No game session',
        };
    }
    const state = serializeGameState(gameSession);
    return {
        state,
    };
});
// ── Tool: get_player_state ──────────────────────────────────────────────────
server.tool('get_player_state', {
    name: 'get_player_state',
    description: 'Get private state for a specific player',
    inputSchema: {
        type: 'object',
        properties: {
            player_id: {
                type: 'string',
                description: 'Player ID',
            },
        },
        required: ['player_id'],
    },
}, async (input) => {
    const { player_id: playerId } = input;
    if (!gameSession) {
        return {
            ok: false,
            error: 'No game session',
        };
    }
    const player = gameSession.players.find((p) => p.id === playerId);
    if (!player) {
        return {
            ok: false,
            error: 'Player not found',
        };
    }
    return {
        player: {
            id: player.id,
            board: player.board.snapshot(),
            score: player.score(),
        },
    };
});
// ── Tool: get_legal_actions ─────────────────────────────────────────────────
server.tool('get_legal_actions', {
    name: 'get_legal_actions',
    description: 'Get legal actions for a player',
    inputSchema: {
        type: 'object',
        properties: {
            player_id: {
                type: 'string',
                description: 'Player ID',
            },
        },
        required: ['player_id'],
    },
}, async (input) => {
    const { player_id: playerId } = input;
    if (!gameSession) {
        return {
            ok: false,
            error: 'No game session',
        };
    }
    const actions = getLegalActionsForPlayer(gameSession, playerId);
    return {
        actions,
    };
});
// ── Tool: take_action ───────────────────────────────────────────────────────
/**
 * Apply an action and return the new state.
 * On invalid action, return structured error.
 */
server.tool('take_action', {
    name: 'take_action',
    description: 'Apply an action to the game state',
    inputSchema: {
        type: 'object',
        properties: {
            player_id: {
                type: 'string',
                description: 'Player ID',
            },
            action: {
                type: 'string',
                description: 'Action name',
            },
            params: {
                type: 'object',
                description: 'Action parameters',
            },
        },
        required: ['player_id', 'action'],
    },
}, async (input) => {
    const { player_id: playerId, action, params } = input;
    if (!gameSession) {
        return {
            ok: false,
            error: 'No game session',
        };
    }
    // Check legality first
    const legalActions = getLegalActionsForPlayer(gameSession, playerId);
    const isLegal = legalActions.some((a) => a.action === action);
    if (!isLegal) {
        return {
            ok: false,
            error: `Illegal action: ${action}`,
            reason: 'action_not_legal',
            legal_actions: legalActions,
        };
    }
    // Apply action
    try {
        if (action === 'pick' && params?.cardId) {
            gameSession.handlePick(playerId, params.cardId);
        }
        else if (action === 'place' && params?.x !== undefined && params?.y !== undefined && params?.direction) {
            const directionStr = params.direction;
            const directionMap = {
                up,
                down,
                left,
                right,
            };
            const direction = directionMap[directionStr];
            if (!direction) {
                return {
                    ok: false,
                    error: `Invalid direction: ${directionStr}`,
                    reason: 'invalid_params',
                    legal_actions: legalActions,
                };
            }
            gameSession.handlePlacement(playerId, params.x, params.y, direction);
        }
        else {
            return {
                ok: false,
                error: `Unknown action: ${action}`,
                reason: 'unknown_action',
                legal_actions: legalActions,
            };
        }
        const state = serializeGameState(gameSession);
        return {
            ok: true,
            state,
        };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            reason: 'action_failed',
            legal_actions: legalActions,
        };
    }
});
// ── Tool: snapshot ──────────────────────────────────────────────────────────
server.tool('snapshot', {
    name: 'snapshot',
    description: 'Save a snapshot of the current game state',
    inputSchema: {
        type: 'object',
        properties: {},
    },
}, async () => {
    try {
        if (!gameSession) {
            return {
                ok: false,
                error: 'No game session',
            };
        }
        const state = serializeGameState(gameSession);
        const id = String(nextSnapshotIndex++);
        stateSnapshots.set(id, structuredClone(state));
        return {
            snapshot_id: id,
        };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
});
// ── Tool: restore ───────────────────────────────────────────────────────────
server.tool('restore', {
    name: 'restore',
    description: 'Restore a previously snapshotted game state',
    inputSchema: {
        type: 'object',
        properties: {
            snapshot_id: {
                type: 'string',
                description: 'Snapshot ID',
            },
        },
        required: ['snapshot_id'],
    },
}, async (input) => {
    const { snapshot_id: snapshotId } = input;
    try {
        const state = stateSnapshots.get(snapshotId);
        if (!state) {
            return {
                ok: false,
                error: `Snapshot not found: ${snapshotId}`,
            };
        }
        return {
            ok: true,
            state: structuredClone(state),
        };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
});
// ── Helper: Evaluate dot-path condition ────────────────────────────────────
/**
 * Evaluate a dot-path expression against the serialized game state.
 * Examples: "is_game_over == true", "phase == 'playing'"
 *
 * For now, this is a simple implementation that checks existence and basic equality.
 * In a full version, this would be a proper expression parser.
 */
function evaluateCondition(state, condition) {
    // Very simple conditions for now
    // Format: "path.to.value == expectedValue"
    const parts = condition.split('==');
    if (parts.length !== 2) {
        return false;
    }
    const [pathPart, valuePart] = parts.map((p) => p.trim());
    const path = pathPart.split('.');
    let value = state;
    for (const key of path) {
        if (typeof value === 'object' && value !== null) {
            value = value[key];
        }
        else {
            return false;
        }
    }
    const expectedStr = valuePart.replace(/^['"]|['"]$/g, '');
    return String(value) === expectedStr;
}
// ── Tool: auto_turn ────────────────────────────────────────────────────────
/**
 * Automatically choose and apply an action for a player using their behavior.
 */
server.tool('auto_turn', {
    name: 'auto_turn',
    description: 'Automatically choose and apply an action for a player',
    inputSchema: {
        type: 'object',
        properties: {
            player_id: {
                type: 'string',
                description: 'Player ID',
            },
        },
        required: ['player_id'],
    },
}, async (input) => {
    const { player_id: playerId } = input;
    if (!gameSession || !rng) {
        return {
            ok: false,
            error: 'No game session',
        };
    }
    const behavior = behaviorRegistry.get(playerId);
    if (!behavior) {
        return {
            ok: false,
            error: `No behavior registered for player: ${playerId}`,
        };
    }
    try {
        // Get current state for behavior
        const state = serializeGameState(gameSession);
        // Ask behavior to choose an action
        const action = behavior.chooseAction(state, playerId, rng);
        // Convert action to take_action format
        const actionObj = action;
        const actionName = actionObj.action || String(action);
        const params = actionObj.params || {};
        // Apply the action
        const legalActions = getLegalActionsForPlayer(gameSession, playerId);
        const isLegal = legalActions.some((a) => a.action === actionName);
        if (!isLegal) {
            return {
                ok: false,
                error: `Behavior chose illegal action: ${actionName}`,
            };
        }
        if (actionName === 'pick' && params.cardId) {
            gameSession.handlePick(playerId, params.cardId);
        }
        else if (actionName === 'place' && params.x !== undefined && params.y !== undefined && params.direction) {
            const directionMap = { up, down, left, right };
            const direction = directionMap[params.direction];
            if (!direction) {
                return {
                    ok: false,
                    error: `Invalid direction: ${params.direction}`,
                };
            }
            gameSession.handlePlacement(playerId, params.x, params.y, direction);
        }
        const newState = serializeGameState(gameSession);
        return {
            ok: true,
            action: actionName,
            state: newState,
        };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
});
// ── Tool: auto_play_until ──────────────────────────────────────────────────
/**
 * Automatically play turns until a condition is met or max turns reached.
 */
server.tool('auto_play_until', {
    name: 'auto_play_until',
    description: 'Automatically play turns until a condition is met',
    inputSchema: {
        type: 'object',
        properties: {
            condition: {
                type: 'string',
                description: 'Condition expression (e.g., "phase == playing")',
            },
            max_turns: {
                type: 'number',
                description: 'Maximum turns to play (default: 200)',
            },
        },
        required: ['condition'],
    },
}, async (input) => {
    const { condition, max_turns = 200 } = input;
    if (!gameSession) {
        return {
            ok: false,
            error: 'No game session',
        };
    }
    let turnsPlayed = 0;
    let conditionMet = false;
    while (turnsPlayed < max_turns) {
        const state = serializeGameState(gameSession);
        // Check condition
        if (evaluateCondition(state, condition)) {
            conditionMet = true;
            break;
        }
        // Play a turn for each player
        for (const player of gameSession.players) {
            const behavior = behaviorRegistry.get(player.id);
            if (!behavior) {
                continue;
            }
            try {
                const currentState = serializeGameState(gameSession);
                const action = behavior.chooseAction(currentState, player.id, rng || (() => Math.random()));
                const actionObj = action;
                const actionName = actionObj.action || String(action);
                const params = actionObj.params || {};
                const legalActions = getLegalActionsForPlayer(gameSession, player.id);
                const isLegal = legalActions.some((a) => a.action === actionName);
                if (!isLegal) {
                    continue; // Skip illegal actions
                }
                if (actionName === 'pick' && params.cardId) {
                    gameSession.handlePick(player.id, params.cardId);
                }
                else if (actionName === 'place' && params.x !== undefined && params.y !== undefined && params.direction) {
                    const directionMap = { up, down, left, right };
                    const direction = directionMap[params.direction];
                    if (direction) {
                        gameSession.handlePlacement(player.id, params.x, params.y, direction);
                    }
                }
            }
            catch (error) {
                // Ignore errors in auto-play
                continue;
            }
        }
        turnsPlayed++;
    }
    const finalState = serializeGameState(gameSession);
    return {
        ok: true,
        turns_played: turnsPlayed,
        state: finalState,
        condition_met: conditionMet,
    };
});
// ── Tool: wait_for_state ───────────────────────────────────────────────────
/**
 * Validate that current state matches conditions (synchronous, no blocking).
 */
server.tool('wait_for_state', {
    name: 'wait_for_state',
    description: 'Validate that current state matches conditions',
    inputSchema: {
        type: 'object',
        properties: {
            phase: {
                type: 'string',
                description: 'Expected game phase',
            },
            player_id: {
                type: 'string',
                description: 'Expected current player ID',
            },
            timeout_turns: {
                type: 'number',
                description: 'Timeout in turns (for validation)',
            },
        },
    },
}, async (input) => {
    const { phase, player_id: expectedPlayerId } = input;
    if (!gameSession) {
        return {
            ok: false,
            error: 'No game session',
        };
    }
    const state = serializeGameState(gameSession);
    // Check phase
    if (phase && state.phase !== phase) {
        return {
            ok: false,
            error: `timeout`,
            state,
        };
    }
    return {
        ok: true,
        state,
    };
});
// ── Start server ────────────────────────────────────────────────────────────
server.listen();
//# sourceMappingURL=mcp-server.js.map