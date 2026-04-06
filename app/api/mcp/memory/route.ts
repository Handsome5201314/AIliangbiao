/**
 * 记忆中枢 MCP Skill - HTTP 端点
 * 
 * 这是一个独立的 MCP Server 端点，提供用户画像和记忆管理功能。
 * 可被 FastGPT、Coze、OpenClaw 等智能体平台作为 Skill 插件接入。
 */

import { NextResponse } from 'next/server';
import { memoryTools, handleMemoryToolCall } from '@/lib/mcp/skills/memory/handlers';

export const dynamic = 'force-dynamic';

/**
 * POST 处理器 - 接收 MCP JSON-RPC 请求
 * 
 * 支持的方法：
 * - tools/list: 返回可用工具列表
 * - tools/call: 执行工具调用
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { method, params, id } = body;

    console.log(`[Memory MCP] Received: ${method}`);

    // 1. 响应工具列表请求
    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { tools: memoryTools }
      });
    }

    // 2. 响应工具调用请求
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      
      console.log(`[Memory MCP] Calling tool: ${name}`);
      
      const result = await handleMemoryToolCall(name, args);
      
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result) }]
        }
      });
    }

    // 3. 方法不存在
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method not found" }
    }, { status: 404 });

  } catch (error) {
    console.error("[Memory MCP Error]:", error);
    
    return NextResponse.json({
      jsonrpc: "2.0",
      id: (await req.json().catch(() => ({}))).id,
      error: { 
        code: -32603, 
        message: error instanceof Error ? error.message : "Internal Server Error" 
      }
    }, { status: 500 });
  }
}

/**
 * GET 处理器 - 返回服务状态（可选）
 */
export async function GET() {
  return NextResponse.json({
    service: "Memory Skill",
    version: "1.0.0",
    status: "active",
    tools: memoryTools.map(t => t.name)
  });
}
