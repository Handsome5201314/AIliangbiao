/**
 * 全局宪法：定义量表和题目的 4D 临床数据结构
 *
 * 4D = Dimension 1 (量表元信息) × Dimension 2 (题目本体)
 *       × Dimension 3 (临床意图与追问策略) × Dimension 4 (评分与结论)
 */

export type LanguageCode = "zh" | "en";

export type VoiceSessionMode =
  | "manual"
  | "voice_guided"
  | "full_voice"
  | "call_mode";

export type VoiceState =
  | "idle"
  | "assistant_speaking"
  | "user_listening"
  | "understanding"
  | "confirming"
  | "timeout_reprompt"
  | "fallback_prompt"
  | "paused"
  | "navigating"
  | "handoff_to_manual"
  | "completed";

export type VoiceIntent =
  | "answer"
  | "irrelevant"
  | "pause"
  | "repeat"
  | "previous"
  | "change_answer"
  | "resume"
  | "explain"
  | "skip"
  | "quit"
  | "switch_member"
  | "switch_language"
  | "slower"
  | "faster"
  | "risk_escalation";

export type ScaleCategory =
  | "Child Development"
  | "Mental Health"
  | "Personality"
  | "Career Assessment"
  | "Cognitive Health"
  | "General Health";

export interface LocalizedText {
  zh: string;
  en?: string;
}

export type LocalizedTextValue = string | LocalizedText;

/** 单个选项 */
export interface ScaleOption {
  label: string;
  score: number;
  aliases?: string[];
}

export interface AnswerMappingHints {
  keywords?: string[];
  phrases?: Array<{
    score: number;
    keywords: string[];
  }>;
  negativeKeywords?: string[];
  irrelevantKeywords?: string[];
}

/** 单个量表题目 — 4D 结构的核心单元 */
export interface ScaleQuestion {
  /** 题目序号（从 1 开始） */
  id: number;
  /** 学术原版文本（直接引用量表手册） */
  text: LocalizedTextValue;
  /** 核心临床意图（一句话描述本题想探测什么） */
  clinical_intent: string;
  /** 破冰大白话（面向普通用户的通俗表述） */
  colloquial: LocalizedTextValue;
  /** 追问策略：当用户回答模糊时，依次尝试的追问示例 */
  fallback_examples: LocalizedTextValue[];
  /** 可选项列表 */
  options: ScaleOption[];
  /** 聊天记录分析时可复用的轻量提示 */
  analysisHints?: {
    keywords?: string[];
    optionKeywords?: Array<{
      score: number;
      keywords: string[];
    }>;
  };
  /** 面向语音问答的提问版本 */
  voicePrompt?: LocalizedTextValue;
  /** 降低理解门槛的解释版本 */
  simpleExplain?: LocalizedTextValue;
  /** 低置信度时的确认话术 */
  confirmationPrompt?: LocalizedTextValue;
  /** 是否允许纯语音自动作答 */
  autoAnswerable?: boolean;
  /** 语音/NLP 解析辅助词 */
  answerMappingHints?: AnswerMappingHints;
  /** 题目风险等级 */
  riskLevel?: "normal" | "sensitive" | "high";
}

/** 评分结果 */
export interface ScaleScoreResult {
  totalScore: number;
  conclusion: string;
  details?: {
    description?: string;
    [key: string]: unknown;
  };
}

/** 可序列化量表定义 */
export interface ScaleDefinition {
  /** 量表唯一标识 */
  id: string;
  /** 量表版本号 */
  version?: string;
  /** 量表名称 */
  title: LocalizedTextValue;
  /** 量表简介 */
  description: LocalizedTextValue;
  /** 量表分类 */
  category?: ScaleCategory;
  /** 题目列表（有序） */
  questions: ScaleQuestion[];
  /** 来源标识，便于区分内置量表与配置化量表 */
  source?: 'builtin' | 'manifest';
  /** 分类标签 */
  tags?: string[];
  /** 预计耗时（分钟） */
  estimatedMinutes?: number;
  /** 问卷支持的交互模式 */
  interactionMode?: Exclude<VoiceSessionMode, "manual"> | "manual_only";
  /** 问卷支持的语言 */
  supportedLanguages?: LanguageCode[];
  /** 语音模式下是否建议做二次确认 */
  requiresConfirmation?: boolean;
}

/** 服务端可执行量表定义 */
export interface ExecutableScaleDefinition extends ScaleDefinition {
  /**
   * 计算评分
   * @param answers 用户选择的每题分数（顺序与 questions 一一对应）
   * @returns 总分与临床结论
   */
  calculateScore(answers: number[]): ScaleScoreResult;
}

export interface ScaleManifestThreshold {
  min?: number;
  max?: number;
  conclusion: string;
  description?: string;
  details?: Record<string, unknown>;
}

export interface ScaleManifestDimension {
  id: string;
  label: string;
  questionIds: number[];
}

export interface ScaleManifest extends ScaleDefinition {
  source: 'manifest';
  scoring: {
    method: 'sum';
    thresholds: ScaleManifestThreshold[];
    dimensions?: ScaleManifestDimension[];
  };
}

export interface VoiceAnswer {
  questionId?: string | number;
  score: number;
  label?: string;
}

export interface VoiceChangeRequest {
  targetQuestionId?: string | number | "prev";
  newScore?: number | null;
}

export interface RiskSignal {
  level: "low" | "medium" | "high";
  type: string;
  evidence: string;
}

export interface VoiceIntentMeta {
  reason?: string;
  rawTranscript?: string;
  normalizedText?: string;
  evidence?: string;
  needsConfirmation?: boolean;
  needsFallbackPrompt?: boolean;
}

export interface VoiceIntentResult {
  intent: VoiceIntent;
  confidence: number;
  language?: LanguageCode;
  answer?: VoiceAnswer;
  changeRequest?: VoiceChangeRequest;
  risk?: RiskSignal;
  meta?: VoiceIntentMeta;
}
