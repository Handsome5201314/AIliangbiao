/**
 * MCP SSE Transport 管理器 — 支持旧版 HTTP+SSE 协议
 *
 * 维护 sessionId → session 的映射，支持多客户端连接。
 * 兼容 ModelScope 和其他使用旧版 SSE 协议的 MCP 客户端。
 */

import {
  createJsonRpcAuthError,
  logMcpToolCall,
  touchMcpApiKey,
  validateMcpApiKey,
} from '@/lib/mcp/auth';

import { handleToolCall, listTools } from './server-handlers';
import { shouldOpenMcpSseGet } from './accept';
import {
  DEFAULT_MCP_PROTOCOL_VERSION,
  getMcpResponseProtocolVersion,
  negotiateMcpProtocolVersion,
} from './protocol';

// ─── Session Store ──────────────────────────────────────────────
interface SessionState {
  controller: ReadableStreamDefaultController<Uint8Array>;
  pendingRequests: Map<string | number, (response: unknown) => void>;
  apiKeyId: string;
  userId: string | null;
}

const sessions = new Map<string, SessionState>();
const encoder = new TextEncoder();

// ─── 处理 GET 请求（建立 SSE 流）───────────────────────────────
export async function handleSseGet(request: Request): Promise<Response> {
  const apiKey = await validateMcpApiKey(request.headers.get('Authorization'));
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Invalid MCP API key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await touchMcpApiKey(apiKey.id);

  const accept = request.headers.get('Accept') || request.headers.get('accept') || '';
  if (!shouldOpenMcpSseGet(accept)) {
    const tools = await listTools();
    return new Response(
      JSON.stringify({
        service: 'Assessment Core MCP Endpoint',
        version: '1.0.0',
        status: 'active',
        transport: 'streamable-http-compatible',
        protocolVersion: DEFAULT_MCP_PROTOCOL_VERSION,
        endpoint: '/api/mcp',
        sessionHeader: 'X-Session-Id',
        ...tools,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const sessionId = crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // 存储会话状态
      sessions.set(sessionId, {
        controller,
        pendingRequests: new Map(),
        apiKeyId: apiKey.id,
        userId: apiKey.userId,
      });

      // 发送 endpoint 事件（MCP SSE 规范要求）
      sendSseEvent(controller, 'endpoint', '/api/mcp');

      console.log(`[MCP SSE] Session created: ${sessionId}`);
    },
    cancel() {
      sessions.delete(sessionId);
      console.log(`[MCP SSE] Session closed: ${sessionId}`);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: "keep-alive",
      'X-Accel-Buffering': 'no',
      'X-Session-Id': sessionId,
      'Mcp-Session-Id': sessionId,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'X-Session-Id, Mcp-Session-Id',
    },
  });
}

// ─── 处理 POST 请求（接收消息）──────────────────────────────────
export async function handleSsePost(request: Request): Promise<Response> {
  const sessionId =
    request.headers.get('X-Session-Id') ||
    request.headers.get('x-session-id') ||
    request.headers.get('Mcp-Session-Id') ||
    request.headers.get('mcp-session-id');

  if (!sessionId) {
    const apiKey = await validateMcpApiKey(request.headers.get('Authorization'));
    if (!apiKey) {
      return new Response(JSON.stringify(createJsonRpcAuthError(null)), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.text();
      const message = JSON.parse(body);
      const response = await handleJsonRpcMessage(message);
      const successfulToolCall = isSuccessfulToolCall(message, response);
      const successfulRequest = !isJsonRpcErrorResponse(response);

      if (successfulRequest) {
        await touchMcpApiKey(apiKey.id, successfulToolCall);
      }

      if (message.method === 'tools/call') {
        const params = message.params as { name?: string; arguments?: unknown };
        await logMcpToolCall({
          apiKeyId: apiKey.id,
          userId: apiKey.userId,
          toolName: params.name || 'unknown_tool',
          arguments: params.arguments,
          result: response,
          status: successfulToolCall ? 'SUCCESS' : 'ERROR',
          success: successfulToolCall,
          entrypoint: 'canonical',
        });
      }

      if (response === null) {
        return new Response(null, { status: 202 });
      }

      return new Response(JSON.stringify(response), {
        status: isJsonRpcErrorResponse(response) ? 400 : 200,
        headers: createJsonRpcHeaders(response),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const apiKey = await validateMcpApiKey(authHeader);
      if (!apiKey || apiKey.id !== session.apiKeyId) {
        return new Response(JSON.stringify(createJsonRpcAuthError(null)), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await request.text();
    const message = JSON.parse(body);

    // 处理 JSON-RPC 消息
    const response = await handleJsonRpcMessage(message);

    // 将响应发送到 SSE 流
    if (response) {
      sendSseEvent(session.controller, 'message', JSON.stringify(response));
      const successfulToolCall = isSuccessfulToolCall(message, response);
      const successfulRequest = !isJsonRpcErrorResponse(response);

      if (successfulRequest) {
        await touchMcpApiKey(session.apiKeyId, successfulToolCall);
      }

      if (message.method === 'tools/call') {
        const params = message.params as { name?: string; arguments?: unknown };
        await logMcpToolCall({
          apiKeyId: session.apiKeyId,
          userId: session.userId,
          toolName: params.name || 'unknown_tool',
          arguments: params.arguments,
          result: response,
          status: successfulToolCall ? 'SUCCESS' : 'ERROR',
          success: successfulToolCall,
          entrypoint: 'canonical',
        });
      }
    }

    return new Response(null, { status: 202 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── JSON-RPC 消息处理器 ────────────────────────────────────────
async function handleJsonRpcMessage(message: {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: unknown;
}): Promise<unknown | null> {
  const { jsonrpc, id, method, params } = message;

  // 验证 JSON-RPC 版本
  if (jsonrpc !== "2.0") {
    return createErrorResponse(id, -32600, "Invalid JSON-RPC version");
  }

  try {
    let result: unknown;

    switch (method) {
      case "initialize": {
        const requestedVersion =
          params && typeof params === 'object' && 'protocolVersion' in params
            ? (params as { protocolVersion?: unknown }).protocolVersion
            : undefined;

        result = {
          protocolVersion: negotiateMcpProtocolVersion(requestedVersion),
          capabilities: { tools: {} },
          serverInfo: {
            name: "ai-scale-engine",
            version: "0.1.0",
          },
        };
        break;
      }

      case "tools/list":
        result = await listTools();
        break;

      case "tools/call":
        result = await handleToolCall(params as { name: string; arguments: unknown });
        break;

      case "ping":
        result = {};
        break;

      // Compatibility with MCP SDK client connect sequence.
      case "initialized":
      case "notifications/initialized":
      case "notifications/cancelled":
        return null;

      default:
        return createErrorResponse(id, -32601, `Method not found: ${method}`);
    }

    return { jsonrpc: "2.0", id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(id, -32603, message);
  }
}

function isSuccessfulToolCall(
  message: { method?: string; params?: unknown },
  response: unknown
) {
  if (message.method !== 'tools/call') {
    return false;
  }

  if (!response || typeof response !== 'object' || 'error' in response) {
    return false;
  }

  const result = (response as { result?: { isError?: boolean } }).result;
  return !result?.isError;
}

function isJsonRpcErrorResponse(response: unknown) {
  return Boolean(response && typeof response === 'object' && 'error' in response);
}

function createJsonRpcHeaders(response: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const protocolVersion = getMcpResponseProtocolVersion(response);

  if (protocolVersion) {
    headers['MCP-Protocol-Version'] = protocolVersion;
  }

  return headers;
}

// ─── 辅助函数 ───────────────────────────────────────────────────
function sendSseEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: string,
  data: string
): void {
  const eventStr = `event: ${event}\ndata: ${data}\n\n`;
  controller.enqueue(encoder.encode(eventStr));
}

function createErrorResponse(
  id: string | number | undefined,
  code: number,
  message: string
) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  };
}
