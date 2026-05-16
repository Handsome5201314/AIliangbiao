import type { LanguageCode } from "@/lib/schemas/core/types";
import {
  DoctorBotChatError,
  getOrCreateDoctorBotChatSession,
  getPublishedDoctorBotBySlug,
  sendDoctorBotChatMessage,
} from "@/lib/services/doctor-bot";
import { normalizeHermesReply, resolveConversationBackend, type ConversationBackend } from "@/lib/realtime/conversation";
import { requestHermesDoctorBotReply } from "@/lib/realtime/hermes";

export async function sendDoctorBotConversationTurn(input: {
  slug: string;
  visitorSessionId: string;
  content: string;
  language?: LanguageCode;
  requestedBackend?: ConversationBackend;
  hermesEnabled?: boolean;
}) {
  const published = await getPublishedDoctorBotBySlug(input.slug);
  const effectiveHermesEnabled =
    typeof input.hermesEnabled === "boolean"
      ? input.hermesEnabled
      : Boolean((published.config as { hermesEnabled?: boolean | null }).hermesEnabled);
  const knowledgeMode =
    ((published.config as { knowledgeMode?: "platform_proxy" | "direct_fastgpt" | null }).knowledgeMode) ||
    "platform_proxy";

  const backend = resolveConversationBackend({
    requestedBackend: input.requestedBackend || "hermes",
    hermesEnabled: effectiveHermesEnabled,
  });

  if (backend === "hermes") {
    try {
      const [{ config, enabledScales }, active] = await Promise.all([
        Promise.resolve(published),
        getOrCreateDoctorBotChatSession({
          slug: input.slug,
          visitorSessionId: input.visitorSessionId,
        }),
      ]);

      if (active.activeAssessment && !active.activeAssessment.result && active.activeAssessment.status !== "COMPLETED") {
        throw new DoctorBotChatError(
          input.language === "en"
            ? "An assessment is already in progress. Please continue the current assessment first."
            : "当前已有进行中的量表，请先继续完成当前量表。",
          409,
          "ASSESSMENT_IN_PROGRESS",
          { session: active.activeAssessment }
        );
      }

      const hermesReply = await requestHermesDoctorBotReply({
        assistantName: config.assistantName,
        conversationId: active.session.chatId,
        content: input.content,
        enabledScales,
      });

      const knowledge = {
        mode: knowledgeMode,
        via: knowledgeMode === "direct_fastgpt" ? "direct_fastgpt" : "platform_proxy",
      };

      return {
        backend,
        fallback: false,
        knowledge,
        session: {
          id: active.session.id,
          visitorSessionId: active.session.visitorSessionId,
          chatId: active.session.chatId,
        },
        reply: normalizeHermesReply({
          content: hermesReply.text,
          toolCall: hermesReply.assessment
            ? {
                name: "suggest_assessment",
                args: hermesReply.assessment,
              }
            : null,
        }),
      };
    } catch {
      return {
        backend,
        fallback: true,
        knowledge: {
          mode: knowledgeMode,
          via: "legacy_fallback",
        },
        ...(await sendDoctorBotChatMessage({
          slug: input.slug,
          visitorSessionId: input.visitorSessionId,
          content: input.content,
          language: input.language,
        })),
      };
    }
  }

  return {
    backend,
    fallback: false,
    knowledge: {
      mode: knowledgeMode,
      via: "legacy_direct",
    },
    ...(await sendDoctorBotChatMessage({
      slug: input.slug,
      visitorSessionId: input.visitorSessionId,
      content: input.content,
      language: input.language,
    })),
  };
}
