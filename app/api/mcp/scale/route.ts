/**
 * 量表评估服务 MCP - HTTP 端点
 * 
 * 提供量表列表、问题获取、评估提交等功能
 * 支持API密钥认证
 */

import { NextRequest, NextResponse } from 'next/server';
import { scaleTools, handleScaleToolCall } from '@/lib/mcp/skills/scale/handlers';
import { prisma } from '@/lib/db/prisma';
import { listSerializableScales } from '@/lib/scales/catalog';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';

export const dynamic = 'force-dynamic';

/**
 * 验证API密钥
 */
async function validateApiKey(authHeader: string | null): Promise<{ valid: boolean; clientId?: string }> {
  if (!authHeader) {
    return { valid: false };
  }

  // 提取Bearer token
  const token = authHeader.replace('Bearer ', '');
  
  if (!token || token.length < 10) {
    return { valid: false };
  }

  // 查询有效的API密钥
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        keyValue: token,
        isActive: true
      }
    });

    if (!apiKey) {
      return { valid: false };
    }

    return { valid: true, clientId: apiKey.id };
  } catch (error) {
    console.error('API key validation error:', error);
    return { valid: false };
  }
}

/**
 * POST 处理器 - 接收 MCP JSON-RPC 请求
 */
export async function POST(req: NextRequest) {
  try {
    // 验证API密钥（可选，根据需求启用）
    const authHeader = req.headers.get('Authorization');
    const { valid, clientId } = await validateApiKey(authHeader);

    // 如果需要强制认证，取消下面的注释
    // if (!valid) {
    //   return NextResponse.json({
    //     jsonrpc: "2.0",
    //     id: null,
    //     error: { code: -32600, message: "Invalid API key" }
    //   }, { status: 401 });
    // }

    const body = await req.json();
    const { method, params, id } = body;

    console.log(`[Scale MCP] Received: ${method}`);

    // 1. 响应工具列表请求
    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { tools: scaleTools }
      });
    }

    // 2. 响应工具调用请求
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      
      console.log(`[Scale MCP] Calling tool: ${name}`);
      
      const result = await handleScaleToolCall(name, args);
      
      // 记录MCP调用日志
      if (clientId) {
        await prisma.mcpLog.create({
          data: {
            clientId: clientId,
            action: name,
            scaleId: args.scaleId
          }
        }).catch(err => console.error('Failed to log MCP call:', err));
      }
      
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
    console.error("[Scale MCP Error]:", error);
    
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
