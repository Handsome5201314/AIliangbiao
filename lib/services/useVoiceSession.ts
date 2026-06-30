'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import {
  resolveLocalizedText,
  resolveQuestionConfirmationPrompt,
  resolveQuestionSimpleExplain,
  resolveQuestionVoicePrompt,
} from "@/lib/schemas/core/i18n";
import type {
  LanguageCode,
  ScaleOption,
  ScaleQuestion,
  VoiceAnswer,
  VoiceIntentResult,
  VoiceSessionMode,
} from "@/lib/schemas/core/types";
import { parseVoiceIntentResponse } from "@/lib/services/voiceProtocol";
import { resolveLocalQuestionnaireVoiceIntent } from "@/lib/services/voice-answer-mapping";
import {
  HIGH_CONFIDENCE_THRESHOLD,
  MEDIUM_CONFIDENCE_THRESHOLD,
  shouldAutoAccept,
  shouldConfirm,
} from "@/lib/services/voiceRules";
import {
  createVoiceSessionState,
  voiceSessionReducer,
} from "@/lib/services/voiceSession";

interface UseVoiceSessionOptions {
  scaleId: string;
  skillToken?: string;
  language: LanguageCode;
  mode: VoiceSessionMode;
  requiresConfirmation?: boolean;
  question: ScaleQuestion;
  questionIndex: number;
  questionCount: number;
  currentAnswer: number | null;
  onAnswer: (score: number) => Promise<void> | void;
  onPrevious?: () => void;
  transcribeAudio?: (audioBlob: Blob) => Promise<string>;
  resolveQuestionnaireIntentOverride?: (input: {
    scaleId: string;
    question: ScaleQuestion;
    language: LanguageCode;
    transcript: string;
  }) => Promise<VoiceIntentResult>;
}

interface UseVoiceSessionResult {
  session: ReturnType<typeof createVoiceSessionState>;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecording: () => void;
  speakCurrentQuestion: () => void;
  speakExplanation: () => void;
  repeatQuestion: () => void;
  goPrevious: () => void;
  togglePause: () => void;
  confirmPendingAnswer: (confirmed: boolean) => Promise<void>;
}

type ClientVoiceEventType =
  | "assistant_prompt"
  | "answer_confirmation"
  | "tool_call"
  | "tts_output"
  | "fallback"
  | "error"
  | "assessment_answer_committed";

const META_INTENT_PATTERNS = {
  repeat: [/再说一遍/, /重复/, /再重复/, /repeat/, /say that again/],
  previous: [/上一题/, /上一个/, /退回/, /返回上一题/, /go back/, /previous/],
  explain: [/解释/, /没听懂/, /不明白/, /什么意思/, /explain/, /what does that mean/],
  pause: [/暂停/, /等一下/, /停一下/, /pause/, /hold on/],
  resume: [/继续/, /恢复/, /resume/, /continue/],
};

const CONFIRM_PATTERNS = {
  yes: [/^对$/, /^是$/, /^好$/, /^好的$/, /^确认$/, /^yes$/, /^correct$/, /^right$/, /^ok$/],
  no: [/^不对$/, /^不是$/, /^不$/, /^no$/, /^wrong$/, /^change$/],
};

const RISK_PATTERNS = [
  "不想活",
  "伤害自己",
  "自杀",
  "结束生命",
  "kill myself",
  "hurt myself",
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

function buildOptionVoiceCopy(option: ScaleOption, language: LanguageCode): string {
  const description = resolveLocalizedText(option.description, language);
  if (!description) {
    return option.label;
  }

  return language === "en"
    ? `${option.label}: ${description}`
    : `${option.label}：${description}`;
}

function buildQuestionVoiceCopy(question: ScaleQuestion, language: LanguageCode): string {
  const prompt = resolveQuestionVoicePrompt(question, language);
  const optionCopies = question.options.map((option) => buildOptionVoiceCopy(option, language)).filter(Boolean);

  if (!optionCopies.length) {
    return prompt;
  }

  return language === "en"
    ? `${prompt} Options: ${optionCopies.join("; ")}`
    : `${prompt}。可选答案有：${optionCopies.join("；")}`;
}

function detectAnswerIntent(question: ScaleQuestion, transcript: string): VoiceIntentResult {
  const normalized = normalizeTranscript(transcript);

  for (const metaIntent of Object.entries(META_INTENT_PATTERNS)) {
    if (matchesPattern(metaIntent[1], normalized)) {
      return {
        intent: metaIntent[0] as VoiceIntentResult["intent"],
        confidence: 0.96,
        meta: {
          rawTranscript: transcript,
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
        evidence: transcript,
      },
      meta: {
        rawTranscript: transcript,
        normalizedText: normalized,
      },
    };
  }

  if (question.answerMappingHints?.phrases?.length) {
    for (const phrase of question.answerMappingHints.phrases) {
      if (phrase.keywords.some((keyword) => normalized.includes(normalizeTranscript(keyword)))) {
        const matchedOption = question.options.find((option) => option.score === phrase.score);
        if (matchedOption) {
          return {
            intent: "answer",
            confidence: HIGH_CONFIDENCE_THRESHOLD,
            answer: {
              questionId: question.id,
              score: matchedOption.score,
              label: matchedOption.label,
            },
            meta: {
              rawTranscript: transcript,
              normalizedText: normalized,
              evidence: phrase.keywords.find((keyword) => normalized.includes(normalizeTranscript(keyword))),
            },
          };
        }
      }
    }
  }

  for (let index = 0; index < question.options.length; index += 1) {
    const option = question.options[index];
    const candidates = buildCandidateTexts(option, index, question.options.length);

    if (candidates.some((candidate) => candidate && normalized.includes(candidate))) {
      return {
        intent: "answer",
        confidence: 0.95,
        answer: {
          questionId: question.id,
          score: option.score,
          label: option.label,
        },
        meta: {
          rawTranscript: transcript,
          normalizedText: normalized,
          evidence: candidates.find((candidate) => candidate && normalized.includes(candidate)),
        },
      };
    }
  }

  if (question.analysisHints?.optionKeywords?.length) {
    for (const optionKeyword of question.analysisHints.optionKeywords) {
      if (optionKeyword.keywords.some((keyword) => normalized.includes(normalizeTranscript(keyword)))) {
        const matchedOption = question.options.find((option) => option.score === optionKeyword.score);
        if (matchedOption) {
          return {
            intent: "answer",
            confidence: MEDIUM_CONFIDENCE_THRESHOLD,
            answer: {
              questionId: question.id,
              score: matchedOption.score,
              label: matchedOption.label,
            },
            meta: {
              rawTranscript: transcript,
              normalizedText: normalized,
              evidence: optionKeyword.keywords.find((keyword) => normalized.includes(normalizeTranscript(keyword))),
              needsConfirmation: true,
            },
          };
        }
      }
    }
  }

  const sortedOptions = [...question.options].sort((left, right) => left.score - right.score);
  const genericMappings = [
    {
      score: sortedOptions[0]?.score,
      patterns: ["没有", "从不", "完全没有", "never", "not at all", "none", "no problem"],
    },
    {
      score: sortedOptions[1]?.score ?? sortedOptions[0]?.score,
      patterns: ["偶尔", "有时", "几天", "sometimes", "a few days", "several days", "once in a while"],
    },
    {
      score: sortedOptions[Math.max(0, sortedOptions.length - 2)]?.score,
      patterns: [
        "经常",
        "不少",
        "一半以上",
        "often",
        "frequently",
        "more than half",
        "more than half the days",
        "half the days",
        "about half the days",
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
    if (
      mapping.score !== undefined &&
      mapping.patterns.some((pattern) => normalized.includes(normalizeTranscript(pattern)))
    ) {
      const matchedOption = question.options.find((option) => option.score === mapping.score);
      if (matchedOption) {
        return {
          intent: "answer",
          confidence: 0.65,
          answer: {
            questionId: question.id,
            score: matchedOption.score,
            label: matchedOption.label,
          },
          meta: {
            rawTranscript: transcript,
            normalizedText: normalized,
            needsConfirmation: true,
          },
        };
      }
    }
  }

  return {
    intent: "irrelevant",
    confidence: 0.32,
    meta: {
      rawTranscript: transcript,
      normalizedText: normalized,
      needsFallbackPrompt: true,
    },
  };
}

async function fetchQuestionnaireIntent(input: {
  scaleId: string;
  question: ScaleQuestion;
  language: LanguageCode;
  transcript: string;
  skillToken?: string;
  conversationSessionId?: string;
}): Promise<{ result: VoiceIntentResult; conversationSessionId?: string }> {
  if (!input.skillToken) {
    throw new Error("Skill session is not ready yet.");
  }

  const response = await fetch("/api/skill/v1/voice-intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.skillToken}`,
    },
    body: JSON.stringify({
      mode: "questionnaire",
      scaleId: input.scaleId,
      questionId: input.question.id,
      language: input.language,
      transcript: input.transcript,
      conversationSessionId: input.conversationSessionId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to resolve questionnaire voice intent.");
  }

  const payload = await response.json();
  return {
    result: parseVoiceIntentResponse(payload.result ?? payload),
    conversationSessionId: payload.conversationSessionId,
  };
}

export function useVoiceSession({
  scaleId,
  skillToken,
  language,
  mode,
  requiresConfirmation = false,
  question,
  questionIndex,
  questionCount: _questionCount,
  currentAnswer: _currentAnswer,
  onAnswer,
  onPrevious,
  transcribeAudio,
  resolveQuestionnaireIntentOverride,
}: UseVoiceSessionOptions): UseVoiceSessionResult {
  const [session, dispatch] = useReducer(
    voiceSessionReducer,
    {
      mode,
      language,
      activeScaleId: scaleId,
      currentQuestionIndex: questionIndex,
      currentQuestionId: question.id,
    },
    createVoiceSessionState
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const conversationSessionIdRef = useRef<string>("");

  const isSupported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
  }, []);

  const cancelSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    dispatch({ type: "STOP_SPEAKING" });
  }, []);

  const recordVoiceEvent = useCallback(
    async (input: {
      eventType: ClientVoiceEventType;
      provider?: string;
      model?: string;
      confidence?: number;
      confirmedLowConfidence?: boolean;
      transcriptText?: string;
      assistantText?: string;
      summary?: string;
      errorMessage?: string;
      fallbackReason?: string;
      metadata?: unknown;
      required?: boolean;
    }) => {
      if (!skillToken) {
        return;
      }

      try {
        const response = await fetch("/api/skill/v1/voice-events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${skillToken}`,
          },
          body: JSON.stringify({
            conversationSessionId: conversationSessionIdRef.current || undefined,
            scaleId,
            questionId: question.id,
            eventType: input.eventType,
            provider: input.provider,
            model: input.model,
            confidence: input.confidence,
            confirmedLowConfidence: input.confirmedLowConfidence,
            transcriptText: input.transcriptText,
            assistantText: input.assistantText,
            summary: input.summary,
            errorMessage: input.errorMessage,
            fallbackReason: input.fallbackReason,
            metadata: input.metadata,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to record voice event.");
        }

        if (data.conversationSessionId) {
          conversationSessionIdRef.current = String(data.conversationSessionId);
        }
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload: {
            error: error instanceof Error ? error.message : "Failed to record voice event.",
            statusText:
              error instanceof Error
                ? error.message
                : language === "en"
                  ? "Voice event logging failed."
                  : "语音事件写入失败。",
          },
        });
        if (input.required) {
          throw error;
        }
      }
    },
    [language, question.id, scaleId, skillToken]
  );

  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) {
        return;
      }

      cancelSpeaking();
      void recordVoiceEvent({
        eventType: "assistant_prompt",
        provider: "browser",
        model: "speechSynthesis",
        assistantText: text,
        summary: "Browser TTS prompt queued",
      });

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "en" ? "en-US" : "zh-CN";
      utterance.rate = 0.92;
      utterance.onend = () => {
        dispatch({ type: "STOP_SPEAKING" });
        void recordVoiceEvent({
          eventType: "tts_output",
          provider: "browser",
          model: "speechSynthesis",
          assistantText: text,
          summary: "Browser TTS playback completed",
        });
      };
      utterance.onerror = () => {
        dispatch({
          type: "SET_ERROR",
          payload: {
            error: "Voice playback failed.",
            statusText: language === "en" ? "Voice playback failed." : "语音播报失败，请稍后重试。",
          },
        });
        void recordVoiceEvent({
          eventType: "error",
          provider: "browser",
          model: "speechSynthesis",
          assistantText: text,
          errorMessage: "Voice playback failed.",
          fallbackReason: "browser_tts_failed",
        });
      };

      utteranceRef.current = utterance;
      dispatch({ type: "START_SPEAKING", payload: { prompt: text } });
      window.speechSynthesis.speak(utterance);
    },
    [cancelSpeaking, language, recordVoiceEvent]
  );

  const repeatQuestion = useCallback(() => {
    speakText(buildQuestionVoiceCopy(question, language));
  }, [language, question, speakText]);

  const speakCurrentQuestion = useCallback(() => {
    repeatQuestion();
  }, [repeatQuestion]);

  const speakExplanation = useCallback(() => {
    speakText(resolveQuestionSimpleExplain(question, language));
  }, [language, question, speakText]);

  const goPrevious = useCallback(() => {
    if (!onPrevious) {
      return;
    }
    onPrevious();
    dispatch({
      type: "SET_STATUS",
      payload: {
        statusText: language === "en" ? "Going back to the previous question." : "已返回上一题。",
      },
    });
  }, [language, onPrevious]);

  const confirmPendingAnswer = useCallback(
    async (confirmed: boolean) => {
      if (!session.pendingConfirmation) {
        return;
      }

      if (confirmed) {
        await recordVoiceEvent({
          eventType: "answer_confirmation",
          confirmedLowConfidence: true,
          confidence: undefined,
          transcriptText: session.lastUserTranscript,
          summary: "Parent confirmed low-confidence or sensitive answer",
          metadata: {
            answer: session.pendingConfirmation,
            confirmed: true,
          },
          required: true,
        });
        dispatch({ type: "CLEAR_PENDING_CONFIRMATION" });
        await onAnswer(session.pendingConfirmation.score);
        await recordVoiceEvent({
          eventType: "assessment_answer_committed",
          confirmedLowConfidence: true,
          transcriptText: session.lastUserTranscript,
          summary: "Confirmed voice answer committed by application code",
          metadata: {
            answer: session.pendingConfirmation,
          },
          required: true,
        });
        return;
      }

      await recordVoiceEvent({
        eventType: "answer_confirmation",
        confirmedLowConfidence: true,
        transcriptText: session.lastUserTranscript,
        summary: "Parent rejected mapped answer",
        metadata: {
          answer: session.pendingConfirmation,
          confirmed: false,
        },
        required: true,
      });
      dispatch({ type: "CLEAR_PENDING_CONFIRMATION" });
      dispatch({
        type: "FALLBACK_PROMPT",
        payload: {
          statusText:
            language === "en"
              ? "Okay, let me ask that again."
              : "好的，我再问一遍，您可以直接说选项内容。",
        },
      });
      speakCurrentQuestion();
    },
    [language, onAnswer, recordVoiceEvent, session.lastUserTranscript, session.pendingConfirmation, speakCurrentQuestion]
  );

  const interpretTranscript = useCallback(
    async (transcript: string) => {
      const normalized = normalizeTranscript(transcript);
      dispatch({ type: "RECEIVE_TRANSCRIPT", payload: { transcript } });

      if (session.pendingConfirmation) {
        if (matchesPattern(CONFIRM_PATTERNS.yes, normalized)) {
          await confirmPendingAnswer(true);
          return;
        }

        if (matchesPattern(CONFIRM_PATTERNS.no, normalized)) {
          await confirmPendingAnswer(false);
          return;
        }
      }

      let intentResult: VoiceIntentResult;
      try {
        if (resolveQuestionnaireIntentOverride) {
          intentResult = await resolveQuestionnaireIntentOverride({
            scaleId,
            question,
            language,
            transcript,
          });
        } else {
          const fetchedIntent = await fetchQuestionnaireIntent({
            scaleId,
            question,
            language,
            transcript,
            skillToken,
            conversationSessionId: conversationSessionIdRef.current || undefined,
          });
          intentResult = fetchedIntent.result;
          if (fetchedIntent.conversationSessionId) {
            conversationSessionIdRef.current = fetchedIntent.conversationSessionId;
          }
        }
      } catch (error) {
        await recordVoiceEvent({
          eventType: "fallback",
          transcriptText: transcript,
          fallbackReason: error instanceof Error ? error.message : "voice_intent_failed",
          summary: "Voice intent route failed, using local rules for confirmation prompt",
        });
        intentResult = resolveLocalQuestionnaireVoiceIntent({ question, transcript, language });
      }
      dispatch({ type: "SET_INTENT", payload: { intent: intentResult } });

      switch (intentResult.intent) {
        case "repeat":
          repeatQuestion();
          return;
        case "previous":
          if (!onPrevious) {
            speakText(
              language === "en"
                ? "Going back to the previous question is not available in this assessment."
                : "当前这份量表暂不支持返回上一题，请继续回答当前问题。"
            );
            return;
          }
          goPrevious();
          return;
        case "explain":
          speakExplanation();
          return;
        case "pause":
          dispatch({
            type: "PAUSE_SESSION",
            payload: {
              statusText: language === "en" ? "Voice session paused." : "语音问答已暂停。",
            },
          });
          return;
        case "resume":
          dispatch({
            type: "RESUME_SESSION",
            payload: {
              statusText: language === "en" ? "Voice session resumed." : "语音问答已继续。",
            },
          });
          speakCurrentQuestion();
          return;
        case "risk_escalation":
          dispatch({
            type: "RAISE_RISK",
            payload: {
              risk: intentResult.risk!,
              statusText:
                language === "en"
                  ? "A safety-sensitive statement was detected. Please seek support immediately."
                  : "检测到高风险表达，请优先寻求家人、医生或紧急支持帮助。",
            },
          });
          speakText(
            language === "en"
              ? "I heard something safety-related. Please contact a trusted person or emergency support right away."
              : "我听到了一些涉及安全风险的内容。请尽快联系可信赖的家人、医生或紧急支持资源。"
          );
          return;
        case "answer":
          if (!intentResult.answer) {
            break;
          }

          if (
            requiresConfirmation ||
            question.riskLevel === "high" ||
            intentResult.meta?.needsConfirmation ||
            shouldConfirm(intentResult.confidence)
          ) {
            dispatch({
              type: "SET_PENDING_CONFIRMATION",
              payload: {
                answer: intentResult.answer,
                statusText:
                  language === "en"
                    ? `Please confirm: should I select ${intentResult.answer.label ?? "this option"}?`
                    : `请确认：您的意思是选择“${intentResult.answer.label ?? "这个选项"}”吗？`,
              },
            });
            speakText(
              `${resolveQuestionConfirmationPrompt(question, language)} ${
                language === "en"
                  ? `Should I choose ${intentResult.answer.label ?? "this option"}?`
                  : `我理解为“${intentResult.answer.label ?? "这个选项"}”，对吗？`
              }`
            );
            return;
          }

          if (shouldAutoAccept(intentResult.confidence) || intentResult.confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
            await onAnswer(intentResult.answer.score);
            await recordVoiceEvent({
              eventType: "assessment_answer_committed",
              confidence: intentResult.confidence,
              transcriptText: transcript,
              summary: "High-confidence voice answer committed by application code",
              metadata: {
                answer: intentResult.answer,
                intent: intentResult.intent,
                source: "voice_session",
              },
              required: true,
            });
            dispatch({
              type: "SET_STATUS",
              payload: {
                statusText:
                  language === "en"
                    ? `Selected ${intentResult.answer.label ?? "the option"}.`
                    : `已识别为“${intentResult.answer.label ?? "该选项"}”。`,
              },
            });
            return;
          }
          break;
        case "irrelevant":
        default:
          dispatch({
            type: "FALLBACK_PROMPT",
            payload: {
              statusText:
                language === "en"
                  ? "I didn't catch the option. You can answer with the option text or ask me to repeat."
                  : "我还没有识别到明确选项，您可以直接说选项内容，或者让我重复一遍。",
            },
          });
          void recordVoiceEvent({
            eventType: "fallback",
            confidence: intentResult.confidence,
            transcriptText: transcript,
            assistantText: intentResult.meta?.followUpQuestion,
            fallbackReason: intentResult.meta?.reason || "voice_intent_irrelevant",
            summary: "Voice answer requires follow-up or clearer option",
            metadata: {
              intent: intentResult,
            },
          });
          speakText(
            language === "en"
              ? "I didn't catch the option. Please answer with the option text, or say repeat."
              : "我还没有听清您的选项。您可以直接说选项内容，或者说“重复一遍”。"
          );
          return;
      }
    },
    [
      confirmPendingAnswer,
      goPrevious,
      language,
      onAnswer,
      onPrevious,
      question,
      recordVoiceEvent,
      resolveQuestionnaireIntentOverride,
      scaleId,
      skillToken,
      repeatQuestion,
      requiresConfirmation,
      session.pendingConfirmation,
      speakCurrentQuestion,
      speakExplanation,
      speakText,
    ]
  );

  const uploadAndTranscribe = useCallback(
    async (audioBlob: Blob) => {
      dispatch({ type: "START_TRANSCRIBING" });

      try {
        if (transcribeAudio) {
          const transcript = await transcribeAudio(audioBlob);
          if (!transcript) {
            throw new Error(language === "en" ? "No speech detected." : "未识别到有效语音。");
          }

          await interpretTranscript(transcript);
          return;
        }

        if (!skillToken) {
          throw new Error(language === "en" ? "Skill session is not ready yet." : "Skill 会话尚未准备好，请稍后再试。");
        }

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("context", "questionnaire");
        if (conversationSessionIdRef.current) {
          formData.append("conversationSessionId", conversationSessionIdRef.current);
        }
        formData.append("scaleId", scaleId);
        formData.append("questionId", String(question.id));

        const response = await fetch("/api/skill/v1/speech/transcribe", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${skillToken}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "语音识别失败");
        }

        const data = await response.json();
        if (data.conversationSessionId) {
          conversationSessionIdRef.current = String(data.conversationSessionId);
        }
        if (!data.success || !data.text) {
          throw new Error(language === "en" ? "No speech detected." : "未识别到有效语音。");
        }

        await interpretTranscript(data.text);
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload: {
            error: error instanceof Error ? error.message : "Voice recognition failed.",
            statusText:
              error instanceof Error
                ? error.message
                : language === "en"
                  ? "Voice recognition failed."
                  : "语音识别失败，请稍后重试。",
          },
        });
      } finally {
        dispatch({ type: "STOP_TRANSCRIBING" });
      }
    },
    [interpretTranscript, language, question.id, scaleId, skillToken, transcribeAudio]
  );

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      dispatch({
        type: "SET_ERROR",
        payload: {
          error: "Recording is not supported in this browser.",
          statusText: language === "en" ? "Recording is not supported." : "当前浏览器不支持录音。",
        },
      });
      return;
    }

    try {
      if (session.isSpeaking) {
        cancelSpeaking();
        dispatch({ type: "REGISTER_BARGE_IN" });
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
        "audio/wav",
      ];
      const mimeType = mimeTypes.find((item) => MediaRecorder.isTypeSupported(item)) || "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 96000,
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await uploadAndTranscribe(audioBlob);
      };

      mediaRecorder.start();
      dispatch({
        type: "START_RECORDING",
      });
      dispatch({
        type: "SET_STATUS",
        payload: {
          statusText: language === "en" ? "Listening..." : "正在聆听，请回答当前题目。",
        },
      });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: {
          error: error instanceof Error ? error.message : "Recording failed.",
          statusText:
            language === "en"
              ? "Unable to start recording. Please check microphone permissions."
              : "无法启动录音，请检查麦克风权限。",
        },
      });
    }
  }, [cancelSpeaking, isSupported, language, session.isSpeaking, uploadAndTranscribe]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      dispatch({ type: "STOP_RECORDING" });
      dispatch({
        type: "SET_STATUS",
        payload: {
          statusText: language === "en" ? "Transcribing..." : "正在识别语音内容...",
        },
      });
    }
  }, [language]);

  const toggleRecording = useCallback(() => {
    if (session.isTranscribing) {
      return;
    }

    if (session.isRecording) {
      stopRecording();
      return;
    }

    void startRecording();
  }, [session.isRecording, session.isTranscribing, startRecording, stopRecording]);

  const togglePause = useCallback(() => {
    if (session.state === "paused") {
      dispatch({
        type: "RESUME_SESSION",
        payload: {
          statusText: language === "en" ? "Voice session resumed." : "语音问答已继续。",
        },
      });
      speakCurrentQuestion();
      return;
    }

    cancelSpeaking();
    dispatch({
      type: "PAUSE_SESSION",
      payload: {
        statusText: language === "en" ? "Voice session paused." : "语音问答已暂停。",
      },
    });
  }, [cancelSpeaking, language, session.state, speakCurrentQuestion]);

  useEffect(() => {
    dispatch({
      type: "START_SESSION",
      payload: {
        mode,
        language,
        activeScaleId: scaleId,
        currentQuestionIndex: questionIndex,
        currentQuestionId: question.id,
      },
    });
  }, [language, mode, question.id, questionIndex, scaleId]);

  useEffect(() => {
    dispatch({
      type: "SET_QUESTION",
      payload: {
        currentQuestionIndex: questionIndex,
        currentQuestionId: question.id,
      },
    });
  }, [question.id, questionIndex]);

  useEffect(() => {
    if (mode === "manual") {
      return;
    }

    const prompt = resolveQuestionVoicePrompt(question, language);
    speakText(prompt);
  }, [language, mode, question.id, questionIndex, speakText]);

  useEffect(() => {
    return () => {
      cancelSpeaking();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cancelSpeaking]);

  return {
    session,
    isSupported,
    startRecording,
    stopRecording,
    toggleRecording,
    speakCurrentQuestion,
    speakExplanation,
    repeatQuestion,
    goPrevious,
    togglePause,
    confirmPendingAnswer,
  };
}
