import * as readline from 'readline'

/**
 * Tool schema for MCP server. Describes tool name, input type, and description.
 */
interface ToolSchema {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, unknown>
    required?: string[]
  }
}

/**
 * Handler function for a tool call.
 * Receives parsed input, returns structured result.
 */
type ToolHandler = (input: Record<string, unknown>) => unknown | Promise<unknown>

/**
 * JSON-RPC 2.0 Request
 */
interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number
  method: string
  params?: Record<string, unknown>
}

/**
 * JSON-RPC 2.0 Response (success)
 */
interface JsonRpcSuccess {
  jsonrpc: '2.0'
  id?: string | number
  result: unknown
}

/**
 * JSON-RPC 2.0 Response (error)
 */
interface JsonRpcError {
  jsonrpc: '2.0'
  id?: string | number
  error: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * MCPServer — Minimal MCP protocol server over stdio.
 *
 * Handles JSON-RPC 2.0 messages on newline-delimited stdin,
 * responds on stdout. Supports tool registration and dispatch.
 */
export class MCPServer {
  private name: string
  private version: string
  private tools: Map<string, { schema: ToolSchema; handler: ToolHandler }>

  constructor(config: { name: string; version: string }) {
    this.name = config.name
    this.version = config.version
    this.tools = new Map()
  }

  /**
   * Register a tool with the server.
   */
  tool(name: string, schema: ToolSchema, handler: ToolHandler): void {
    this.tools.set(name, { schema, handler })
  }

  /**
   * Start listening on stdin. Reads newline-delimited JSON-RPC messages.
   */
  listen(): void {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    })

    rl.on('line', async (line: string) => {
      if (!line.trim()) return // skip empty lines

      try {
        const request = JSON.parse(line) as JsonRpcRequest
        const response = await this.handleRequest(request)
        this.respond(response)
      } catch (error) {
        // Parsing error
        this.respond({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : String(error),
          },
        })
      }
    })

    rl.on('close', () => {
      process.exit(0)
    })
  }

  /**
   * Handle a single JSON-RPC request.
   */
  private async handleRequest(request: JsonRpcRequest): Promise<JsonRpcSuccess | JsonRpcError> {
    const { method, params, id } = request

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
      }
    }

    // Handle tools/list request
    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: Array.from(this.tools.values()).map((t) => t.schema),
        },
      }
    }

    // Handle tools/call request
    if (method === 'tools/call') {
      const { name, arguments: toolArgs } = params as {
        name?: string
        arguments?: Record<string, unknown>
      }

      if (!name) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: 'Invalid params: missing tool name',
          },
        }
      }

      const toolEntry = this.tools.get(name)
      if (!toolEntry) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Tool not found: ${name}`,
          },
        }
      }

      try {
        const result = await toolEntry.handler(toolArgs || {})
        return {
          jsonrpc: '2.0',
          id,
          result,
        }
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error),
          },
        }
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
    }
  }

  /**
   * Write a JSON-RPC response to stdout (newline-delimited).
   */
  private respond(response: JsonRpcSuccess | JsonRpcError): void {
    process.stdout.write(JSON.stringify(response) + '\n')
  }
}
