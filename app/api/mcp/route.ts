/**
 * MCP SSE 接口 — 兼容旧版 HTTP+SSE 协议
 *
 * 单个端点同时处理：
 * - GET：建立 SSE 事件流
 * - POST：接收和处理 JSON-RPC 消息
 *
 * 符合 MCP 2024-11 规范，兼容 ModelScope 等客户端。
 */

import {
  handleSseGet,
  handleSsePost,
} from "@/lib/mcp/transport";

export const dynamic = "force-dynamic";

// GET：建立 SSE 流
export async function GET(request: Request) {
  return handleSseGet(request);
}

// POST：处理消息
export async function POST(request: Request) {
  return handleSsePost(request);
}
