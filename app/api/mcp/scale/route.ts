/**
 * 量表评估服务 MCP - HTTP 端点
 * 
 * 提供量表列表、问题获取、评估提交等功能
 * 支持API密钥认证
 */

import { NextRequest, NextResponse } from 'next/server';
import { scaleTools, handleScaleToolCall } from '@/lib/mcp/skills/scale/handlers';
import {
  createJsonRpcAuthError,
  logMcpToolCall,
  touchMcpApiKey,
  validateMcpApiKey,
} from '@/lib/mcp/auth';
import { listSerializableScales } from '@/lib/scales/catalog';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';

export const dynamic = 'force-dynamic';

/**
 * POST 处理器 - 接收 MCP JSON-RPC 请求
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

    console.log(`[Scale MCP] Received: ${method}`);

    if (method === 'initialize') {
      await touchMcpApiKey(apiKey.id);
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'ai-scale-engine-scale-compat',
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
        result: { tools: scaleTools }
      });
    }

    // 2. 响应工具调用请求
    if (method === "tools/call") {
      const { name, arguments: args } = (params || {}) as { name?: string; arguments?: unknown };
      
      console.log(`[Scale MCP] Calling tool: ${name}`);
      
      const result = await handleScaleToolCall(name || '', args);

      const isSuccessful = !isToolCallError(result);
      await touchMcpApiKey(apiKey.id, isSuccessful);

      if (isSuccessful) {
        await logMcpToolCall({
          apiKeyId: apiKey.id,
          userId: apiKey.userId,
          action: name || 'unknown_tool',
          scaleId: getScaleId(args),
          entrypoint: 'scale_compat',
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
    console.error("[Scale MCP Error]:", error);
    
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
 * GET 处理器 - 返回服务状态
 */
export async function GET() {
  const scales = listSerializableScales();

  return NextResponse.json({
    service: "Scale Assessment Service",
    version: "1.0.0",
    status: "active",
    description: "AI量表评估服务 - 提供量表列表、问题获取、评估提交",
    authentication: "API Key (Bearer Token)",
    tools: scaleTools.map(t => ({
      name: t.name,
      description: t.description
    })),
    supportedScales: scales.map(s => ({
      id: s.id,
      title: resolveLocalizedText(s.title, 'zh'),
      questionCount: s.questions.length
    }))
  });
}
