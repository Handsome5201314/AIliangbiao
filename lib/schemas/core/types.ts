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

export type ScaleInteractionMode =
  | Exclude<VoiceSessionMode, "manual">
  | "manual_only"
  | "web_handoff";

export type ScaleResultDeliveryMode = "immediate" | "physician_review";

export type ScaleAudience = "child" | "adult" | "personality" | "career";

export type ScaleProductGroup = "clinical_child";

export type ScaleStatus = "active" | "disabled" | "legacy";

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
  description?: LocalizedTextValue;
}

export interface ScaleSymptomOption {
  id: string;
  label: LocalizedTextValue;
}

export interface ScaleAnswerDetailInput {
  estimated?: boolean;
  selectedSymptomIds?: string[];
  primarySymptomId?: string;
  confidence?: number;
  evidence?: string;
  source?: 'manual' | 'ai_mapped' | 'user_confirmed_mapping';
  confirmedLowConfidence?: boolean;
}

export type ScaleAnswerDetailMap = Record<string, ScaleAnswerDetailInput>;

export interface NormalizedScaleAnswerDetail {
  estimated?: boolean;
  confidence?: number;
  evidence?: string;
  source?: ScaleAnswerDetailInput["source"];
  confirmedLowConfidence?: boolean;
  selectedSymptoms?: Array<{
    id: string;
    label: string;
  }>;
  primarySymptomId?: string;
  primarySymptomLabel?: string;
}

export type NormalizedScaleAnswerDetailMap = Record<string, NormalizedScaleAnswerDetail>;

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
  /** 题目附属的症状标签，常用于“标准分值 + 症状明细补充”模式 */
  symptomOptions?: ScaleSymptomOption[];
  /** Grouping key used by long-form handoff rendering and raw-score aggregation. */
  sectionKey?: string;
  /** Human-readable section label for grouped rendering. */
  sectionLabel?: LocalizedTextValue;
  /** Optional subsection key used by grouped scales such as Vineland problem behaviors. */
  subsectionKey?: string;
  /** Optional subsection label. */
  subsectionLabel?: LocalizedTextValue;
  /** Age-band label shown in grouped handoff flows. */
  ageBandLabel?: string;
  /** Whether this question supports an estimated-answer marker without affecting score. */
  supportsEstimate?: boolean;
  /** Raw-score or reporting domain bucket. */
  domainKey?: string;
  /** Local question number inside a grouped section or subsection. */
  localQuestionNumber?: number;
  /** 题目配图（用于原版图示、阅读卡片、作图参考图等） */
  imageUrl?: string;
  /** 配图说明 */
  imageAlt?: LocalizedTextValue;
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
  interactionMode?: ScaleInteractionMode;
  /** 问卷支持的语言 */
  supportedLanguages?: LanguageCode[];
  /** 语音模式下是否建议做二次确认 */
  requiresConfirmation?: boolean;
  /** 结果对受测者的交付策略 */
  resultDeliveryMode?: ScaleResultDeliveryMode;
  /** 目标受众 */
  audience?: ScaleAudience;
  /** 产品分组 */
  productGroup?: ScaleProductGroup;
  /** 是否儿童量表 */
  isPediatric?: boolean;
  /** 目录状态 */
  status?: ScaleStatus;
  /** 是否默认展示在主流程 */
  defaultVisible?: boolean;
  /** 是否允许进入语音友好量表列表 */
  voiceFriendly?: boolean;
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
    scoreQuestionIds?: number[];
    totalScoreLabel?: string;
    totalScoreHint?: string;
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
  followUpQuestion?: string;
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
