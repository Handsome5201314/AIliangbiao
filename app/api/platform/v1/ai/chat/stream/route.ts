import { NextRequest } from "next/server";
import { z } from "zod";

import {
  sendAgentConversationTurn,
} from "@/lib/realtime/agent-conversation";
import {
  buildAgentMemberContextSummary,
  buildAgentTenantContextFromSession,
} from "@/lib/realtime/agent-request-context";
import {
  extractBearerToken,
  requireAgentScope,
  verifyAgentSessionToken,
} from "@/lib/assessment-skill/auth";

const requestSchema = z.object({
  conversationBackend: z.enum(["legacy", "hermes"]).default("hermes"),
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

const encoder = new TextEncoder();

function encodeSseEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const session = verifyAgentSessionToken(extractBearerToken(request));
    requireAgentScope(session, "skill:voice-intent");

    const content = String(body.input.text || body.input.transcript || "").trim();
    if (!content) {
      return Response.json({ error: "Conversation content is required" }, { status: 400 });
    }

    const language = body.language || body.triageContext?.language || "zh";
    const memberContextSummary = await buildAgentMemberContextSummary({
      userId: session.sub,
      memberId: session.member_id,
      language,
    });
    const tenantContext = buildAgentTenantContextFromSession(session);
    const conversationId = `platform:${session.session_id}`;
    const triageContext = {
      state: body.triageContext?.state || "triage",
      symptoms: body.triageContext?.symptoms || [],
      conversationHistory: body.triageContext?.conversationHistory || [],
      recommendedScale: body.triageContext?.recommendedScale || undefined,
      consentGiven: Boolean(body.triageContext?.consentGiven),
      language,
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let deltaIndex = 0;
        let accumulated = "";

        request.signal.addEventListener("abort", () => {
          try {
            controller.close();
          } catch {
            // ignore close race during abort
          }
        });

        void (async () => {
          controller.enqueue(
            encodeSseEvent("meta", {
              conversationId,
              language,
              tenant: tenantContext || null,
              startedAt: new Date().toISOString(),
            })
          );

          try {
            const result = await sendAgentConversationTurn({
              content,
              language,
              triageContext,
              requestedBackend: body.conversationBackend,
              conversationId,
              memberContextSummary,
              tenantContext,
              onDelta: async (delta) => {
                accumulated += delta;
                controller.enqueue(
                  encodeSseEvent("delta", {
                    index: deltaIndex++,
                    delta,
                    content: accumulated,
                    done: false,
                  })
                );
              },
            });

            if (!accumulated && result.message.content) {
              accumulated = result.message.content;
              controller.enqueue(
                encodeSseEvent("delta", {
                  index: deltaIndex++,
                  delta: result.message.content,
                  content: accumulated,
                  done: false,
                })
              );
            }

            controller.enqueue(
              encodeSseEvent("message", {
                ...result.message,
                content: result.message.content,
              })
            );
            controller.enqueue(
              encodeSseEvent("action", {
                agentAction: result.agentAction,
                actionCard: result.actionCard,
                triageSessionPatch: result.triageSessionPatch,
                backend: result.backend,
                fallback: result.fallback,
              })
            );
            controller.enqueue(
              encodeSseEvent("done", {
                conversationId,
                completedAt: new Date().toISOString(),
              })
            );
          } catch (error) {
            controller.enqueue(
              encodeSseEvent("error", {
                message: error instanceof Error ? error.message : "Failed to stream platform chat",
              })
            );
          } finally {
            controller.close();
          }
        })();
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

    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to stream platform chat" },
      { status }
    );
  }
}
