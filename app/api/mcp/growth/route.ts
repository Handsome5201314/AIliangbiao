/**
 * 新生儿生长曲线 MCP Skill - HTTP 端点
 * 
 * 这是一个独立的 MCP Server 端点，提供WHO标准生长曲线评估功能。
 * 可被 FastGPT、Coze、OpenClaw 等智能体平台作为 Skill 插件接入。
 */

import { NextResponse } from 'next/server';
import { growthTools, handleGrowthToolCall } from '@/lib/mcp/skills/growth/handlers';

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

    console.log(`[Growth MCP] Received: ${method}`);

    // 1. 响应工具列表请求
    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { tools: growthTools }
      });
    }

    // 2. 响应工具调用请求
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      
      console.log(`[Growth MCP] Calling tool: ${name}`);
      
      const result = await handleGrowthToolCall(name, args);
      
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
    console.error("[Growth MCP Error]:", error);
    
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { 
        code: -32603, 
        message: error instanceof Error ? error.message : "Internal Server Error" 
      }
    }, { status: 500 });
  }
}

/**
 * GET 处理器 - 返回服务状态
 */
export async function GET() {
  return NextResponse.json({
    service: "Growth Curve Skill",
    version: "1.0.0",
    status: "active",
    description: "WHO标准新生儿生长曲线评估服务",
    tools: growthTools.map(t => ({
      name: t.name,
      description: t.description
    }))
  });
}
