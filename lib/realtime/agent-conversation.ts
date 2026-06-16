import type { LanguageCode } from "@/lib/schemas/core/types";
import {
  buildScaleRecommendationCopy,
  detectLocalTriageIntent,
  extractSymptomsFromTranscript,
  generateTriagePrompt,
  recommendScaleFromSymptoms,
  type TriageAIResponse,
  type TriageAction,
  type TriageContext,
} from "@/lib/services/triageFlow";
import { resolveConversationBackend, type ConversationBackend } from "@/lib/realtime/conversation";
import {
  getHermesApiConfig,
  requestHermesAgentTriageReply,
  requestHermesAgentTriageReplyStream,
} from "@/lib/realtime/hermes";

type AgentConversationStatus = "ONGOING" | "CONSENT" | "PAUSED";

type AgentActionCard = {
  type: "assessment";
  scaleId: string;
  title: string;
  body: string;
  reason: string;
} | null;

export type AgentConversationResult = {
  backend: ConversationBackend;
  fallback: boolean;
  message: {
    role: "assistant";
    content: string;
  };
  agentAction: TriageAction;
  actionCard: AgentActionCard;
  triageSessionPatch: {
    status: AgentConversationStatus;
    symptoms: string[];
    conversationHistory: Array<{
      role: "user" | "assistant";
      content: string;
      timestamp: number;
    }>;
    recommendedScale: string | null;
  };
};

export type AgentMemberContextSummary = {
  nickname?: string;
  relation?: string;
  latestAssessmentConclusion?: string;
  interests?: string[];
  fears?: string[];
  behaviors?: string[];
  medicalHistory?: string[];
};

export type AgentTenantContextSummary = {
  channel?: string;
  tenantRole?: string;
  organizationId?: string;
  doctorProfileId?: string;
  hermesProfileId?: string;
  organizationName?: string;
  doctorName?: string;
};

function buildDefaultReplyText(language: LanguageCode) {
  return language === "en"
    ? "Please tell me the main symptom or concern you want to evaluate."
    : "请直接告诉我，最想评估的主要症状或困扰是什么。";
}

function createNextTriageContext(input: {
  content: string;
  language: LanguageCode;
  triageContext: TriageContext;
}) {
  const nextSymptoms = extractSymptomsFromTranscript(input.content, input.triageContext.symptoms);
  const currentContext: TriageContext = {
    ...input.triageContext,
    language: input.language,
    symptoms: nextSymptoms,
    conversationHistory: [
      ...input.triageContext.conversationHistory,
      { role: "user", content: input.content, timestamp: Date.now() },
    ],
  };

  return {
    currentContext,
    nextSymptoms,
  };
}

function patchTriageAIResponse(input: {
  aiResponse: TriageAIResponse;
  currentContext: TriageContext;
  content: string;
  language: LanguageCode;
}) {
  if (
    input.aiResponse.action === "acknowledge" &&
    !input.aiResponse.scaleId &&
    input.currentContext.symptoms.length >= 2
  ) {
    const fallbackScale =
      recommendScaleFromSymptoms(input.currentContext.symptoms, input.content) || "SRS";

    return {
      ...input.aiResponse,
      action: "recommend_scale" as const,
      scaleId: fallbackScale,
      text: input.aiResponse.text || buildScaleRecommendationCopy(fallbackScale, input.language),
      symptoms: input.currentContext.symptoms,
    };
  }

  return {
    ...input.aiResponse,
    symptoms: input.aiResponse.symptoms?.length
      ? input.aiResponse.symptoms
      : input.currentContext.symptoms,
  };
}

function buildLegacyTriageAIResponse(input: {
  content: string;
  language: LanguageCode;
  currentContext: TriageContext;
}) {
  const detected = detectLocalTriageIntent(
    input.content,
    input.currentContext,
    input.language
  );
  const recommendedScale =
    detected?.scaleId ||
    recommendScaleFromSymptoms(input.currentContext.symptoms, input.content);

  if (detected) {
    return patchTriageAIResponse({
      aiResponse: detected,
      currentContext: input.currentContext,
      content: input.content,
      language: input.language,
    });
  }

  return {
    text: recommendedScale
      ? buildScaleRecommendationCopy(recommendedScale, input.language)
      : buildDefaultReplyText(input.language),
    action: recommendedScale ? "recommend_scale" : "ask_followup",
    scaleId: recommendedScale,
    confidence: recommendedScale ? 0.75 : 0.5,
    symptoms: input.currentContext.symptoms,
    meta: {
      reason: "legacy triage rules",
    },
  } satisfies TriageAIResponse;
}

function resolveRecommendedScale(input: {
  aiResponse: TriageAIResponse;
  triageContext: TriageContext;
}) {
  if (input.aiResponse.scaleId) {
    return input.aiResponse.scaleId;
  }

  if (
    input.triageContext.recommendedScale &&
    (input.aiResponse.action === "start_scale" ||
      input.aiResponse.action === "explain" ||
      input.aiResponse.action === "repeat_question")
  ) {
    return input.triageContext.recommendedScale;
  }

  return undefined;
}

function resolveNextStatus(action: TriageAction): AgentConversationStatus {
  if (action === "recommend_scale") {
    return "CONSENT";
  }

  if (action === "pause_session") {
    return "PAUSED";
  }

  return "ONGOING";
}

export function buildAgentHermesPrompt(input: {
  content: string;
  triageContext: TriageContext;
  memberContextSummary?: AgentMemberContextSummary | null;
  tenantContext?: AgentTenantContextSummary | null;
}) {
  const profile = {
    nickname:
      input.memberContextSummary?.nickname || input.triageContext.userProfile?.childName,
    ageMonths: input.triageContext.userProfile?.childAge,
    relation:
      input.triageContext.userProfile?.relation || input.memberContextSummary?.relation,
  };

  const memberSummary = input.memberContextSummary
    ? [
        "当前成员补充信息：",
        `- 昵称：${input.memberContextSummary.nickname || profile.nickname || "未知"}`,
        input.memberContextSummary.relation
          ? `- 关系：${input.memberContextSummary.relation}`
          : null,
        `- 最近评估结论：${
          input.memberContextSummary.latestAssessmentConclusion || "近期暂无评估记录"
        }`,
        input.memberContextSummary.interests?.length
          ? `- 兴趣偏好：${input.memberContextSummary.interests.join("、")}`
          : null,
        input.memberContextSummary.fears?.length
          ? `- 当前担心：${input.memberContextSummary.fears.join("、")}`
          : null,
        input.memberContextSummary.behaviors?.length
          ? `- 行为特点：${input.memberContextSummary.behaviors.join("、")}`
          : null,
        input.memberContextSummary.medicalHistory?.length
          ? `- 医疗史：${input.memberContextSummary.medicalHistory.join("、")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "当前成员补充信息：暂无";

  const tenantSummary = input.tenantContext
    ? [
        "当前租户补充信息：",
        input.tenantContext.channel
          ? `- 渠道：${input.tenantContext.channel}`
          : null,
        input.tenantContext.tenantRole
          ? `- 租户角色：${input.tenantContext.tenantRole}`
          : null,
        input.tenantContext.organizationName || input.tenantContext.organizationId
          ? `- 机构：${
              input.tenantContext.organizationName || input.tenantContext.organizationId
            }`
          : null,
        input.tenantContext.doctorName || input.tenantContext.doctorProfileId
          ? `- 当前医生：${
              input.tenantContext.doctorName || input.tenantContext.doctorProfileId
            }`
          : null,
        input.tenantContext.hermesProfileId
          ? `- Hermes Profile：${input.tenantContext.hermesProfileId}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "当前租户补充信息：暂无";

  return [
    generateTriagePrompt(input.content, input.triageContext, profile),
    memberSummary,
    tenantSummary,
    "请只基于当前成员与当前租户的受限上下文做判断。",
  ].join("\n\n");
}

export function buildAgentConversationResultFromTriageAI(input: {
  aiResponse: TriageAIResponse;
  triageContext: TriageContext;
  language: LanguageCode;
  backend?: ConversationBackend;
  fallback?: boolean;
}): AgentConversationResult {
  const recommendedScale = resolveRecommendedScale({
    aiResponse: input.aiResponse,
    triageContext: input.triageContext,
  });
  const replyText =
    input.aiResponse.text ||
    (recommendedScale
      ? buildScaleRecommendationCopy(recommendedScale, input.language)
      : buildDefaultReplyText(input.language));
  const nextConversation = [
    ...input.triageContext.conversationHistory,
    { role: "assistant" as const, content: replyText, timestamp: Date.now() },
  ];

  return {
    backend: input.backend || "legacy",
    fallback: Boolean(input.fallback),
    message: {
      role: "assistant",
      content: replyText,
    },
    agentAction: input.aiResponse.action,
    actionCard:
      recommendedScale &&
      (input.aiResponse.action === "recommend_scale" ||
        input.aiResponse.action === "start_scale")
        ? {
            type: "assessment",
            scaleId: recommendedScale,
            title: recommendedScale,
            body: replyText,
            reason: replyText,
          }
        : null,
    triageSessionPatch: {
      status: resolveNextStatus(input.aiResponse.action),
      symptoms:
        input.aiResponse.symptoms?.length
          ? input.aiResponse.symptoms
          : input.triageContext.symptoms,
      conversationHistory: nextConversation,
      recommendedScale: recommendedScale || null,
    },
  };
}

export async function sendAgentConversationTurn(input: {
  content: string;
  language: LanguageCode;
  triageContext: TriageContext;
  requestedBackend?: ConversationBackend;
  hermesEnabled?: boolean;
  conversationId?: string;
  memberContextSummary?: AgentMemberContextSummary | null;
  tenantContext?: AgentTenantContextSummary | null;
  onDelta?: ((delta: string) => void | Promise<void>) | undefined;
}) {
  const { currentContext } = createNextTriageContext({
    content: input.content,
    language: input.language,
    triageContext: input.triageContext,
  });
  const backend = resolveConversationBackend({
    requestedBackend: input.requestedBackend || "hermes",
    hermesEnabled:
      typeof input.hermesEnabled === "boolean"
        ? input.hermesEnabled
        : getHermesApiConfig().enabled,
  });

  if (backend === "hermes") {
    try {
      const prompt = buildAgentHermesPrompt({
        content: input.content,
        triageContext: currentContext,
        memberContextSummary: input.memberContextSummary,
        tenantContext: input.tenantContext,
      });
      const hermesReply = input.onDelta
        ? await requestHermesAgentTriageReplyStream({
            conversationId: input.conversationId || `agent:${Date.now()}`,
            prompt,
            language: input.language,
            tenantContext: input.tenantContext || undefined,
            onDelta: input.onDelta,
          })
        : await requestHermesAgentTriageReply({
            conversationId: input.conversationId || `agent:${Date.now()}`,
            prompt,
            language: input.language,
            tenantContext: input.tenantContext || undefined,
          });
      const aiResponse = patchTriageAIResponse({
        aiResponse: hermesReply.aiResponse,
        currentContext,
        content: input.content,
        language: input.language,
      });

      return buildAgentConversationResultFromTriageAI({
        aiResponse,
        triageContext: currentContext,
        language: input.language,
        backend,
        fallback: false,
      });
    } catch {
      const aiResponse = buildLegacyTriageAIResponse({
        content: input.content,
        language: input.language,
        currentContext,
      });

      const fallbackResult = buildAgentConversationResultFromTriageAI({
        aiResponse,
        triageContext: currentContext,
        language: input.language,
        backend,
        fallback: true,
      });
      if (fallbackResult.message.content) {
        await input.onDelta?.(fallbackResult.message.content);
      }
      return fallbackResult;
    }
  }

  const aiResponse = buildLegacyTriageAIResponse({
    content: input.content,
    language: input.language,
    currentContext,
  });

  const legacyResult = buildAgentConversationResultFromTriageAI({
    aiResponse,
    triageContext: currentContext,
    language: input.language,
    backend,
    fallback: false,
  });
  if (legacyResult.message.content) {
    await input.onDelta?.(legacyResult.message.content);
  }
  return legacyResult;
}
