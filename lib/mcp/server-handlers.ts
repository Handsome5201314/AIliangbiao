import { z } from "zod";

import { evaluateScaleAnswers, getScaleDefinitionById, listSerializableScales } from "@/lib/scales/catalog";
import { resolveLocalizedText } from "@/lib/schemas/core/i18n";

const symptomKeywords: Record<string, string[]> = {
  ABC: ["社交", "不理人", "重复动作", "刻板", "眼神", "自闭"],
  CARS: ["诊断", "严重程度", "模仿", "情感反应", "感官"],
  SRS: ["社交困难", "同伴关系", "眼神接触", "不合群"],
  "SNAP-IV": ["注意力", "多动", "坐不住", "冲动"],
  "PHQ-9": ["抑郁", "低落", "没兴趣", "绝望", "失眠"],
  "GAD-7": ["焦虑", "紧张", "担心", "坐立不安", "易怒"],
};

export async function listTools() {
  return {
    tools: [
      {
        name: "recommend_scale",
        description: "Recommend scales by symptom keywords",
        inputSchema: {
          type: "object" as const,
          properties: {
            symptoms: {
              type: "string",
              description: "Comma separated symptom summary",
            },
          },
          required: ["symptoms"],
        },
      },
      {
        name: "get_scale_questions",
        description: "Get question list for a scale",
        inputSchema: {
          type: "object" as const,
          properties: {
            scaleId: {
              type: "string",
              description: "Scale ID",
            },
            offset: {
              type: "number",
              description: "Start offset",
            },
            limit: {
              type: "number",
              description: "Page size",
            },
          },
          required: ["scaleId"],
        },
      },
      {
        name: "submit_and_evaluate",
        description: "Evaluate answers with the deterministic scoring engine",
        inputSchema: {
          type: "object" as const,
          properties: {
            scaleId: {
              type: "string",
              description: "Scale ID",
            },
            answers: {
              type: "array",
              items: { type: "number" },
              description: "Answer scores in order",
            },
          },
          required: ["scaleId", "answers"],
        },
      },
    ],
  };
}

export async function handleToolCall(params: {
  name: string;
  arguments: unknown;
}): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const { name, arguments: args } = params;

  switch (name) {
    case "recommend_scale": {
      const parsed = z.object({ symptoms: z.string() }).parse(args);
      const availableScales = listSerializableScales();
      const matchedScales = availableScales.filter((scale) => {
        const keywords = symptomKeywords[scale.id] || [];
        return keywords.some((keyword) => parsed.symptoms.includes(keyword));
      });

      const recommendations = matchedScales.length > 0
        ? matchedScales
        : availableScales.filter((scale) => scale.id === "ABC").slice(0, 1);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              recommendations.map((scale) => ({
                id: scale.id,
                title: resolveLocalizedText(scale.title, "zh"),
                description: resolveLocalizedText(scale.description, "zh"),
              })),
              null,
              2
            ),
          },
        ],
      };
    }

    case "get_scale_questions": {
      const parsed = z
        .object({
          scaleId: z.string(),
          offset: z.number().optional().default(0),
          limit: z.number().optional().default(5),
        })
        .parse(args);

      const scale = getScaleDefinitionById(parsed.scaleId);
      if (!scale) {
        return {
          content: [{ type: "text", text: `Scale "${parsed.scaleId}" not found` }],
          isError: true,
        };
      }

      const pagedQuestions = scale.questions.slice(parsed.offset, parsed.offset + parsed.limit);
      const hasMore = parsed.offset + parsed.limit < scale.questions.length;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                scaleId: scale.id,
                total: scale.questions.length,
                hasMore,
                questions: pagedQuestions.map((question) => ({
                  ...question,
                  text: resolveLocalizedText(question.text, "zh"),
                  colloquial: resolveLocalizedText(question.colloquial, "zh"),
                  fallback_examples: question.fallback_examples.map((item) => resolveLocalizedText(item, "zh")),
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "submit_and_evaluate": {
      const parsed = z
        .object({
          scaleId: z.string(),
          answers: z.array(z.number()),
        })
        .parse(args);

      const scale = getScaleDefinitionById(parsed.scaleId);
      if (!scale) {
        return {
          content: [{ type: "text", text: `Scale "${parsed.scaleId}" not found` }],
          isError: true,
        };
      }

      if (parsed.answers.length !== scale.questions.length) {
        return {
          content: [
            {
              type: "text",
              text: `Expected ${scale.questions.length} answers, received ${parsed.answers.length}`,
            },
          ],
          isError: true,
        };
      }

      const result = evaluateScaleAnswers(scale.id, parsed.answers);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
