import * as readline from 'readline';
/**
 * MCPServer — Minimal MCP protocol server over stdio.
 *
 * Handles JSON-RPC 2.0 messages on newline-delimited stdin,
 * responds on stdout. Supports tool registration and dispatch.
 */
export class MCPServer {
    name;
    version;
    tools;
    constructor(config) {
        this.name = config.name;
        this.version = config.version;
        this.tools = new Map();
    }
    /**
     * Register a tool with the server.
     */
    tool(name, schema, handler) {
        this.tools.set(name, { schema, handler });
    }
    /**
     * Start listening on stdin. Reads newline-delimited JSON-RPC messages.
     */
    listen() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        rl.on('line', async (line) => {
            if (!line.trim())
                return; // skip empty lines
            try {
                const request = JSON.parse(line);
                const response = await this.handleRequest(request);
                this.respond(response);
            }
            catch (error) {
                // Parsing error
                this.respond({
                    jsonrpc: '2.0',
                    error: {
                        code: -32700,
                        message: 'Parse error',
                        data: error instanceof Error ? error.message : String(error),
                    },
                });
            }
        });
        rl.on('close', () => {
            process.exit(0);
        });
    }
    /**
     * Handle a single JSON-RPC request.
     */
    async handleRequest(request) {
        const { method, params, id } = request;
        // Handle initialize request
        if (method === 'initialize') {
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    serverInfo: {
                        name: this.name,
                        version: this.version,
                    },
                },
            };
        }
        // Handle tools/list request
        if (method === 'tools/list') {
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    tools: Array.from(this.tools.values()).map((t) => t.schema),
                },
            };
        }
        // Handle tools/call request
        if (method === 'tools/call') {
            const { name, arguments: toolArgs } = params;
            if (!name) {
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32602,
                        message: 'Invalid params: missing tool name',
                    },
                };
            }
            const toolEntry = this.tools.get(name);
            if (!toolEntry) {
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Tool not found: ${name}`,
                    },
                };
            }
            try {
                const result = await toolEntry.handler(toolArgs || {});
                return {
                    jsonrpc: '2.0',
                    id,
                    result,
                };
            }
            catch (error) {
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32603,
                        message: 'Internal error',
                        data: error instanceof Error ? error.message : String(error),
                    },
                };
            }
        }
        // Method not found
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code: -32601,
                message: `Method not found: ${method}`,
            },
        };
    }
    /**
     * Write a JSON-RPC response to stdout (newline-delimited).
     */
    respond(response) {
        process.stdout.write(JSON.stringify(response) + '\n');
    }
}
//# sourceMappingURL=mcp.js.map