import { z } from "zod";

import type { LanguageCode, RiskSignal, VoiceIntent } from "@/lib/schemas/core/types";

export type TriageState =
  | "initial"
  | "triage"
  | "consent"
  | "handoff"
  | "assessment"
  | "paused";

export type TriageAction =
  | "ask_followup"
  | "recommend_scale"
  | "start_scale"
  | "pause_session"
  | "resume_session"
  | "repeat_question"
  | "explain"
  | "risk_escalation"
  | "acknowledge";

export interface TriageContext {
  state: TriageState;
  symptoms: string[];
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: number;
  }>;
  userProfile?: {
    childName?: string;
    childAge?: number;
    parentName?: string;
    relation?: string;
    recentConcerns?: string[];
  };
  recommendedScale?: string;
  consentGiven: boolean;
  language?: LanguageCode;
  pausedFromState?: Exclude<TriageState, "paused">;
  lastAssistantPrompt?: string;
  lastIntent?: VoiceIntent;
}

export interface TriageAIResponse {
  text: string;
  action: TriageAction;
  scaleId?: string;
  confidence: number;
  symptoms?: string[];
  risk?: RiskSignal;
  meta?: {
    reason?: string;
    userIntent?: VoiceIntent;
    rawResponse?: string;
  };
}

export const defaultTriageContext: TriageContext = {
  state: "initial",
  symptoms: [],
  conversationHistory: [],
  consentGiven: false,
  language: "zh",
};

const triageResponseSchema = z.object({
  text: z.string(),
  action: z.enum([
    "ask_followup",
    "recommend_scale",
    "start_scale",
    "pause_session",
    "resume_session",
    "repeat_question",
    "explain",
    "risk_escalation",
    "acknowledge",
  ]),
  scaleId: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.7),
  symptoms: z.array(z.string()).optional(),
  risk: z
    .object({
      level: z.enum(["low", "medium", "high"]),
      type: z.string(),
      evidence: z.string(),
    })
    .optional(),
  meta: z
    .object({
      reason: z.string().optional(),
      userIntent: z
        .enum([
          "answer",
          "irrelevant",
          "pause",
          "repeat",
          "previous",
          "change_answer",
          "resume",
          "explain",
          "skip",
          "quit",
          "switch_member",
          "switch_language",
          "slower",
          "faster",
          "risk_escalation",
        ])
        .optional(),
      rawResponse: z.string().optional(),
    })
    .optional(),
});

const SCALE_RECOMMENDATIONS: Record<
  string,
  {
    title: { zh: string; en: string };
    duration: number;
    reasons: string[];
  }
> = {
  ABC: {
    title: {
      zh: "ABC 孤独症行为评定量表",
      en: "ABC Autism Behavior Checklist",
    },
    duration: 15,
    reasons: ["社交回应少", "重复行为", "语言与互动困难"],
  },
  SRS: {
    title: {
      zh: "SRS 社交反应量表",
      en: "SRS Social Responsiveness Scale",
    },
    duration: 10,
    reasons: ["社交沟通困难", "同伴互动受限", "社交线索理解困难"],
  },
  CARS: {
    title: {
      zh: "CARS 儿童孤独症评定量表",
      en: "CARS Childhood Autism Rating Scale",
    },
    duration: 5,
    reasons: ["症状较集中", "需要更明确的结构化观察", "孤独症相关表现较典型"],
  },
  "SNAP-IV": {
    title: {
      zh: "SNAP-IV 注意力与多动评估量表",
      en: "SNAP-IV Attention and Hyperactivity Scale",
    },
    duration: 5,
    reasons: ["注意力不集中", "坐不住", "冲动或多动表现"],
  },
};

const META_PATTERNS: Record<
  Exclude<TriageAction, "recommend_scale" | "start_scale" | "ask_followup" | "risk_escalation" | "acknowledge">,
  RegExp[]
> = {
  pause_session: [/暂停/, /等一下/, /停一下/, /pause/, /hold on/],
  resume_session: [/继续/, /恢复/, /resume/, /continue/],
  repeat_question: [/再说一遍/, /重复一下/, /重复刚才/, /repeat/, /say that again/],
  explain: [/解释一下/, /没听懂/, /不明白/, /什么意思/, /why this scale/, /explain/],
};

const CONSENT_PATTERNS = [
  /^好$/,
  /^好的$/,
  /^可以$/,
  /^开始$/,
  /^开始吧$/,
  /^行$/,
  /^没问题$/,
  /^yes$/,
  /^ok$/,
  /^okay$/,
  /^let's start$/,
];

const EXPLICIT_SCALE_REQUEST_PATTERNS = [
  /推荐.*量表/,
  /填.*量表/,
  /做.*量表/,
  /开始.*评估/,
  /start.*assessment/,
  /recommend.*scale/,
];

const NO_MATCH_PATTERNS = [
  /天气/,
  /吃饭/,
  /今天天气/,
  /hello/,
  /hi$/,
  /how are you/,
  /在吗/,
];

const RISK_KEYWORDS = [
  "不想活",
  "活不下去",
  "伤害自己",
  "自杀",
  "结束生命",
  "kill myself",
  "hurt myself",
];

const SYMPTOM_RULES: Array<{ symptom: string; keywords: string[] }> = [
  { symptom: "社交回应少", keywords: ["不理人", "不看人", "不回应", "叫名没反应", "社交少"] },
  { symptom: "语言沟通少", keywords: ["不爱说话", "说话少", "不会表达", "沟通困难"] },
  { symptom: "重复行为", keywords: ["重复动作", "刻板行为", "转东西", "反复做"] },
  { symptom: "注意力不集中", keywords: ["注意力不集中", "容易分心", "坐不住", "注意力差"] },
  { symptom: "多动冲动", keywords: ["多动", "停不下来", "冲动", "坐不住"] },
  { symptom: "情绪焦虑", keywords: ["焦虑", "害怕", "紧张", "担心"] },
  { symptom: "社交沟通困难", keywords: ["不合群", "不会和小朋友玩", "社交困难", "不会交流"] },
];

function normalizeInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"'，。！？；：“”‘’]/g, " ")
    .replace(/\s+/g, " ");
}

function matchesAny(patterns: RegExp[], value: string): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function extractJsonPayload(raw: string): unknown | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to fenced/embedded extraction.
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // Continue to embedded extraction.
    }
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    try {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeScaleId(scaleId?: string): string | undefined {
  if (!scaleId) {
    return undefined;
  }

  const next = scaleId.toUpperCase();
  return SCALE_RECOMMENDATIONS[next] ? next : next;
}

export function buildScaleRecommendationCopy(scaleId: string, language: LanguageCode = "zh"): string {
  const recommendation = SCALE_RECOMMENDATIONS[scaleId];
  if (!recommendation) {
    return language === "en"
      ? `I recommend the ${scaleId} scale. Would you like to start now?`
      : `我建议先做 ${scaleId} 量表。您看现在方便开始吗？`;
  }

  if (language === "en") {
    return `I recommend the ${recommendation.title.en}. It usually takes about ${recommendation.duration} minutes. Would you like to start now?`;
  }

  return `我建议先做${recommendation.title.zh}，大约需要 ${recommendation.duration} 分钟。您看现在方便开始吗？`;
}

export function extractSymptomsFromTranscript(message: string, existingSymptoms: string[] = []): string[] {
  const nextSymptoms = new Set(existingSymptoms);
  const normalized = normalizeInput(message);

  for (const rule of SYMPTOM_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(normalizeInput(keyword)))) {
      nextSymptoms.add(rule.symptom);
    }
  }

  return [...nextSymptoms];
}

export function recommendScaleFromSymptoms(symptoms: string[], userMessage = ""): string | undefined {
  const joined = `${symptoms.join(" ")} ${userMessage}`.toLowerCase();

  if (/(注意力|多动|冲动|坐不住|adhd|hyper)/.test(joined)) {
    return "SNAP-IV";
  }

  if (/(重复|刻板|转东西|自闭|孤独症|autism)/.test(joined)) {
    return symptoms.length >= 3 ? "CARS" : "ABC";
  }

  if (/(社交|不合群|不理人|不看人|沟通|语言)/.test(joined)) {
    return symptoms.length >= 3 ? "SRS" : "ABC";
  }

  return symptoms.length >= 2 ? "SRS" : undefined;
}

function buildLocalMetaResponse(
  action: TriageAction,
  language: LanguageCode,
  context: TriageContext
): TriageAIResponse {
  switch (action) {
    case "pause_session":
      return {
        text: language === "en" ? "Sure, we can pause here. Say continue when you're ready." : "好的，我们先暂停。您准备好了再说“继续”就可以。",
        action,
        confidence: 0.99,
        meta: { reason: "local meta intent", userIntent: "pause" },
      };
    case "resume_session":
      return {
        text:
          language === "en"
            ? "Okay, let's continue from where we left off."
            : "好的，我们继续刚才的分诊流程。",
        action,
        confidence: 0.99,
        meta: { reason: "local meta intent", userIntent: "resume" },
      };
    case "repeat_question":
      return {
        text:
          context.lastAssistantPrompt ||
          (language === "en" ? "I'll repeat the last question." : "好的，我把刚才的问题再说一遍。"),
        action,
        confidence: 0.99,
        meta: { reason: "local meta intent", userIntent: "repeat" },
      };
    case "explain":
      return {
        text:
          context.recommendedScale
            ? buildScaleRecommendationCopy(context.recommendedScale, language)
            : language === "en"
              ? "You can describe what has been happening recently, and I will help narrow down the right scale."
              : "您可以继续描述最近最困扰的表现，我会帮您一步步判断更合适的量表。",
        action,
        confidence: 0.98,
        meta: { reason: "local meta intent", userIntent: "explain" },
      };
    default:
      return {
        text: language === "en" ? "Let's continue." : "我们继续。",
        action: "acknowledge",
        confidence: 0.7,
      };
  }
}

export function detectLocalTriageIntent(
  userMessage: string,
  context: TriageContext,
  language: LanguageCode = "zh"
): TriageAIResponse | null {
  const normalized = normalizeInput(userMessage);

  if (RISK_KEYWORDS.some((keyword) => normalized.includes(normalizeInput(keyword)))) {
    return {
      text:
        language === "en"
          ? "I heard something that may involve immediate safety risk. Please contact a trusted person, clinician, or emergency support right away."
          : "我听到了一些可能涉及即时安全风险的表达。请尽快联系可信赖的家人、医生或紧急支持资源。",
      action: "risk_escalation",
      confidence: 0.99,
      risk: {
        level: "high",
        type: "self_harm",
        evidence: userMessage,
      },
      meta: {
        reason: "local risk keyword match",
        userIntent: "risk_escalation",
      },
    };
  }

  for (const [action, patterns] of Object.entries(META_PATTERNS)) {
    if (matchesAny(patterns, normalized)) {
      return buildLocalMetaResponse(action as TriageAction, language, context);
    }
  }

  if (context.recommendedScale && context.state === "consent" && matchesAny(CONSENT_PATTERNS, normalized)) {
    return {
      text:
        language === "en"
          ? `Okay, I'll start the ${context.recommendedScale} assessment now.`
          : `好的，马上为您开始 ${context.recommendedScale} 评估。`,
      action: "start_scale",
      scaleId: context.recommendedScale,
      confidence: 0.99,
      meta: {
        reason: "local affirmative consent",
        userIntent: "answer",
      },
    };
  }

  if (EXPLICIT_SCALE_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized))) {
    const recommendedScale = recommendScaleFromSymptoms(context.symptoms, userMessage);
    if (recommendedScale) {
      return {
        text: buildScaleRecommendationCopy(recommendedScale, language),
        action: "recommend_scale",
        scaleId: recommendedScale,
        confidence: 0.95,
        symptoms: context.symptoms,
        meta: {
          reason: "local explicit scale request",
          userIntent: "answer",
        },
      };
    }
  }

  if (NO_MATCH_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      text:
        language === "en"
          ? "I can help with the assessment. Please tell me the main symptom or concern you want to evaluate."
          : "我现在先帮你做评估分诊。你可以直接告诉我，最想评估的主要症状或困扰是什么。",
      action: "acknowledge",
      confidence: 0.82,
      meta: {
        reason: "local irrelevant input",
        userIntent: "irrelevant",
      },
    };
  }

  return null;
}

export const TRIAGE_SYSTEM_PROMPT = `你是一个温柔、专业、极其注重安全性的家庭健康分诊助手。你的工作不是直接做结论，而是通过简短追问，帮助用户找到更合适的量表。

请严格遵守以下规则：
1. 必须使用与用户当前界面一致的语言回复。
2. 每次回复尽量控制在 1-2 句，适合语音播报。
3. 如果信息不足，就继续追问，不要过早推荐量表。
4. 只有在症状达到 2 个以上，或者用户明确要求做量表时，才进入 recommend_scale。
5. 如果用户已经在 consent 阶段并明确同意开始，则进入 start_scale。
6. 如果用户说“重复一遍”“暂停”“继续”“解释一下”，必须优先处理这些元意图。
7. 如果检测到自伤、自杀、伤人或严重风险，必须进入 risk_escalation，不要继续普通分诊。
8. 只能返回 JSON，不要返回 Markdown，不要返回多余解释。

返回 JSON 格式如下：
{
  "text": "给用户播放的简短话术",
  "action": "ask_followup | recommend_scale | start_scale | pause_session | resume_session | repeat_question | explain | risk_escalation | acknowledge",
  "scaleId": "ABC | SRS | CARS | SNAP-IV",
  "confidence": 0.0,
  "symptoms": ["抽取到的症状短语"],
  "risk": {
    "level": "low | medium | high",
    "type": "风险类型",
    "evidence": "原始证据"
  },
  "meta": {
    "reason": "为什么这么判断",
    "userIntent": "answer | repeat | pause | resume | explain | risk_escalation"
  }
}

如果没有风险，就不要输出 risk 字段。`;

export function parseAIResponse(rawResponse: string): TriageAIResponse {
  const payload = extractJsonPayload(rawResponse);

  if (payload) {
    try {
      const parsed = triageResponseSchema.parse(payload);
      return {
        ...parsed,
        scaleId: normalizeScaleId(parsed.scaleId),
        meta: {
          ...parsed.meta,
          rawResponse,
        },
      };
    } catch {
      // Fall through to tag-based compatibility parsing.
    }
  }

  const recommendMatch = rawResponse.match(/\[RECOMMEND:([A-Z-]+)\]/i);
  if (recommendMatch) {
    return {
      text: rawResponse.replace(/\[RECOMMEND:[A-Z-]+\]/gi, "").trim(),
      action: "recommend_scale",
      scaleId: normalizeScaleId(recommendMatch[1]),
      confidence: 0.75,
      meta: {
        reason: "legacy recommend tag",
        rawResponse,
      },
    };
  }

  const scaleMatch = rawResponse.match(/\[SCALE:([A-Z-]+)\]/i);
  if (scaleMatch) {
    return {
      text: rawResponse.replace(/\[SCALE:[A-Z-]+\]/gi, "").trim(),
      action: "start_scale",
      scaleId: normalizeScaleId(scaleMatch[1]),
      confidence: 0.75,
      meta: {
        reason: "legacy start tag",
        rawResponse,
      },
    };
  }

  return {
    text: rawResponse.trim(),
    action: "acknowledge",
    confidence: 0.5,
    meta: {
      reason: "plain text fallback",
      rawResponse,
    },
  };
}

export function generateTriagePrompt(
  userMessage: string,
  context: TriageContext,
  userProfile?: {
    nickname?: string;
    ageMonths?: number;
    relation?: string;
  }
): string {
  const conversationHistory = context.conversationHistory
    .slice(-8)
    .map((message) => `${message.role === "user" ? "用户" : "助手"}: ${message.content}`)
    .join("\n");

  const symptomsSummary = context.symptoms.length
    ? context.symptoms.map((symptom, index) => `${index + 1}. ${symptom}`).join("\n")
    : "暂无明确症状";

  const profileSummary = userProfile
    ? [
        `当前评测对象：${userProfile.nickname || "家庭成员"}`,
        `年龄：${
          userProfile.ageMonths
            ? `${Math.floor(userProfile.ageMonths / 12)}岁${userProfile.ageMonths % 12}个月`
            : "未知"
        }`,
        userProfile.relation ? `家庭关系：${userProfile.relation}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "当前评测对象信息未知";

  const recommendedScale = context.recommendedScale ? `当前已推荐量表：${context.recommendedScale}` : "当前尚未推荐量表";

  return [
    `当前界面语言：${context.language ?? "zh"}`,
    `当前分诊状态：${context.state}`,
    recommendedScale,
    profileSummary,
    `已提取症状：\n${symptomsSummary}`,
    `最近对话：\n${conversationHistory || "无"}`,
    `用户本轮输入：${userMessage}`,
    "请严格返回 JSON 对象。不要输出 Markdown。不要输出代码块。",
  ].join("\n\n");
}
