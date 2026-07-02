import type {
  LanguageCode,
  ScaleOption,
  ScaleQuestion,
  VoiceIntentResult,
} from "@/lib/schemas/core/types";
import { resolveLocalizedText } from "@/lib/schemas/core/i18n";
import {
  HIGH_CONFIDENCE_THRESHOLD,
  MEDIUM_CONFIDENCE_THRESHOLD,
} from "@/lib/services/voiceRules";

const META_INTENT_PATTERNS = {
  repeat: [/再说一遍/, /重复/, /再重复/, /repeat/, /say that again/],
  previous: [/上一题/, /上一个/, /退回/, /返回上一题/, /go back/, /previous/],
  explain: [/解释/, /没听懂/, /不明白/, /什么意思/, /explain/, /what does that mean/],
  pause: [/暂停/, /等一下/, /停一下/, /pause/, /hold on/],
  resume: [/继续/, /恢复/, /resume/, /continue/],
};

const RISK_PATTERNS = [
  "不想活",
  "伤害自己",
  "自杀",
  "结束生命",
  "kill myself",
  "hurt myself",
];

const UNCERTAIN_PATTERNS = [
  /不清楚/,
  /不确定/,
  /说不好/,
  /不好说/,
  /可能/,
  /大概/,
  /也许/,
  /好像/,
  /偶尔/,
  /有时/,
  /三天.*两/,
  /两.*三天/,
  /sometimes/,
  /maybe/,
  /not sure/,
  /hard to say/,
];

const AFFIRMATIVE_PATTERNS = [
  /^是$/,
  /^对$/,
  /^有$/,
  /^会$/,
  /^可以$/,
  /^能$/,
  /会回应/,
  /有回应/,
  /可以做到/,
  /\byes\b/,
  /\bright\b/,
  /\bcorrect\b/,
];

const NEGATIVE_PATTERNS = [
  /^不是$/,
  /^不对$/,
  /^没有$/,
  /^不会$/,
  /^不能$/,
  /^不可以$/,
  /没有回应/,
  /不会回应/,
  /\bno\b/,
  /\bnever\b/,
  /\bnot\b/,
];

function normalizeTranscript(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"'，。！？；：“”‘’]/g, " ")
    .replace(/\s+/g, " ");
}

function matchesPattern(patterns: RegExp[], transcript: string): boolean {
  return patterns.some((pattern) => pattern.test(transcript));
}

function buildCandidateTexts(option: ScaleOption, index: number, optionCount: number): string[] {
  const baseCandidates = [option.label, ...(option.aliases ?? [])]
    .map(normalizeTranscript)
    .filter(Boolean);

  if (optionCount === 2) {
    if (index === 0) {
      baseCandidates.push("a", "option a", "first", "the first one", "前者", "第一个", "选a", "选a项");
    }

    if (index === 1) {
      baseCandidates.push("b", "option b", "second", "the second one", "后者", "第二个", "选b", "选b项");
    }
  }

  return [...new Set(baseCandidates)];
}

function optionText(option: ScaleOption) {
  return [option.label, ...(option.aliases ?? [])].map(normalizeTranscript).join(" ");
}

function findBinaryOption(question: ScaleQuestion, kind: "affirmative" | "negative") {
  const patterns = kind === "affirmative" ? AFFIRMATIVE_PATTERNS : NEGATIVE_PATTERNS;
  return question.options.find((option) => matchesPattern(patterns, optionText(option)));
}

function buildAnswerResult(input: {
  question: ScaleQuestion;
  option: ScaleOption;
  transcript: string;
  normalized: string;
  confidence: number;
  evidence?: string;
  needsConfirmation?: boolean;
}): VoiceIntentResult {
  return {
    intent: "answer",
    confidence: input.confidence,
    answer: {
      questionId: input.question.id,
      score: input.option.score,
      label: input.option.label,
    },
    meta: {
      rawTranscript: input.transcript,
      normalizedText: input.normalized,
      evidence: input.evidence,
      needsConfirmation: input.needsConfirmation || undefined,
    },
  };
}

function fuzzyResult(transcript: string, normalized: string): VoiceIntentResult {
  return {
    intent: "irrelevant",
    confidence: 0.42,
    meta: {
      rawTranscript: transcript,
      normalizedText: normalized,
      needsFallbackPrompt: true,
      reason: "uncertain_or_fuzzy_parent_utterance",
    },
  };
}

export function resolveLocalQuestionnaireVoiceIntent(input: {
  question: ScaleQuestion;
  transcript: string;
  language: LanguageCode;
}): VoiceIntentResult {
  const normalized = normalizeTranscript(input.transcript);

  for (const metaIntent of Object.entries(META_INTENT_PATTERNS)) {
    if (matchesPattern(metaIntent[1], normalized)) {
      return {
        intent: metaIntent[0] as VoiceIntentResult["intent"],
        confidence: 0.96,
        meta: {
          rawTranscript: input.transcript,
          normalizedText: normalized,
        },
      };
    }
  }

  if (RISK_PATTERNS.some((keyword) => normalized.includes(normalizeTranscript(keyword)))) {
    return {
      intent: "risk_escalation",
      confidence: 0.98,
      risk: {
        level: "high",
        type: "self_harm",
        evidence: input.transcript,
      },
      meta: {
        rawTranscript: input.transcript,
        normalizedText: normalized,
      },
    };
  }

  if (matchesPattern(UNCERTAIN_PATTERNS, normalized)) {
    return fuzzyResult(input.transcript, normalized);
  }

  if (input.question.options.length === 2) {
    const affirmative = findBinaryOption(input.question, "affirmative");
    const negative = findBinaryOption(input.question, "negative");

    if (negative && matchesPattern(NEGATIVE_PATTERNS, normalized)) {
      return buildAnswerResult({
        question: input.question,
        option: negative,
        transcript: input.transcript,
        normalized,
        confidence: 0.93,
        evidence: "binary_negative",
      });
    }

    if (affirmative && matchesPattern(AFFIRMATIVE_PATTERNS, normalized)) {
      return buildAnswerResult({
        question: input.question,
        option: affirmative,
        transcript: input.transcript,
        normalized,
        confidence: 0.93,
        evidence: "binary_affirmative",
      });
    }
  }

  if (input.question.answerMappingHints?.phrases?.length) {
    for (const phrase of input.question.answerMappingHints.phrases) {
      if (phrase.keywords.some((keyword) => normalized.includes(normalizeTranscript(keyword)))) {
        const matchedOption = input.question.options.find((option) => option.score === phrase.score);
        if (matchedOption) {
          return buildAnswerResult({
            question: input.question,
            option: matchedOption,
            transcript: input.transcript,
            normalized,
            confidence: HIGH_CONFIDENCE_THRESHOLD,
            evidence: phrase.keywords.find((keyword) => normalized.includes(normalizeTranscript(keyword))),
          });
        }
      }
    }
  }

  for (let index = 0; index < input.question.options.length; index += 1) {
    const option = input.question.options[index];
    const candidates = buildCandidateTexts(option, index, input.question.options.length);
    const evidence = candidates.find((candidate) => candidate && normalized.includes(candidate));

    if (evidence) {
      return buildAnswerResult({
        question: input.question,
        option,
        transcript: input.transcript,
        normalized,
        confidence: 0.95,
        evidence,
      });
    }
  }

  if (input.question.analysisHints?.optionKeywords?.length) {
    for (const optionKeyword of input.question.analysisHints.optionKeywords) {
      const evidence = optionKeyword.keywords.find((keyword) => normalized.includes(normalizeTranscript(keyword)));
      if (evidence) {
        const matchedOption = input.question.options.find((option) => option.score === optionKeyword.score);
        if (matchedOption) {
          return buildAnswerResult({
            question: input.question,
            option: matchedOption,
            transcript: input.transcript,
            normalized,
            confidence: MEDIUM_CONFIDENCE_THRESHOLD,
            evidence,
            needsConfirmation: true,
          });
        }
      }
    }
  }

  const sortedOptions = [...input.question.options].sort((left, right) => left.score - right.score);
  const genericMappings = [
    {
      score: sortedOptions[Math.max(0, sortedOptions.length - 2)]?.score,
      patterns: [
        "经常",
        "不少",
        "一半以上",
        "often",
        "frequently",
        "more than half",
        "most weeks",
      ],
    },
    {
      score: sortedOptions[sortedOptions.length - 1]?.score,
      patterns: [
        "总是",
        "每天",
        "几乎每天",
        "always",
        "every day",
        "nearly every day",
        "almost every day",
        "most days",
        "all the time",
        "constantly",
      ],
    },
  ];

  for (const mapping of genericMappings) {
    const evidence = mapping.patterns.find((pattern) => normalized.includes(normalizeTranscript(pattern)));
    if (mapping.score !== undefined && evidence) {
      const matchedOption = input.question.options.find((option) => option.score === mapping.score);
      if (matchedOption) {
        return buildAnswerResult({
          question: input.question,
          option: matchedOption,
          transcript: input.transcript,
          normalized,
          confidence: 0.72,
          evidence,
          needsConfirmation: true,
        });
      }
    }
  }

  return {
    intent: "irrelevant",
    confidence: 0.32,
    meta: {
      rawTranscript: input.transcript,
      normalizedText: normalized,
      needsFallbackPrompt: true,
    },
  };
}

export function needsClarification(result: VoiceIntentResult): boolean {
  if (result.intent === "repeat" || result.intent === "previous" || result.intent === "explain") {
    return false;
  }

  if (result.intent === "pause" || result.intent === "resume" || result.intent === "risk_escalation") {
    return false;
  }

  if (result.meta?.needsFallbackPrompt) {
    return true;
  }

  if (result.intent !== "answer") {
    return true;
  }

  return result.confidence < MEDIUM_CONFIDENCE_THRESHOLD;
}

export function buildClarificationIntent(input: {
  transcript: string;
  language: LanguageCode;
  reason: string;
}): VoiceIntentResult {
  const followUpQuestion =
    input.language === "en"
      ? "I still need to confirm this answer. Please choose a clear option, or describe it again in one sentence."
      : "我还需要再具体确认一下。请直接选择一个明确选项，或者用一句话再说清楚。";

  return {
    intent: "irrelevant",
    confidence: 0.45,
    meta: {
      rawTranscript: input.transcript,
      normalizedText: normalizeTranscript(input.transcript),
      needsFallbackPrompt: true,
      needsConfirmation: true,
      reason: input.reason,
      followUpQuestion,
    },
  };
}

export function buildQuestionnaireMappingContext(input: {
  scaleId: string;
  question: ScaleQuestion;
  transcript: string;
  language: LanguageCode;
}) {
  return {
    scaleId: input.scaleId,
    question: {
      id: input.question.id,
      text: resolveLocalizedText(input.question.text, input.language),
      colloquial: resolveLocalizedText(input.question.colloquial, input.language),
      riskLevel: input.question.riskLevel || "normal",
      options: input.question.options.map((option) => ({
        label: option.label,
        score: option.score,
        aliases: option.aliases || [],
        description: resolveLocalizedText(option.description, input.language),
      })),
    },
    transcript: input.transcript,
    language: input.language,
  };
}
