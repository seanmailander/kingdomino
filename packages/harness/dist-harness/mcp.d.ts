/**
 * Tool schema for MCP server. Describes tool name, input type, and description.
 */
interface ToolSchema {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
    };
}
/**
 * Handler function for a tool call.
 * Receives parsed input, returns structured result.
 */
type ToolHandler = (input: Record<string, unknown>) => unknown | Promise<unknown>;
/**
 * MCPServer — Minimal MCP protocol server over stdio.
 *
 * Handles JSON-RPC 2.0 messages on newline-delimited stdin,
 * responds on stdout. Supports tool registration and dispatch.
 */
export declare class MCPServer {
    private name;
    private version;
    private tools;
    constructor(config: {
        name: string;
        version: string;
    });
    /**
     * Register a tool with the server.
     */
    tool(name: string, schema: ToolSchema, handler: ToolHandler): void;
    /**
     * Start listening on stdin. Reads newline-delimited JSON-RPC messages.
     */
    listen(): void;
    /**
     * Handle a single JSON-RPC request.
     */
    private handleRequest;
    /**
     * Write a JSON-RPC response to stdout (newline-delimited).
     */
    private respond;
}
export {};
//# sourceMappingURL=mcp.d.ts.map