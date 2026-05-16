import type {
  LanguageCode,
  RiskSignal,
  VoiceAnswer,
  VoiceIntentResult,
  VoiceSessionMode,
  VoiceState,
} from "@/lib/schemas/core/types";

export interface VoiceSessionSnapshot {
  mode: VoiceSessionMode;
  state: VoiceState;
  language: LanguageCode;
  activeScaleId?: string;
  currentQuestionIndex: number;
  currentQuestionId?: string | number;
  repromptCount: number;
  fallbackCount: number;
  bargeInCount: number;
  lastAssistantPrompt: string;
  lastUserTranscript: string;
  lastIntent?: VoiceIntentResult["intent"];
  pendingConfirmation?: VoiceAnswer;
  isSpeaking: boolean;
  isListening: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  error?: string;
  riskSignal?: RiskSignal;
  statusText: string;
}

export type VoiceSessionAction =
  | {
      type: "START_SESSION";
      payload: {
        mode: VoiceSessionMode;
        language: LanguageCode;
        activeScaleId?: string;
        currentQuestionIndex: number;
        currentQuestionId?: string | number;
      };
    }
  | {
      type: "SET_QUESTION";
      payload: {
        currentQuestionIndex: number;
        currentQuestionId?: string | number;
      };
    }
  | { type: "START_SPEAKING"; payload: { prompt: string } }
  | { type: "STOP_SPEAKING" }
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "START_TRANSCRIBING" }
  | { type: "STOP_TRANSCRIBING" }
  | { type: "START_LISTENING" }
  | { type: "STOP_LISTENING" }
  | { type: "RECEIVE_TRANSCRIPT"; payload: { transcript: string } }
  | { type: "SET_INTENT"; payload: { intent: VoiceIntentResult } }
  | { type: "SET_PENDING_CONFIRMATION"; payload: { answer: VoiceAnswer; statusText: string } }
  | { type: "CLEAR_PENDING_CONFIRMATION" }
  | { type: "TIMEOUT_REPROMPT"; payload?: { statusText?: string } }
  | { type: "FALLBACK_PROMPT"; payload?: { statusText?: string } }
  | { type: "PAUSE_SESSION"; payload?: { statusText?: string } }
  | { type: "RESUME_SESSION"; payload?: { statusText?: string } }
  | { type: "SET_STATUS"; payload: { statusText: string } }
  | { type: "SET_ERROR"; payload: { error?: string; statusText?: string } }
  | { type: "REGISTER_BARGE_IN" }
  | { type: "RAISE_RISK"; payload: { risk: RiskSignal; statusText?: string } }
  | { type: "MARK_COMPLETED"; payload?: { statusText?: string } };

export function createVoiceSessionState(input: {
  mode: VoiceSessionMode;
  language: LanguageCode;
  activeScaleId?: string;
  currentQuestionIndex: number;
  currentQuestionId?: string | number;
}): VoiceSessionSnapshot {
  return {
    mode: input.mode,
    state: input.mode === "manual" ? "idle" : "assistant_speaking",
    language: input.language,
    activeScaleId: input.activeScaleId,
    currentQuestionIndex: input.currentQuestionIndex,
    currentQuestionId: input.currentQuestionId,
    repromptCount: 0,
    fallbackCount: 0,
    bargeInCount: 0,
    lastAssistantPrompt: "",
    lastUserTranscript: "",
    isSpeaking: false,
    isListening: false,
    isRecording: false,
    isTranscribing: false,
    statusText: input.mode === "manual" ? "" : "Voice assistant is ready.",
  };
}

export function voiceSessionReducer(
  state: VoiceSessionSnapshot,
  action: VoiceSessionAction
): VoiceSessionSnapshot {
  switch (action.type) {
    case "START_SESSION":
      return createVoiceSessionState(action.payload);
    case "SET_QUESTION":
      return {
        ...state,
        state: state.mode === "manual" ? "idle" : "navigating",
        currentQuestionIndex: action.payload.currentQuestionIndex,
        currentQuestionId: action.payload.currentQuestionId,
        pendingConfirmation: undefined,
        repromptCount: 0,
        fallbackCount: 0,
      };
    case "START_SPEAKING":
      return {
        ...state,
        state: "assistant_speaking",
        isSpeaking: true,
        isListening: false,
        lastAssistantPrompt: action.payload.prompt,
        statusText: action.payload.prompt,
      };
    case "STOP_SPEAKING":
      return {
        ...state,
        isSpeaking: false,
        state: state.mode === "manual" ? "idle" : "user_listening",
      };
    case "START_RECORDING":
      return {
        ...state,
        isRecording: true,
        isListening: true,
        state: "user_listening",
        error: undefined,
      };
    case "STOP_RECORDING":
      return {
        ...state,
        isRecording: false,
        isListening: false,
      };
    case "START_TRANSCRIBING":
      return {
        ...state,
        isTranscribing: true,
        state: "understanding",
      };
    case "STOP_TRANSCRIBING":
      return {
        ...state,
        isTranscribing: false,
      };
    case "START_LISTENING":
      return {
        ...state,
        isListening: true,
        state: "user_listening",
      };
    case "STOP_LISTENING":
      return {
        ...state,
        isListening: false,
      };
    case "RECEIVE_TRANSCRIPT":
      return {
        ...state,
        lastUserTranscript: action.payload.transcript,
        state: "understanding",
      };
    case "SET_INTENT":
      return {
        ...state,
        lastIntent: action.payload.intent.intent,
      };
    case "SET_PENDING_CONFIRMATION":
      return {
        ...state,
        state: "confirming",
        pendingConfirmation: action.payload.answer,
        statusText: action.payload.statusText,
      };
    case "CLEAR_PENDING_CONFIRMATION":
      return {
        ...state,
        pendingConfirmation: undefined,
      };
    case "TIMEOUT_REPROMPT":
      return {
        ...state,
        state: "timeout_reprompt",
        repromptCount: state.repromptCount + 1,
        statusText: action.payload?.statusText ?? state.statusText,
      };
    case "FALLBACK_PROMPT":
      return {
        ...state,
        state: "fallback_prompt",
        fallbackCount: state.fallbackCount + 1,
        statusText: action.payload?.statusText ?? state.statusText,
      };
    case "PAUSE_SESSION":
      return {
        ...state,
        state: "paused",
        isListening: false,
        isRecording: false,
        statusText: action.payload?.statusText ?? state.statusText,
      };
    case "RESUME_SESSION":
      return {
        ...state,
        state: "assistant_speaking",
        statusText: action.payload?.statusText ?? state.statusText,
      };
    case "SET_STATUS":
      return {
        ...state,
        statusText: action.payload.statusText,
      };
    case "SET_ERROR":
      return {
        ...state,
        error: action.payload.error,
        statusText: action.payload.statusText ?? state.statusText,
      };
    case "REGISTER_BARGE_IN":
      return {
        ...state,
        bargeInCount: state.bargeInCount + 1,
      };
    case "RAISE_RISK":
      return {
        ...state,
        riskSignal: action.payload.risk,
        statusText: action.payload.statusText ?? state.statusText,
      };
    case "MARK_COMPLETED":
      return {
        ...state,
        state: "completed",
        isListening: false,
        isRecording: false,
        isTranscribing: false,
        pendingConfirmation: undefined,
        statusText: action.payload?.statusText ?? state.statusText,
      };
    default:
      return state;
  }
}
