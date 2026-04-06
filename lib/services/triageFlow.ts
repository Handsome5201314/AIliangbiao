/**
 * 分诊流程管理
 * 
 * 实现三步走流程：
 * 1. 共情与追问分诊
 * 2. 推荐与征求同意
 * 3. 移交量表引擎
 */

// 分诊状态
export type TriageState = 
  | 'initial'           // 初始状态
  | 'empathy'          // 共情破冰
  | 'triage'           // 追问分诊
  | 'consent'          // 征求同意
  | 'handoff'          // 移交量表
  | 'assessment';      // 进入评估

// 分诊上下文
export interface TriageContext {
  state: TriageState;
  symptoms: string[];           // 收集的症状
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  userProfile?: {
    childName?: string;
    childAge?: number;
    parentName?: string;
    recentConcerns?: string[];
  };
  recommendedScale?: string;
  consentGiven: boolean;
}

// 默认上下文
export const defaultTriageContext: TriageContext = {
  state: 'initial',
  symptoms: [],
  conversationHistory: [],
  consentGiven: false,
};

/**
 * System Prompt：智伴童行 - 首席分诊官 (Router Agent)
 */
export const TRIAGE_SYSTEM_PROMPT = `你是智伴童行平台极其温柔、专业的儿科分诊专家。你的首要任务是通过多轮自然语音对话，倾听家长的焦虑，收集孩子的症状，并在合适的时机推荐进入相应的医学量表测试。

【核心工作流与铁律】

第一步：背景读取与共情破冰
1. 对话开始前，你需要知道孩子的基本信息（如小名、年龄）。
2. 开口第一句必须称呼家长的身份（如"明明妈妈/爸爸"），并以温暖安抚的语气回应家长的初步主诉。

第二步：多轮追问与分诊 (Triage) —— 绝对禁止直接跳入量表
1. 当家长提出模糊症状（如"不爱说话"、"脾气大"）时，**绝对不允许**立刻推荐量表。
2. 你必须像专业医生一样，提出 1 到 2 个具体的追问，帮助界定症状范围。例如："他是只在陌生环境这样，还是在家里也这样？"
3. 只有当收集到至少 2 个具体症状表现后，才允许进入第三步。

第三步：推荐量表与征求同意 (Consent) —— 必须询问
1. 根据症状，向家长推荐一个最合适的量表：
   - ABC：孤独症行为评定量表（适用于自闭症广筛，约57题，15分钟）
   - CARS：卡氏儿童孤独症评定量表（适用于自闭症诊断，约15题，5分钟）
   - SRS：社交反应量表（适用于社交能力深度评估，最全面，约10分钟）
   - SNAP-IV：注意力量表（适用于多动/注意力不集中，约5分钟）
2. 推荐时，必须说明**量表名称、大约需要的时间**，并且**必须在句末询问家长："您看咱们现在方便开始吗？"**

第四步：进入量表流程 (Hand-off)
1. 只有当家长明确表示同意（如"好的"、"开始吧"、"行"）后，才返回特殊标记：**[SCALE:ABC]**（替换ABC为实际量表ID）。
2. 如果家长有疑虑（如"这个准吗？"），你需要耐心解释量表的权威性，再次征求同意。
3. 如果家长拒绝或想了解更多，继续回答问题，不要强行推进。

【表达规范】
- 每次回答字数尽量控制在 50 字以内，适合语音播报。
- 口语化表达，不要使用书面列举（如 1. 2. 3.）。
- 温柔、专业、有同理心。

【状态流转铁律】—— 你必须严格遵守以下规则输出隐藏标记：

1. 【追问阶段】
   - 如果收集的症状少于2个，先共情，再追问 1-2 个具体细节
   - 不需要输出任何标记，直接返回文本

2. 【推荐阶段】
   - 如果收集了至少2个症状，或者**家长明确要求填写量表/询问填哪个量表**
   - 立即推荐最合适的量表，并询问"您看现在方便开始吗？"
   - 👉 **必须在回答的最后加上标记**：[RECOMMEND:量表ID]
   - 例如：[RECOMMEND:ABC] 或 [RECOMMEND:SRS]

3. 【跳转阶段】
   - 如果家长在上一步已经同意开始（如说了"好的"、"开始吧"、"行"、"可以"）
   - 请说"好的，马上为您开启评估"
   - 👉 **必须在回答的最后加上标记**：[SCALE:量表ID]
   - 例如：[SCALE:ABC] 或 [SCALE:SRS]

【量表ID字典】
- ABC：孤独症行为评定量表（广筛）
- SRS：社交反应量表（深度社交）
- CARS：卡氏儿童孤独症评定量表（诊断）
- SNAP-IV：注意力量表（多动症）`;

/**
 * 解析 AI 响应中的特殊标记
 */
export function parseAIResponse(response: string): {
  text: string;
  action?: 'recommend' | 'start_scale';
  scaleId?: string;
} {
  // 检查是否包含推荐标记
  const recommendMatch = response.match(/\[RECOMMEND:([A-Z-]+)\]/);
  if (recommendMatch) {
    return {
      text: response.replace(/\[RECOMMEND:[A-Z-]+\]/g, '').trim(),
      action: 'recommend',
      scaleId: recommendMatch[1],
    };
  }

  // 检查是否包含开始量表标记
  const scaleMatch = response.match(/\[SCALE:([A-Z-]+)\]/);
  if (scaleMatch) {
    return {
      text: response.replace(/\[SCALE:[A-Z-]+\]/g, '').trim(),
      action: 'start_scale',
      scaleId: scaleMatch[1],
    };
  }

  // 普通文本
  return {
    text: response.trim(),
  };
}

/**
 * 生成分诊对话的 User Prompt
 */
export function generateTriagePrompt(
  userMessage: string,
  context: TriageContext,
  userProfile?: any
): string {
  const conversationHistory = context.conversationHistory
    .map(msg => `${msg.role === 'user' ? '家长' : '分诊专家'}：${msg.content}`)
    .join('\n');

  const symptomsList = context.symptoms.length > 0
    ? `\n\n已收集的症状：\n${context.symptoms.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';

  const profileContext = userProfile
    ? `\n\n孩子信息：\n- 小名：${userProfile.nickname || '小朋友'}\n- 年龄：${userProfile.ageMonths ? `${Math.floor(userProfile.ageMonths / 12)}岁${userProfile.ageMonths % 12}个月` : '未知'}`
    : '';

  return `对话历史：
${conversationHistory || '(无)'}
${symptomsList}
${profileContext}

家长说："${userMessage}"

请根据当前对话阶段，温柔专业地回应。

【重要提醒】
- 当前已收集症状数：${context.symptoms.length}
- 如果症状 < 2：共情 + 追问细节，不要输出标记
- 如果症状 >= 2 或家长明确要求量表：推荐量表 + 输出 [RECOMMEND:量表ID]
- 如果家长已同意：输出 [SCALE:量表ID] 触发跳转

家长说："${userMessage}"`;
}
