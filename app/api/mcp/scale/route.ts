import { NextRequest, NextResponse } from "next/server";

import { getAgentPitSharedBearer } from "@/lib/agentpit/config";
import {
  AgentPitAuthError,
  extractBearerToken,
} from "@/lib/agentpit/shared-auth";
import { prisma } from "@/lib/db/prisma";
import { handleScaleToolCall, scaleTools } from "@/lib/mcp/skills/scale/handlers";
import { listSerializableScales } from "@/lib/scales/catalog";
import { resolveLocalizedText } from "@/lib/schemas/core/i18n";

export const dynamic = "force-dynamic";

async function authorizeScaleMcpRequest(headers: Headers) {
  const token = extractBearerToken(headers);
  if (!token) {
    throw new AgentPitAuthError("Missing Bearer token", 401);
  }

  if (token === getAgentPitSharedBearer()) {
    return { clientId: "agentpit-shared" };
  }

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyValue: token,
      isActive: true,
    },
  });

  if (!apiKey) {
    throw new AgentPitAuthError("Invalid Bearer token", 403);
  }

  return { clientId: apiKey.id };
}

function createJsonRpcErrorResponse(
  status: number,
  code: number,
  message: string,
  id: string | number | null = null
) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    },
    { status }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { clientId } = await authorizeScaleMcpRequest(req.headers);
    const body = await req.json();
    const { method, params, id } = body;

    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: { tools: scaleTools },
      });
    }

    if (method === "tools/call") {
      const { name, arguments: args } = params ?? {};
      const result = await handleScaleToolCall(name, args);

      await prisma.mcpLog
        .create({
          data: {
            clientId,
            action: String(name || "unknown"),
            scaleId:
              typeof args?.scaleId === "string"
                ? args.scaleId
                : typeof args?.scaleId === "number"
                  ? String(args.scaleId)
                  : null,
          },
        })
        .catch((error) => {
          console.error("[Scale MCP Log Error]:", error);
        });

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result) }],
        },
      });
    }

    return createJsonRpcErrorResponse(404, -32601, "Method not found", id);
  } catch (error) {
    if (error instanceof AgentPitAuthError) {
      return createJsonRpcErrorResponse(error.status, -32001, error.message);
    }

    console.error("[Scale MCP Error]:", error);
    return createJsonRpcErrorResponse(
      500,
      -32603,
      error instanceof Error ? error.message : "Internal Server Error"
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await authorizeScaleMcpRequest(request.headers);

    const scales = listSerializableScales();
    return NextResponse.json({
      service: "Scale Assessment Service",
      version: "1.0.0",
      status: "active",
      description:
        "AI量表评估服务 - 提供量表列表、问题获取与确定性评分能力",
      authentication: "Bearer Token",
      tools: scaleTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
      supportedScales: scales.map((scale) => ({
        id: scale.id,
        title: resolveLocalizedText(scale.title, "zh"),
        questionCount: scale.questions.length,
      })),
    });
  } catch (error) {
    if (error instanceof AgentPitAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load MCP scale metadata" },
      { status: 500 }
    );
  }
}
