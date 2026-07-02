import { NextResponse } from "next/server";
import { z } from "zod";

import { issueAgentSessionToken, type AgentChannel } from "@/lib/assessment-skill/auth";
import {
  sendAgentConversationTurn,
} from "@/lib/realtime/agent-conversation";
import {
  buildAgentMemberContextSummary,
  buildAgentTenantContextFromResolved,
} from "@/lib/realtime/agent-request-context";
import { resolveAgentTenantContext } from "@/lib/services/agent-session";
import {
  AiToyPartnerAuthError,
  assertAiToyPartnerToken,
  ensureAiToyDeviceBindingForDevice,
} from "@/lib/services/ai-toy-device-binding";

const triageContextSchema = z
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
  .optional();

const aiToyWebhookSchema = z.object({
  deviceId: z.string().min(1),
  memberId: z.string().optional(),
  message: z.string().optional(),
  transcript: z.string().optional(),
  language: z.enum(["zh", "en"]).optional(),
  triageContext: triageContextSchema,
  memberSnapshot: z
    .object({
      nickname: z.string().optional(),
      gender: z.string().optional(),
      ageMonths: z.number().optional(),
      relation: z.string().optional(),
      languagePreference: z.string().optional(),
      interests: z.array(z.string()).optional(),
      fears: z.array(z.string()).optional(),
      avatarConfig: z.unknown().optional(),
    })
    .optional(),
});

type SupportedWebhookChannel = "ai_toy" | "feishu_bot" | "wecom_bot" | "dingtalk_bot";

function normalizeWebhookChannel(channel: string): SupportedWebhookChannel | null {
  const normalized = channel.trim().toLowerCase();

  switch (normalized) {
    case "ai_toy":
    case "xiaozhi":
      return "ai_toy";
    case "feishu":
    case "feishu_bot":
      return "feishu_bot";
    case "wecom":
    case "wecom_bot":
      return "wecom_bot";
    case "dingtalk":
    case "dingtalk_bot":
      return "dingtalk_bot";
    default:
      return null;
  }
}

function resolveWebhookResponseStatus(error: unknown) {
  if (error instanceof AiToyPartnerAuthError) {
    return 401;
  }

  if (error instanceof z.ZodError) {
    return 400;
  }

  if (
    error instanceof Error &&
    /not configured|not implemented|unsupported|unknown channel/i.test(error.message)
  ) {
    return 501;
  }

  return 422;
}

async function handleAiToyWebhook(request: Request) {
  assertAiToyPartnerToken(
    request.headers.get("authorization") || request.headers.get("Authorization")
  );

  const body = aiToyWebhookSchema.parse(await request.json());
  const content = String(body.message || body.transcript || "").trim();
  if (!content) {
    return NextResponse.json({ error: "message or transcript is required" }, { status: 400 });
  }

  const resolved = await ensureAiToyDeviceBindingForDevice({
    deviceId: body.deviceId,
    memberSnapshot: body.memberSnapshot,
  });

  if (body.memberId && body.memberId !== resolved.member.id) {
    throw new Error("AI toy device binding does not match this account member");
  }

  const tenant = await resolveAgentTenantContext({
    user: resolved.user,
    member: resolved.member,
    activeAccountType: resolved.activeAccountType,
  });
  const tenantContext = buildAgentTenantContextFromResolved({
    channel: "ai_toy",
    tenantRole: tenant.tenantRole,
    organization: tenant.organization,
    activeDoctorProfile: tenant.activeDoctorProfile,
  });
  const language = body.language || body.triageContext?.language || "zh";
  const memberContextSummary = await buildAgentMemberContextSummary({
    userId: resolved.user.id,
    memberId: resolved.member.id,
    language,
  });

  const session = issueAgentSessionToken({
    userId: resolved.user.id,
    memberId: resolved.member.id,
    role: (resolved.user.role || "GUEST") as "GUEST" | "REGISTERED" | "VIP",
    deviceId: body.deviceId,
    accountType: resolved.activeAccountType,
    doctorProfileId:
      resolved.activeAccountType === "DOCTOR" ? tenant.activeDoctorProfile?.id : undefined,
    organizationId: tenant.organization?.id || undefined,
    tenantRole: tenant.tenantRole,
    channel: "ai_toy",
    entrypoint: "agent",
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
    conversationId: `channel:ai_toy:${session.payload.session_id}`,
    memberContextSummary,
    tenantContext,
  });

  return NextResponse.json({
    success: true,
    channel: "ai_toy" satisfies AgentChannel,
    token: session.token,
    session: session.payload,
    member: {
      id: resolved.member.id,
      nickname: resolved.member.nickname,
      relation: resolved.member.relation || null,
    },
    reply: result,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ channel: string }> }
) {
  try {
    const { channel } = await context.params;
    const normalizedChannel = normalizeWebhookChannel(channel);

    if (!normalizedChannel) {
      return NextResponse.json({ error: "Unknown channel webhook" }, { status: 404 });
    }

    if (normalizedChannel === "ai_toy") {
      return await handleAiToyWebhook(request);
    }

    return NextResponse.json(
      {
        error: `${normalizedChannel} webhook 尚未完成签名接入，请先实现对应渠道 adapter`,
      },
      { status: 501 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process channel webhook" },
      { status: resolveWebhookResponseStatus(error) }
    );
  }
}
