/**
 * 全局宪法：定义量表和题目的 4D 临床数据结构
 *
 * 4D = Dimension 1 (量表元信息) × Dimension 2 (题目本体)
 *       × Dimension 3 (临床意图与追问策略) × Dimension 4 (评分与结论)
 */

/** 单个选项 */
export interface ScaleOption {
  label: string;
  score: number;
}

/** 单个量表题目 — 4D 结构的核心单元 */
export interface ScaleQuestion {
  /** 题目序号（从 1 开始） */
  id: number;
  /** 学术原版文本（直接引用量表手册） */
  text: string;
  /** 核心临床意图（一句话描述本题想探测什么） */
  clinical_intent: string;
  /** 破冰大白话（面向普通用户的通俗表述） */
  colloquial: string;
  /** 追问策略：当用户回答模糊时，依次尝试的追问示例 */
  fallback_examples: string[];
  /** 可选项列表 */
  options: ScaleOption[];
}

/** 评分结果 */
export interface ScaleScoreResult {
  totalScore: number;
  conclusion: string;
}

/** 量表定义 — 完整的一套医学量表 */
export interface ScaleDefinition {
  /** 量表唯一标识 */
  id: string;
  /** 量表版本号 */
  version?: string;
  /** 量表名称 */
  title: string;
  /** 量表简介 */
  description: string;
  /** 题目列表（有序） */
  questions: ScaleQuestion[];
  /**
   * 计算评分
   * @param answers 用户选择的每题分数（顺序与 questions 一一对应）
   * @returns 总分与临床结论
   */
  calculateScore(answers: number[]): ScaleScoreResult;
}
