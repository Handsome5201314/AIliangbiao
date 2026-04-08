'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import {
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
  onPrevious: () => void;
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
}): Promise<VoiceIntentResult> {
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
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to resolve questionnaire voice intent.");
  }

  const payload = await response.json();
  return parseVoiceIntentResponse(payload.result ?? payload);
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

  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) {
        return;
      }

      cancelSpeaking();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "en" ? "en-US" : "zh-CN";
      utterance.rate = 0.92;
      utterance.onend = () => {
        dispatch({ type: "STOP_SPEAKING" });
      };
      utterance.onerror = () => {
        dispatch({
          type: "SET_ERROR",
          payload: {
            error: "Voice playback failed.",
            statusText: language === "en" ? "Voice playback failed." : "语音播报失败，请稍后重试。",
          },
        });
      };

      utteranceRef.current = utterance;
      dispatch({ type: "START_SPEAKING", payload: { prompt: text } });
      window.speechSynthesis.speak(utterance);
    },
    [cancelSpeaking, language]
  );

  const repeatQuestion = useCallback(() => {
    speakText(resolveQuestionVoicePrompt(question, language));
  }, [language, question, speakText]);

  const speakCurrentQuestion = useCallback(() => {
    repeatQuestion();
  }, [repeatQuestion]);

  const speakExplanation = useCallback(() => {
    speakText(resolveQuestionSimpleExplain(question, language));
  }, [language, question, speakText]);

  const goPrevious = useCallback(() => {
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
        dispatch({ type: "CLEAR_PENDING_CONFIRMATION" });
        await onAnswer(session.pendingConfirmation.score);
        return;
      }

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
    [language, onAnswer, session.pendingConfirmation, speakCurrentQuestion]
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
        intentResult = await fetchQuestionnaireIntent({
          scaleId,
          question,
          language,
          transcript,
          skillToken,
        });
      } catch {
        intentResult = detectAnswerIntent(question, transcript);
      }
      dispatch({ type: "SET_INTENT", payload: { intent: intentResult } });

      switch (intentResult.intent) {
        case "repeat":
          repeatQuestion();
          return;
        case "previous":
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
      question,
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
        if (!skillToken) {
          throw new Error(language === "en" ? "Skill session is not ready yet." : "Skill 会话尚未准备好，请稍后再试。");
        }

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("context", "questionnaire");

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
    [interpretTranscript, language]
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
