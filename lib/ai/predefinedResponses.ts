/**
 * 预定义高频场景回答
 * 
 * 功能：
 * 1. 快速响应常见场景
 * 2. 减轻 LLM 负担
 * 3. 提升用户体验
 */

// 高频场景模板
export const PREDEFINED_RESPONSES = {
  // 分诊阶段
  triage: {
    // 初始共情
    initial_empathy: [
      '我理解您的担心，请具体说说孩子的情况。',
      '别着急，我们一起来了解孩子的表现。',
      '感谢您对孩子的关注，请详细描述一下。',
      '我很愿意帮助您，请告诉我具体的情况。',
    ],
    
    // 追问细节
    ask_details: [
      '他是在家也这样，还是只在特定环境？',
      '这种情况持续多久了？有加重吗？',
      '除了这个表现，还有其他让您担心的吗？',
      '能具体描述一下频率和程度吗？',
    ],
    
    // 推荐量表
    recommend_scale: (scale: string, time: string) => 
      `建议填写 ${scale} 量表，约 ${time} 分钟。您看现在方便开始吗？[RECOMMEND:${scale}]`,
  },
  
  // 同意后
  consent: {
    // 开始评估
    start: (scale: string) => 
      `好的，马上为您开启评估。[SCALE:${scale}]`,
    
    // 确认回复
    confirm: [
      '好的，开始吧！',
      '明白，我们马上开始。',
      '收到，正在为您准备量表。',
      '好的，即将进入评估。',
    ],
  },
  
  // 拒绝或犹豫后
  rejection: {
    // 理解回复
    understand: [
      '没问题，我们可以继续聊聊孩子的情况。',
      '好的，您还有什么想了解的吗？',
      '理解，您可以随时开始评估。',
      '没关系，我们慢慢来。',
    ],
    
    // 提供更多信息
    offer_info: [
      '这个量表是专业的医学评估工具，结果仅供参考。',
      '评估过程大约需要15分钟，您可以随时暂停。',
      '量表结果可以帮助医生更好地了解孩子的情况。',
    ],
  },
  
  // 常见问题回答
  faq: {
    scale_accuracy: '量表是专业的医学评估工具，但结果仅供参考，建议咨询专业医生。',
    time_required: '评估时间因量表而异，通常在5-15分钟之间。',
    scale_selection: '我会根据孩子的症状推荐最合适的量表。',
    privacy: '您的数据严格保密，仅用于评估目的。',
  },
};

/**
 * 快速匹配场景并返回预定义回答
 */
export function matchPredefinedResponse(
  context: any,
  userMessage: string
): string | null {
  const { state, symptoms, recommendedScale } = context;
  const message = userMessage.toLowerCase();
  
  console.log('[Predefined] Matching:', { state, message });
  
  // ===== 分诊初始阶段 =====
  if (state === 'initial' || state === 'triage') {
    // 首次提问 - 共情
    if (symptoms.length === 0) {
      return getRandomResponse(PREDEFINED_RESPONSES.triage.initial_empathy);
    }
    
    // 第二次提问 - 追问
    if (symptoms.length === 1) {
      return getRandomResponse(PREDEFINED_RESPONSES.triage.ask_details);
    }
    
    // 症状充足 - 推荐量表
    if (symptoms.length >= 2) {
      const scale = recommendScaleBySymptoms(symptoms);
      const time = getScaleTime(scale);
      return PREDEFINED_RESPONSES.triage.recommend_scale(scale, time);
    }
  }
  
  // ===== 同意阶段 =====
  if (state === 'consent') {
    // 用户同意
    if (isAgreement(message)) {
      if (recommendedScale) {
        return PREDEFINED_RESPONSES.consent.start(recommendedScale);
      }
    }
    
    // 用户拒绝或犹豫
    if (isRejection(message)) {
      return getRandomResponse(PREDEFINED_RESPONSES.rejection.understand);
    }
    
    // 用户询问准确性
    if (message.includes('准确') || message.includes('有用')) {
      return PREDEFINED_RESPONSES.faq.scale_accuracy;
    }
    
    // 用户询问时间
    if (message.includes('时间') || message.includes('多久')) {
      return PREDEFINED_RESPONSES.faq.time_required;
    }
  }
  
  // ===== 无匹配 =====
  return null;
}

/**
 * 辅助函数：随机选择回复
 */
function getRandomResponse(responses: string[]): string {
  const index = Math.floor(Math.random() * responses.length);
  return responses[index];
}

/**
 * 辅助函数：判断是否为同意
 */
function isAgreement(message: string): boolean {
  const agreementKeywords = [
    '好的', '可以', '行', '没问题', '开始', '开始吧',
    '好的开始', '那开始吧', '可以开始', '没问题开始',
  ];
  
  return agreementKeywords.some(keyword => message.includes(keyword));
}

/**
 * 辅助函数：判断是否为拒绝
 */
function isRejection(message: string): boolean {
  const rejectionKeywords = [
    '不用', '算了', '先不', '稍后', '再考虑',
    '不着急', '想先', '还想问',
  ];
  
  return rejectionKeywords.some(keyword => message.includes(keyword));
}

/**
 * 辅助函数：根据症状推荐量表
 */
function recommendScaleBySymptoms(symptoms: string[]): string {
  const symptomText = symptoms.join(' ');
  
  // 自闭症相关症状
  if (symptomText.includes('不和人交流') || 
      symptomText.includes('不爱说话') || 
      symptomText.includes('不理人')) {
    return 'ABC';
  }
  
  // 社交问题
  if (symptomText.includes('社交') || 
      symptomText.includes('不合群')) {
    return 'SRS';
  }
  
  // 多动症相关症状
  if (symptomText.includes('注意力') || 
      symptomText.includes('多动') || 
      symptomText.includes('坐不住')) {
    return 'SNAP-IV';
  }
  
  // 默认推荐
  return 'ABC';
}

/**
 * 辅助函数：获取量表时间
 */
function getScaleTime(scaleId: string): string {
  const times: Record<string, string> = {
    'ABC': '15',
    'CARS': '5',
    'SRS': '10',
    'SNAP-IV': '5',
  };
  
  return times[scaleId] || '10';
}

/**
 * 获取预定义回答统计
 */
export function getPredefinedStats(): {
  totalTemplates: number;
  categories: string[];
} {
  const categories = Object.keys(PREDEFINED_RESPONSES);
  let totalTemplates = 0;
  
  for (const category of Object.values(PREDEFINED_RESPONSES)) {
    for (const templates of Object.values(category)) {
      if (Array.isArray(templates)) {
        totalTemplates += templates.length;
      }
    }
  }
  
  return {
    totalTemplates,
    categories,
  };
}
