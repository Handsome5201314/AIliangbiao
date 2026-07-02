export type ConversationBackend = "internal";

export type NormalizedConversationReply = {
  text: string;
  actionCard: {
    type: "assessment";
    scaleId: string;
    title: string;
    body: string;
    reason: string;
  } | null;
};

export function resolveConversationBackend(): ConversationBackend {
  return "internal";
}

export function normalizeConversationReply(input: {
  content: string;
  toolCall?: {
    name: string;
    args: {
      scaleId?: string;
      reason?: string;
      cardTitle?: string;
      cardBody?: string;
    };
  } | null;
}): NormalizedConversationReply {
  if (
    input.toolCall?.name === "suggest_assessment" &&
    input.toolCall.args.scaleId &&
    input.toolCall.args.reason
  ) {
    return {
      text: input.content,
      actionCard: {
        type: "assessment",
        scaleId: input.toolCall.args.scaleId,
        title: input.toolCall.args.cardTitle || `开始 ${input.toolCall.args.scaleId}`,
        body: input.toolCall.args.cardBody || `建议先完成 ${input.toolCall.args.scaleId} 评估。`,
        reason: input.toolCall.args.reason,
      },
    };
  }

  return {
    text: input.content,
    actionCard: null,
  };
}
