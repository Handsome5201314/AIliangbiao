/**
 * MCP SSE Transport 管理器 — 支持旧版 HTTP+SSE 协议
 *
 * 维护 sessionId → session 的映射，支持多客户端连接。
 * 兼容 ModelScope 和其他使用旧版 SSE 协议的 MCP 客户端。
 */

import { handleToolCall, listTools } from "./server-handlers";

// ─── Session Store ──────────────────────────────────────────────
interface SessionState {
  controller: ReadableStreamDefaultController<Uint8Array>;
  pendingRequests: Map<string | number, (response: unknown) => void>;
}

const sessions = new Map<string, SessionState>();
const encoder = new TextEncoder();

// ─── 处理 GET 请求（建立 SSE 流）───────────────────────────────
export function handleSseGet(): Response {
  const sessionId = crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // 存储会话状态
      sessions.set(sessionId, {
        controller,
        pendingRequests: new Map(),
      });

      // 发送 endpoint 事件（MCP SSE 规范要求）
      sendSseEvent(controller, "endpoint", "/api/mcp");

      console.log(`[MCP SSE] Session created: ${sessionId}`);
    },
    cancel() {
      sessions.delete(sessionId);
      console.log(`[MCP SSE] Session closed: ${sessionId}`);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Session-Id": sessionId,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ─── 处理 POST 请求（接收消息）──────────────────────────────────
export async function handleSsePost(request: Request): Promise<Response> {
  const sessionId = request.headers.get("X-Session-Id");

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "Missing X-Session-Id header" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.text();
    const message = JSON.parse(body);

    // 处理 JSON-RPC 消息
    const response = await handleJsonRpcMessage(message);

    // 将响应发送到 SSE 流
    if (response) {
      sendSseEvent(session.controller, "message", JSON.stringify(response));
    }

    return new Response(null, { status: 202 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ─── JSON-RPC 消息处理器 ────────────────────────────────────────
async function handleJsonRpcMessage(message: {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: unknown;
}): Promise<unknown> {
  const { jsonrpc, id, method, params } = message;

  // 验证 JSON-RPC 版本
  if (jsonrpc !== "2.0") {
    return createErrorResponse(id, -32600, "Invalid JSON-RPC version");
  }

  try {
    let result: unknown;

    switch (method) {
      case "initialize":
        result = {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "ai-scale-engine",
            version: "0.1.0",
          },
        };
        break;

      case "tools/list":
        result = await listTools();
        break;

      case "tools/call":
        result = await handleToolCall(params as { name: string; arguments: unknown });
        break;

      case "ping":
        result = {};
        break;

      default:
        return createErrorResponse(id, -32601, `Method not found: ${method}`);
    }

    return { jsonrpc: "2.0", id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(id, -32603, message);
  }
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
