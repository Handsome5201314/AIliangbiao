import type { LanguageCode, LocalizedTextValue, ScaleQuestion } from "./types";

export function resolveLocalizedText(
  value: LocalizedTextValue | undefined,
  language: LanguageCode = "zh"
): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return value[language] ?? value.zh ?? value.en ?? "";
}

export function resolveQuestionText(
  question: Pick<ScaleQuestion, "text">,
  language: LanguageCode = "zh"
): string {
  return resolveLocalizedText(question.text, language);
}

export function resolveQuestionColloquial(
  question: Pick<ScaleQuestion, "colloquial" | "text">,
  language: LanguageCode = "zh"
): string {
  return resolveLocalizedText(question.colloquial, language) || resolveLocalizedText(question.text, language);
}

export function resolveQuestionVoicePrompt(
  question: Pick<ScaleQuestion, "voicePrompt" | "colloquial" | "text">,
  language: LanguageCode = "zh"
): string {
  return (
    resolveLocalizedText(question.voicePrompt, language) ||
    resolveLocalizedText(question.colloquial, language) ||
    resolveLocalizedText(question.text, language)
  );
}

export function resolveQuestionSimpleExplain(
  question: Pick<ScaleQuestion, "simpleExplain" | "fallback_examples" | "colloquial" | "text">,
  language: LanguageCode = "zh"
): string {
  return (
    resolveLocalizedText(question.simpleExplain, language) ||
    resolveLocalizedText(question.fallback_examples?.[0], language) ||
    resolveLocalizedText(question.colloquial, language) ||
    resolveLocalizedText(question.text, language)
  );
}

export function resolveQuestionConfirmationPrompt(
  question: Pick<ScaleQuestion, "confirmationPrompt" | "colloquial" | "text">,
  language: LanguageCode = "zh"
): string {
  return (
    resolveLocalizedText(question.confirmationPrompt, language) ||
    resolveLocalizedText(question.colloquial, language) ||
    resolveLocalizedText(question.text, language)
  );
}

export function resolveFallbackExamples(
  question: Pick<ScaleQuestion, "fallback_examples">,
  language: LanguageCode = "zh"
): string[] {
  return question.fallback_examples.map((item) => resolveLocalizedText(item, language)).filter(Boolean);
}
