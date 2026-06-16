import type {
  AgentConversationResult,
  AgentTenantContextSummary,
} from "@/lib/realtime/agent-conversation";

const encoder = new TextEncoder();

function encodeSseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function chunkPlatformAssistantMessage(text: string, chunkSize = 24) {
  const characters = Array.from(text || "");
  if (!characters.length) {
    return [];
  }

  const normalizedChunkSize = Math.max(1, Math.floor(chunkSize));
  const chunks: string[] = [];

  for (let index = 0; index < characters.length; index += normalizedChunkSize) {
    chunks.push(characters.slice(index, index + normalizedChunkSize).join(""));
  }

  return chunks;
}

export function createPlatformAgentChatStreamResponse(input: {
  conversationId: string;
  language: "zh" | "en";
  tenantContext?: AgentTenantContextSummary | null;
  result: AgentConversationResult;
  chunkSize?: number;
}) {
  const chunks = chunkPlatformAssistantMessage(input.result.message.content, input.chunkSize);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const startedAt = new Date().toISOString();

      controller.enqueue(
        encodeSseEvent("meta", {
          conversationId: input.conversationId,
          language: input.language,
          backend: input.result.backend,
          fallback: input.result.fallback,
          tenant: input.tenantContext || null,
          startedAt,
        })
      );

      let accumulated = "";
      chunks.forEach((chunk, index) => {
        accumulated += chunk;
        controller.enqueue(
          encodeSseEvent("delta", {
            index,
            delta: chunk,
            content: accumulated,
            done: index === chunks.length - 1,
          })
        );
      });

      controller.enqueue(
        encodeSseEvent("message", {
          ...input.result.message,
          content: input.result.message.content,
        })
      );

      controller.enqueue(
        encodeSseEvent("action", {
          agentAction: input.result.agentAction,
          actionCard: input.result.actionCard,
          triageSessionPatch: input.result.triageSessionPatch,
        })
      );

      controller.enqueue(
        encodeSseEvent("done", {
          conversationId: input.conversationId,
          completedAt: new Date().toISOString(),
        })
      );

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
