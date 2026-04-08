import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildAgentPitAuthErrorResponse, assertAgentPitSharedBearer } from "@/lib/agentpit/shared-auth";
import { getInternalApiUrl } from "@/lib/assessment-skill/internal-api";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
  timestamp: z.string().optional(),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string }> }
) {
  try {
    assertAgentPitSharedBearer(request);

    const body = requestSchema.parse(await request.json());
    const { scaleId } = await context.params;

    const proxied = await fetch(
      getInternalApiUrl("/api/scales/analyze-conversation", request),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scaleId,
          messages: body.messages,
        }),
      }
    );

    const text = await proxied.text();
    return new NextResponse(text, {
      status: proxied.status,
      headers: {
        "Content-Type":
          proxied.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    const authResponse = buildAgentPitAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to analyze conversation" },
      { status: 500 }
    );
  }
}

