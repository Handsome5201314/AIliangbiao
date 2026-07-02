import type { LanguageCode } from "@/lib/schemas/core/types";
import {
  DoctorBotChatError,
  getOrCreateDoctorBotChatSession,
  getPublishedDoctorBotBySlug,
  sendDoctorBotChatMessage,
} from "@/lib/services/doctor-bot";
import { resolveConversationBackend, type ConversationBackend } from "@/lib/realtime/conversation";

export async function sendDoctorBotConversationTurn(input: {
  slug: string;
  visitorSessionId: string;
  content: string;
  language?: LanguageCode;
  requestedBackend?: ConversationBackend;
}) {
  const published = await getPublishedDoctorBotBySlug(input.slug);
  const knowledgeMode =
    ((published.config as { knowledgeMode?: "platform_proxy" | "direct_fastgpt" | null }).knowledgeMode) ||
    "platform_proxy";
  const backend = resolveConversationBackend();
  const active = await getOrCreateDoctorBotChatSession({
    slug: input.slug,
    visitorSessionId: input.visitorSessionId,
  });
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
