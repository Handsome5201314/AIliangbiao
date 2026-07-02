import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  sendAgentConversationTurn,
} from "@/lib/realtime/agent-conversation";
import {
  buildAgentMemberContextSummary,
  buildAgentTenantContextFromSession,
} from "@/lib/realtime/agent-request-context";
import { sendDoctorBotConversationTurn } from "@/lib/realtime/doctor-bot-conversation";
import {
  extractBearerToken,
  requireAgentScope,
  verifyAgentSessionToken,
} from "@/lib/assessment-skill/auth";

const requestSchema = z.object({
  surface: z.enum(["agent", "doctor_bot"]),
  voiceMode: z.enum(["stable", "experimental"]).default("stable"),
  language: z.enum(["zh", "en"]).optional(),
  doctorBotSlug: z.string().optional(),
  visitorSessionId: z.string().optional(),
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
    const content = String(body.input.text || body.input.transcript || "").trim();

    if (body.surface === "agent") {
      const agentSession = verifyAgentSessionToken(extractBearerToken(request));
      requireAgentScope(agentSession, "skill:voice-intent");
      const language = body.language || body.triageContext?.language || "zh";
      const memberContextSummary = await buildAgentMemberContextSummary({
        userId: agentSession.sub,
        memberId: agentSession.member_id,
        language,
      });

      const result = await sendAgentConversationTurn({
        content,
        language,
        triageContext: {
          state: body.triageContext?.state || "triage",
          symptoms: body.triageContext?.symptoms || [],
          conversationHistory: body.triageContext?.conversationHistory || [],
          recommendedScale: body.triageContext?.recommendedScale || undefined,
          consentGiven: Boolean(body.triageContext?.consentGiven),
          language,
        },
        conversationId: `agent:${agentSession.session_id}`,
        memberContextSummary,
        tenantContext: buildAgentTenantContextFromSession(agentSession),
      });

      return NextResponse.json({
        success: true,
        surface: body.surface,
        voiceMode: body.voiceMode,
        ...result,
      });
    }

    if (!body.doctorBotSlug || !body.visitorSessionId) {
      return NextResponse.json(
        { error: "doctorBotSlug and visitorSessionId are required for doctor_bot surface" },
        { status: 400 }
      );
    }

    const doctorBotResult = await sendDoctorBotConversationTurn({
      slug: body.doctorBotSlug,
      visitorSessionId: body.visitorSessionId,
      content,
      language: body.language,
    });
    const toolCall = doctorBotResult.reply.toolCall || null;

    return NextResponse.json({
      success: true,
      backend: doctorBotResult.backend,
      surface: body.surface,
      voiceMode: body.voiceMode,
      message: {
        role: "assistant",
        content: doctorBotResult.reply.text,
      },
      actionCard: doctorBotResult.reply.actionCard,
      toolCalls: toolCall ? [toolCall] : [],
      fallback: doctorBotResult.fallback,
      knowledge: doctorBotResult.knowledge,
      session: doctorBotResult.session,
      agentAction: null,
      triageSessionPatch: null,
    });
  } catch (error) {
    const status =
      error instanceof z.ZodError
        ? 400
        : error instanceof Error &&
            /Missing Bearer token|Invalid agent session|signature|expired|required scope/i.test(
              error.message
            )
          ? 401
          : 422;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process conversation turn" },
      { status }
    );
  }
}
