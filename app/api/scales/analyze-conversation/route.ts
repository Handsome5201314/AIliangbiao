import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSystemApiKey } from "@/lib/services/apiKeyService";
import { getScaleDefinitionById } from "@/lib/scales/catalog";
import { resolveLocalizedText } from "@/lib/schemas/core/i18n";
import type { ScaleQuestion } from "@/lib/schemas/core/types";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
  timestamp: z.string().optional(),
});

const requestSchema = z.object({
  scaleId: z.string().min(1),
  messages: z.array(messageSchema).min(1),
});

const llmResponseSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.number(),
      score: z.number().nullable(),
      confidence: z.number().min(0).max(1).optional(),
      evidence: z.string().optional(),
    })
  ),
});

type ConversationMessage = z.infer<typeof messageSchema>;

type SuggestedAnswer = {
  questionId: number;
  score: number | null;
  confidence: number;
  evidence: string;
  method: "heuristic" | "llm" | "unanswered";
};

function normalizeText(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

function buildTranscript(messages: ConversationMessage[]): string {
  return messages
    .map((message) => `${message.role === "user" ? "用户" : "助手"}: ${message.content}`)
    .join("\n");
}

function buildHeuristicSuggestions(
  questions: ScaleQuestion[],
  messages: ConversationMessage[]
): SuggestedAnswer[] {
  const normalizedUserText = normalizeText(
    messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join(" ")
  );

  return questions.map((question) => {
    const keywords = question.analysisHints?.keywords ?? [];
    const optionKeywords = question.analysisHints?.optionKeywords ?? [];
    const keywordMatched = keywords.length === 0 || keywords.some((keyword) => normalizedUserText.includes(normalizeText(keyword)));

    if (!keywordMatched || optionKeywords.length === 0) {
      return {
        questionId: question.id,
        score: null,
        confidence: 0,
        evidence: "",
        method: "unanswered",
      };
    }

    let bestSuggestion: SuggestedAnswer | null = null;

    optionKeywords.forEach((optionKeyword) => {
      const matchedKeywords = optionKeyword.keywords.filter((keyword) =>
        normalizedUserText.includes(normalizeText(keyword))
      );

      if (!matchedKeywords.length) {
        return;
      }

      const confidence = Math.min(0.35 + matchedKeywords.length * 0.15, 0.78);
      const suggestion: SuggestedAnswer = {
        questionId: question.id,
        score: optionKeyword.score,
        confidence,
        evidence: matchedKeywords.join("、"),
        method: "heuristic",
      };

      if (!bestSuggestion || suggestion.confidence > bestSuggestion.confidence) {
        bestSuggestion = suggestion;
      }
    });

    return (
      bestSuggestion ?? {
        questionId: question.id,
        score: null,
        confidence: 0,
        evidence: "",
        method: "unanswered",
      }
    );
  });
}

function extractJsonObject(rawContent: string): string {
  const firstBrace = rawContent.indexOf("{");
  const lastBrace = rawContent.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in model response");
  }

  return rawContent.slice(firstBrace, lastBrace + 1);
}

function sanitizeLlmSuggestions(
  questions: ScaleQuestion[],
  suggestions: SuggestedAnswer[],
  llmAnswers: z.infer<typeof llmResponseSchema>["answers"]
): SuggestedAnswer[] {
  const questionMap = new Map(questions.map((question) => [question.id, question]));

  return suggestions.map((suggestion) => {
    const llmAnswer = llmAnswers.find((answer) => answer.questionId === suggestion.questionId);
    const question = questionMap.get(suggestion.questionId);

    if (!llmAnswer || !question) {
      return suggestion;
    }

    const isAllowedScore =
      llmAnswer.score === null ||
      question.options.some((option) => option.score === llmAnswer.score);

    if (!isAllowedScore) {
      return suggestion;
    }

    if (llmAnswer.score === null) {
      return suggestion;
    }

    return {
      questionId: suggestion.questionId,
      score: llmAnswer.score,
      confidence: llmAnswer.confidence ?? 0.82,
      evidence: llmAnswer.evidence ?? "",
      method: "llm",
    };
  });
}

async function requestLlmSuggestions(
  scaleId: string,
  questions: ScaleQuestion[],
  messages: ConversationMessage[]
): Promise<z.infer<typeof llmResponseSchema>["answers"]> {
  const api = await getSystemApiKey();
  const transcript = buildTranscript(messages);
  const compactQuestions = questions.map((question) => ({
    questionId: question.id,
    question: resolveLocalizedText(question.colloquial, "zh"),
    options: question.options.map((option) => ({
      label: option.label,
      score: option.score,
      description: resolveLocalizedText(option.description, "zh"),
    })),
  }));

  const response = await fetch(api.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${api.key}`,
    },
    body: JSON.stringify({
      model: api.model,
      temperature: 0.1,
      max_tokens: 2200,
      messages: [
        {
          role: "system",
          content:
            "You are a clinical extraction engine. Convert a conversation into scale answers. Only use explicit evidence. If insufficient evidence, use null. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Map the conversation to the provided scale answers.",
            scaleId,
            outputSchema: {
              answers: [
                {
                  questionId: "number",
                  score: "number|null",
                  confidence: "0-1",
                  evidence: "short quote or summary",
                },
              ],
            },
            rules: [
              "Never invent symptoms or frequencies.",
              "Use the score values exactly as provided in each question option.",
              "If the chat does not support an answer, return null for score and confidence 0.",
              "Keep evidence short.",
            ],
            questions: compactQuestions,
            transcript,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const rawContent = payload.choices?.[0]?.message?.content;

  if (!rawContent || typeof rawContent !== "string") {
    throw new Error("No valid model response content");
  }

  const parsed = llmResponseSchema.parse(JSON.parse(extractJsonObject(rawContent)));
  return parsed.answers;
}

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const scale = getScaleDefinitionById(body.scaleId);

    if (!scale) {
      return NextResponse.json({ error: "Scale not found" }, { status: 404 });
    }

    const heuristicSuggestions = buildHeuristicSuggestions(scale.questions, body.messages);
    let finalSuggestions = heuristicSuggestions;
    let llmUsed = false;

    try {
      const llmAnswers = await requestLlmSuggestions(scale.id, scale.questions, body.messages);
      finalSuggestions = sanitizeLlmSuggestions(scale.questions, heuristicSuggestions, llmAnswers);
      llmUsed = true;
    } catch (error) {
      console.warn("[Scale Conversation Analysis] Falling back to heuristics:", error);
    }

    const answers = scale.questions.map((question) => {
      const suggestion = finalSuggestions.find((item) => item.questionId === question.id);
      return suggestion?.score ?? null;
    });

    const answeredCount = answers.filter((answer) => answer !== null).length;

    return NextResponse.json({
      scaleId: scale.id,
      coverage: {
        answered: answeredCount,
        total: scale.questions.length,
        ratio: scale.questions.length === 0 ? 0 : answeredCount / scale.questions.length,
      },
      llmUsed,
      answers,
      suggestions: finalSuggestions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to analyze conversation" }, { status: 500 });
  }
}
