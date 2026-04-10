/**
 * 记忆中枢 MCP Skill - HTTP 端点
 * 
 * 这是一个独立的 MCP Server 端点，提供用户画像和记忆管理功能。
 * 可被 FastGPT、Coze、OpenClaw 等智能体平台作为 Skill 插件接入。
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createJsonRpcAuthError,
  logMcpToolCall,
  touchMcpApiKey,
  validateMcpApiKey,
} from '@/lib/mcp/auth';
import { memoryTools, handleMemoryToolCall } from '@/lib/mcp/skills/memory/handlers';

export const dynamic = 'force-dynamic';

/**
 * POST 处理器 - 接收 MCP JSON-RPC 请求
 * 
 * 支持的方法：
 * - tools/list: 返回可用工具列表
 * - tools/call: 执行工具调用
 */
export async function POST(req: NextRequest) {
  let requestId: string | number | null = null;

  try {
    const apiKey = await validateMcpApiKey(req.headers.get('Authorization'));
    if (!apiKey) {
      return NextResponse.json(createJsonRpcAuthError(null), { status: 401 });
    }

    const body = await req.json();
    const { method, params, id } = body;
    requestId = id ?? null;

    console.log(`[Memory MCP] Received: ${method}`);

    if (method === 'initialize') {
      await touchMcpApiKey(apiKey.id);
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'ai-scale-engine-memory-compat',
            version: '0.1.0',
          },
        },
      });
    }

    if (method === 'ping') {
      await touchMcpApiKey(apiKey.id);
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {},
      });
    }

    // 1. 响应工具列表请求
    if (method === "tools/list") {
      await touchMcpApiKey(apiKey.id);
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { tools: memoryTools }
      });
    }

    // 2. 响应工具调用请求
    if (method === "tools/call") {
      const { name, arguments: args } = (params || {}) as { name?: string; arguments?: unknown };
      
      console.log(`[Memory MCP] Calling tool: ${name}`);
      
      const result = await handleMemoryToolCall(name || '', args);
      const isSuccessful = !isToolCallError(result);

      await touchMcpApiKey(apiKey.id, isSuccessful);
      if (isSuccessful) {
        await logMcpToolCall({
          apiKeyId: apiKey.id,
          userId: apiKey.userId,
          action: name || 'unknown_tool',
          scaleId: getScaleId(args),
          entrypoint: 'memory_compat',
        }).catch((err) => console.error('Failed to log MCP call:', err));
      }
      
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result) }],
          ...(isSuccessful ? {} : { isError: true }),
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
      id: requestId,
      error: { 
        code: -32603, 
        message: error instanceof Error ? error.message : "Internal Server Error" 
      }
    }, { status: 500 });
  }
}

function getScaleId(args: unknown) {
  if (!args || typeof args !== 'object' || !('scaleId' in args)) {
    return null;
  }

  return typeof (args as { scaleId?: unknown }).scaleId === 'string'
    ? ((args as { scaleId: string }).scaleId)
    : null;
}

function isToolCallError(result: unknown) {
  return Boolean(
    result &&
      typeof result === 'object' &&
      'success' in result &&
      (result as { success?: boolean }).success === false
  );
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
