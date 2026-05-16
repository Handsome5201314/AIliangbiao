import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sendAgentConversationTurn } from "@/lib/realtime/agent-conversation";

const requestSchema = z.object({
  surface: z.enum(["agent", "doctor_bot"]),
  conversationBackend: z.enum(["legacy", "hermes"]).default("hermes"),
  voiceMode: z.enum(["stable", "experimental"]).default("stable"),
  language: z.enum(["zh", "en"]).optional(),
  triageContext: z
    .object({
      state: z.enum(["initial", "triage", "consent", "handoff", "assessment", "paused"]).optional(),
      symptoms: z.array(z.string()).optional(),
      conversationHistory: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
            timestamp: z.number(),
          })
        )
        .optional(),
      recommendedScale: z.string().nullable().optional(),
      consentGiven: z.boolean().optional(),
      language: z.enum(["zh", "en"]).optional(),
    })
    .optional(),
  input: z.object({
    type: z.enum(["text", "voice"]),
    text: z.string().optional(),
    transcript: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());

    if (body.surface === "agent") {
      const content = String(body.input.text || body.input.transcript || "").trim();
      const result = await sendAgentConversationTurn({
        content,
        language: body.language || body.triageContext?.language || "zh",
        triageContext: {
          state: body.triageContext?.state || "triage",
          symptoms: body.triageContext?.symptoms || [],
          conversationHistory: body.triageContext?.conversationHistory || [],
          recommendedScale: body.triageContext?.recommendedScale || undefined,
          consentGiven: Boolean(body.triageContext?.consentGiven),
          language: body.language || body.triageContext?.language || "zh",
        },
      });

      return NextResponse.json({
        success: true,
        surface: body.surface,
        voiceMode: body.voiceMode,
        ...result,
      });
    }

    return NextResponse.json({
      success: true,
      backend: body.conversationBackend,
      surface: body.surface,
      voiceMode: body.voiceMode,
      message: {
        role: "assistant",
        content:
          body.conversationBackend === "hermes"
            ? "Hermes conversation proxy is ready for this route."
            : "Legacy conversation backend is selected.",
      },
      toolCalls: [],
      fallback: body.conversationBackend !== "hermes",
      agentAction: null,
      triageSessionPatch: null,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 422;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process conversation turn" },
      { status }
    );
  }
}
