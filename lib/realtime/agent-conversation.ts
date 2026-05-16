import type { TriageContext } from "@/lib/services/triageFlow";
import {
  buildScaleRecommendationCopy,
  detectLocalTriageIntent,
  extractSymptomsFromTranscript,
  recommendScaleFromSymptoms,
} from "@/lib/services/triageFlow";

export async function sendAgentConversationTurn(input: {
  content: string;
  language: "zh" | "en";
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

  const detected = detectLocalTriageIntent(input.content, currentContext, input.language);
  const recommendedScale = detected?.scaleId || recommendScaleFromSymptoms(nextSymptoms, input.content);
  const replyText =
    detected?.text ||
    (recommendedScale
      ? buildScaleRecommendationCopy(recommendedScale, input.language)
      : input.language === "en"
        ? "Please tell me the main symptom or concern you want to evaluate."
        : "请直接告诉我，最想评估的主要症状或困扰是什么。");

  const agentAction = detected?.action || (recommendedScale ? "recommend_scale" : "ask_followup");
  const nextConversation = [
    ...currentContext.conversationHistory,
    { role: "assistant" as const, content: replyText, timestamp: Date.now() },
  ];
  const nextStatus =
    agentAction === "recommend_scale"
      ? "CONSENT"
      : agentAction === "pause_session"
        ? "PAUSED"
        : "ONGOING";

  return {
    backend: "legacy" as const,
    fallback: true,
    message: {
      role: "assistant" as const,
      content: replyText,
    },
    agentAction,
    actionCard:
      recommendedScale && (agentAction === "recommend_scale" || agentAction === "start_scale")
        ? {
            type: "assessment" as const,
            scaleId: recommendedScale,
            title: recommendedScale,
            body: replyText,
            reason: replyText,
          }
        : null,
    triageSessionPatch: {
      status: nextStatus,
      symptoms: nextSymptoms,
      conversationHistory: nextConversation,
      recommendedScale: recommendedScale || null,
    },
  };
}
