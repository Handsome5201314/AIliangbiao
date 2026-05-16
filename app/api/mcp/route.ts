/**
 * MCP SSE 鎺ュ彛 鈥?鍏煎鏃х増 HTTP+SSE 鍗忚
 *
 * 鍗曚釜绔偣鍚屾椂澶勭悊锛?
 * - GET锛氬缓绔?SSE 浜嬩欢娴?
 * - POST锛氭帴鏀跺拰澶勭悊 JSON-RPC 娑堟伅
 *
 * 绗﹀悎 MCP 2024-11 瑙勮寖锛屽吋瀹?ModelScope 绛夊鎴风銆?
 */

import {
  handleSseGet,
  handleSsePost,
} from "@/lib/mcp/transport";

export const dynamic = "force-dynamic";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Session-Id, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "X-Session-Id, Mcp-Session-Id",
};

function withCors(response: Response) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// GET锛氬缓绔?SSE 娴?
export async function GET(request: Request) {
  return withCors(await handleSseGet(request));
}

// POST锛氬鐞嗘秷鎭?
export async function POST(request: Request) {
  return withCors(await handleSsePost(request));
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
