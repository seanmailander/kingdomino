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
export {};
//# sourceMappingURL=harness.d.ts.map