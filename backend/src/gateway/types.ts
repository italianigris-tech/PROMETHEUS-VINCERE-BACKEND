/**
 * Prometheus Gateway & MCP Protocol Definitions
 * Strict contracts for Claude (MCP) and ChatGPT (OpenAPI Actions).
 */

export interface AuthContext {
  readonly authenticated: boolean;
  readonly userId: string;
  readonly tenantId: string;
  readonly permissions: readonly string[];
}

export interface ToolDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  readonly name: string;
  /**
   * Plain-intent description: No proprietary formulas, internal weights,
   * or algorithmic trade secrets may appear in this docstring.
   */
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required?: readonly string[];
  };
  readonly execute: (input: TInput, ctx: AuthContext) => Promise<TOutput>;
}

export interface McpJsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id?: string | number | null;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export interface McpJsonRpcSuccessResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly result: Record<string, unknown>;
}

export interface McpJsonRpcErrorResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly error: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

export type McpJsonRpcResponse = McpJsonRpcSuccessResponse | McpJsonRpcErrorResponse;
