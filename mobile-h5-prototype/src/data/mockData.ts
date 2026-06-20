import type {
  Child,
  Scale,
  Question,
  Report,
  HistoryRecord,
  DoctorPatient,
  DoctorStats,
  DoctorHistoryRecord,
} from '@/types';

// ─── Children / Members ────────────────────────────────────────────────────────

export const children: Child[] = [
  {
    id: 'child-1',
    name: '小明',
    age: 48,
    ageLabel: '4岁',
    gender: 'male',
    avatar: '👦',
    latestAssessment: {
      scaleName: 'SNAP-IV',
      date: '2024-12-10',
      status: 'completed',
      riskLevel: 'moderate',
    },
  },
  {
    id: 'child-2',
    name: '小花',
    age: 30,
    ageLabel: '2岁6个月',
    gender: 'female',
    avatar: '👧',
    latestAssessment: null,
  },
  {
    id: 'child-3',
    name: '小宇',
    age: 72,
    ageLabel: '6岁',
    gender: 'male',
    avatar: '🧒',
    latestAssessment: {
      scaleName: 'ABC',
      date: '2024-11-28',
      status: 'completed',
      riskLevel: 'low',
    },
  },
];

// ─── Children Clinical Scales ──────────────────────────────────────────────────

export const scales: Scale[] = [
  {
    id: 'snap-iv',
    name: 'SNAP-IV 儿童注意力与行为评定量表',
    shortName: 'SNAP-IV',
    category: 'attention_behavior',
    ageRange: '6-12岁',
    duration: '10-15分钟',
    questionCount: 26,
    tags: ['注意力', '行为'],
    description:
      '用于评估儿童注意缺陷多动障碍（ADHD）的核心症状，涵盖注意力不集中、多动及冲动行为三个维度。',
    recommended: true,
  },
  {
    id: 'srs',
    name: 'SRS 社交反应量表',
    shortName: 'SRS',
    category: 'autism',
    ageRange: '2.5-18岁',
    duration: '15-20分钟',
    questionCount: 65,
    tags: ['社交', '孤独症'],
    description:
      '评估儿童及青少年在自然社交情境中的社交能力与障碍程度，广泛用于孤独症谱系障碍的辅助筛查。',
    recommended: true,
  },
  {
    id: 'm-chat-r',
    name: 'M-CHAT-R 改良版孤独症早期筛查量表',
    shortName: 'M-CHAT-R',
    category: 'autism',
    ageRange: '16-30月',
    duration: '5-10分钟',
    questionCount: 20,
    tags: ['早期筛查', '孤独症'],
    description:
      '针对16-30月龄幼儿的孤独症早期快速筛查工具，通过家长回答识别高风险信号。',
    recommended: true,
  },
  {
    id: 'abc',
    name: 'ABC 儿童适应行为量表',
    shortName: 'ABC',
    category: 'attention_behavior',
    ageRange: '0-12岁',
    duration: '15-20分钟',
    questionCount: 58,
    tags: ['行为', '适应'],
    description:
      '评估儿童在日常生活中的适应行为能力，包括感觉、交往、生活自理、语言及运动等方面。',
    recommended: false,
  },
  {
    id: 'cars',
    name: 'CARS 儿童孤独症评定量表',
    shortName: 'CARS',
    category: 'autism',
    ageRange: '2岁以上',
    duration: '10-15分钟',
    questionCount: 15,
    tags: ['孤独症', '评估'],
    description:
      '由专业人员使用的孤独症严重程度评定工具，通过行为观察对孤独症程度进行分级。',
    recommended: false,
  },
  {
    id: 'atec',
    name: 'ATEC 孤独症治疗评估与检查量表',
    shortName: 'ATEC',
    category: 'autism',
    ageRange: '2-12岁',
    duration: '20-25分钟',
    questionCount: 79,
    tags: ['综合评估', '孤独症'],
    description:
      '综合评估孤独症儿童在语言、社交、感知、行为等方面的表现，适用于干预效果跟踪。',
    recommended: false,
  },
  {
    id: 'vineland-3',
    name: 'VINELAND-3 适应行为量表（第三版）',
    shortName: 'VINELAND-3',
    category: 'development',
    ageRange: '0-90岁',
    duration: '20-30分钟',
    questionCount: 71,
    tags: ['适应行为', '发育'],
    description:
      '评估个体在沟通、日常生活技能、社会化三大领域的适应行为水平，适用于发育迟缓的辅助诊断。',
    recommended: false,
  },
];

// ─── Exploration Scales (adult, not shown in children clinical flow) ────────────

export const explorationScales: Scale[] = [
  {
    id: 'phq-9',
    name: 'PHQ-9 抑郁症筛查量表',
    shortName: 'PHQ-9',
    category: 'all',
    ageRange: '18岁以上',
    duration: '3-5分钟',
    questionCount: 9,
    tags: ['抑郁', '情绪'],
    description: '广泛使用的成人抑郁症状快速筛查工具，评估过去两周的情绪状态。',
    recommended: false,
  },
  {
    id: 'gad-7',
    name: 'GAD-7 广泛性焦虑量表',
    shortName: 'GAD-7',
    category: 'all',
    ageRange: '18岁以上',
    duration: '3-5分钟',
    questionCount: 7,
    tags: ['焦虑', '情绪'],
    description: '成人广泛性焦虑障碍的快速筛查工具，评估焦虑症状的频率与严重程度。',
    recommended: false,
  },
  {
    id: 'mbti',
    name: 'MBTI 性格类型指标',
    shortName: 'MBTI',
    category: 'all',
    ageRange: '16岁以上',
    duration: '15-25分钟',
    questionCount: 93,
    tags: ['性格', '探索'],
    description: '探索个人性格偏好与行为风格的经典人格类型评估工具。',
    recommended: false,
  },
  {
    id: 'holland',
    name: 'Holland 霍兰德职业兴趣量表',
    shortName: 'HOLLAND',
    category: 'all',
    ageRange: '16岁以上',
    duration: '10-20分钟',
    questionCount: 60,
    tags: ['职业', '兴趣'],
    description: '基于霍兰德职业兴趣理论，帮助了解个人职业倾向与兴趣类型。',
    recommended: false,
  },
];

// ─── Questions (keyed by scale ID) ─────────────────────────────────────────────

export const questions: Record<string, Question[]> = {
  'snap-iv': [
    {
      id: 'q1',
      text: '孩子经常不注意细节，或在作业、活动中犯粗心的错误',
      options: [
        { id: 'q1-o1', label: '完全没有', value: 0 },
        { id: 'q1-o2', label: '有一点', value: 1 },
        { id: 'q1-o3', label: '比较多', value: 2 },
        { id: 'q1-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q2',
      text: '孩子在玩耍或完成任务时，很难持续保持注意力',
      options: [
        { id: 'q2-o1', label: '完全没有', value: 0 },
        { id: 'q2-o2', label: '有一点', value: 1 },
        { id: 'q2-o3', label: '比较多', value: 2 },
        { id: 'q2-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q3',
      text: '和别人说话时，孩子似乎没有在听，好像心不在焉',
      options: [
        { id: 'q3-o1', label: '完全没有', value: 0 },
        { id: 'q3-o2', label: '有一点', value: 1 },
        { id: 'q3-o3', label: '比较多', value: 2 },
        { id: 'q3-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q4',
      text: '孩子经常不按照指示完成作业或家务（并非因为对抗或听不懂）',
      options: [
        { id: 'q4-o1', label: '完全没有', value: 0 },
        { id: 'q4-o2', label: '有一点', value: 1 },
        { id: 'q4-o3', label: '比较多', value: 2 },
        { id: 'q4-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q5',
      text: '孩子在组织任务和活动时存在明显困难',
      options: [
        { id: 'q5-o1', label: '完全没有', value: 0 },
        { id: 'q5-o2', label: '有一点', value: 1 },
        { id: 'q5-o3', label: '比较多', value: 2 },
        { id: 'q5-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q6',
      text: '孩子经常回避或不喜欢需要持续动脑的任务（如做作业）',
      options: [
        { id: 'q6-o1', label: '完全没有', value: 0 },
        { id: 'q6-o2', label: '有一点', value: 1 },
        { id: 'q6-o3', label: '比较多', value: 2 },
        { id: 'q6-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q7',
      text: '孩子经常把任务或活动所需的东西弄丢（如文具、书本、玩具）',
      options: [
        { id: 'q7-o1', label: '完全没有', value: 0 },
        { id: 'q7-o2', label: '有一点', value: 1 },
        { id: 'q7-o3', label: '比较多', value: 2 },
        { id: 'q7-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q8',
      text: '孩子很容易被外界的刺激分心',
      options: [
        { id: 'q8-o1', label: '完全没有', value: 0 },
        { id: 'q8-o2', label: '有一点', value: 1 },
        { id: 'q8-o3', label: '比较多', value: 2 },
        { id: 'q8-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q9',
      text: '孩子经常忘记日常活动（如刷牙、收拾书包）',
      options: [
        { id: 'q9-o1', label: '完全没有', value: 0 },
        { id: 'q9-o2', label: '有一点', value: 1 },
        { id: 'q9-o3', label: '比较多', value: 2 },
        { id: 'q9-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q10',
      text: '孩子经常手脚不停地动，或在座位上扭来扭去',
      options: [
        { id: 'q10-o1', label: '完全没有', value: 0 },
        { id: 'q10-o2', label: '有一点', value: 1 },
        { id: 'q10-o3', label: '比较多', value: 2 },
        { id: 'q10-o4', label: '非常多', value: 3 },
      ],
    },
  ],

  'abc': [
    {
      id: 'q1',
      text: '孩子在被叫名字时，能够转头或有反应',
      options: [
        { id: 'q1-o1', label: '完全没有', value: 0 },
        { id: 'q1-o2', label: '有一点', value: 1 },
        { id: 'q1-o3', label: '比较多', value: 2 },
        { id: 'q1-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q2',
      text: '孩子能够用眼神注视他人的面部',
      options: [
        { id: 'q2-o1', label: '完全没有', value: 0 },
        { id: 'q2-o2', label: '有一点', value: 1 },
        { id: 'q2-o3', label: '比较多', value: 2 },
        { id: 'q2-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q3',
      text: '孩子对周围的声音有反应（如音乐、噪音）',
      options: [
        { id: 'q3-o1', label: '完全没有', value: 0 },
        { id: 'q3-o2', label: '有一点', value: 1 },
        { id: 'q3-o3', label: '比较多', value: 2 },
        { id: 'q3-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q4',
      text: '孩子能主动伸手去拿感兴趣的物品',
      options: [
        { id: 'q4-o1', label: '完全没有', value: 0 },
        { id: 'q4-o2', label: '有一点', value: 1 },
        { id: 'q4-o3', label: '比较多', value: 2 },
        { id: 'q4-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q5',
      text: '孩子可以用简单的手势或动作表达需求（如指向想要的东西）',
      options: [
        { id: 'q5-o1', label: '完全没有', value: 0 },
        { id: 'q5-o2', label: '有一点', value: 1 },
        { id: 'q5-o3', label: '比较多', value: 2 },
        { id: 'q5-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q6',
      text: '孩子能够独立用杯子喝水或用勺子吃饭',
      options: [
        { id: 'q6-o1', label: '完全没有', value: 0 },
        { id: 'q6-o2', label: '有一点', value: 1 },
        { id: 'q6-o3', label: '比较多', value: 2 },
        { id: 'q6-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q7',
      text: '孩子对陌生环境或陌生人表现出过度紧张或恐惧',
      options: [
        { id: 'q7-o1', label: '完全没有', value: 0 },
        { id: 'q7-o2', label: '有一点', value: 1 },
        { id: 'q7-o3', label: '比较多', value: 2 },
        { id: 'q7-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q8',
      text: '孩子会重复做同一个动作（如拍手、摇晃身体、转圈）',
      options: [
        { id: 'q8-o1', label: '完全没有', value: 0 },
        { id: 'q8-o2', label: '有一点', value: 1 },
        { id: 'q8-o3', label: '比较多', value: 2 },
        { id: 'q8-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q9',
      text: '孩子在与人交往时缺乏互动，很少主动与人分享快乐',
      options: [
        { id: 'q9-o1', label: '完全没有', value: 0 },
        { id: 'q9-o2', label: '有一点', value: 1 },
        { id: 'q9-o3', label: '比较多', value: 2 },
        { id: 'q9-o4', label: '非常多', value: 3 },
      ],
    },
    {
      id: 'q10',
      text: '孩子的语言发展明显落后于同龄孩子',
      options: [
        { id: 'q10-o1', label: '完全没有', value: 0 },
        { id: 'q10-o2', label: '有一点', value: 1 },
        { id: 'q10-o3', label: '比较多', value: 2 },
        { id: 'q10-o4', label: '非常多', value: 3 },
      ],
    },
  ],
};

// ─── AI Explanations (keyed by questionId, matches SNAP-IV questions) ──────────

export const aiExplanations: Record<string, string> = {
  q1: '这道题观察的是孩子在完成任务时对细节的关注程度。粗心错误可能包括：把数字看错、漏掉题目、写字笔画出错等。请回想孩子近6个月的表现，不必追求精确次数。',
  q2: '这道题关注孩子的持续注意力。有些孩子在感兴趣的事情上可以集中注意，但在课堂听讲或完成作业时很快走神，这属于"选择性注意"的表现，请综合判断。',
  q3: '这道题评估孩子的"倾听质量"。心不在焉不一定代表孩子故意不理人，也可能是注意力被其他事物吸引后难以回到当前对话中。请区分是偶尔还是经常发生。',
  q4: '这道题观察孩子执行指令的能力。如果孩子能听懂要求但经常半途而废，或者做了几步就被其他事情吸引，这属于执行功能方面的表现，和故意违抗是不同的。',
  q5: '这道题评估孩子的组织能力，包括规划任务步骤、安排物品顺序、管理时间等。对于年龄较小的孩子，可以观察他们收拾玩具、准备出门时是否有条理。',
  q6: '这道题关注孩子对"脑力劳动"的回避倾向。如果孩子能主动做体力活动但一遇到需要持续思考的事情就想放弃，这是注意力维持困难的一种典型表现。',
  q7: '这道题评估孩子的物品管理能力。经常丢东西可能和注意力分散有关——孩子在转换活动时容易忘记手头的东西。偶尔遗忘是正常的，关键看频率。',
  q8: '这道题观察孩子抵御外界干扰的能力。容易被分心的孩子，即使在做喜欢的事情时也可能因为环境中的声音、光线或他人活动而中断。',
  q9: '这道题评估孩子对日常惯例的记忆。忘记刷牙、收拾书包这类每天重复的事情，可能反映出孩子的工作记忆和日常执行功能还在发展中。',
  q10: '这道题开始评估多动/冲动维度。手脚不停或在座位上扭动，是"多动"的核心表现之一。请注意区分：在需要安静坐着的场合（如吃饭、上课）是否特别明显。',
};

// ─── Report ────────────────────────────────────────────────────────────────────

export const report: Report = {
  sessionId: 'session-1',
  scaleName: 'SNAP-IV',
  childName: '小明',
  completedAt: '2024-12-10',
  totalScore: 18,
  maxScore: 30,
  riskLevel: 'moderate',
  riskLabel: '中度关注',
  summary:
    '评估结果显示孩子在注意力方面存在一定困难，多动/冲动维度得分偏高。建议在日常生活中加强关注，并考虑进一步专业评估。本次结果仅作为参考，不代表最终诊断结论。',
  dimensions: [
    {
      name: '注意力',
      score: 8,
      maxScore: 15,
      level: 'moderate',
      description:
        '孩子在持续注意、抗干扰和任务完成方面存在一定挑战，建议通过结构化活动帮助提升注意力持续时间。',
    },
    {
      name: '多动/冲动',
      score: 10,
      maxScore: 15,
      level: 'high',
      description:
        '多动/冲动行为较为明显，在需要安静就座的场合尤为突出。建议观察是否影响到课堂学习和同伴交往。',
    },
  ],
  recommendations: [
    '建议定期观察孩子在不同环境（家庭、幼儿园）中的注意力表现，记录具体情境。',
    '可以咨询儿童心理或发育专科医生，了解是否需要进一步的综合评估。',
    '在日常生活中尝试使用视觉提示、计时器等工具帮助孩子建立任务意识。',
    '建议3个月后进行一次复评，以追踪变化趋势。',
  ],
};

// ─── History ───────────────────────────────────────────────────────────────────

export const history: HistoryRecord[] = [
  {
    id: 'h-1',
    sessionId: 'session-1',
    scaleName: 'SNAP-IV',
    childName: '小明',
    childId: 'child-1',
    completedAt: '2024-12-10',
    status: 'completed',
    riskLevel: 'moderate',
    riskLabel: '中度关注',
  },
  {
    id: 'h-2',
    sessionId: 'session-2',
    scaleName: 'SRS',
    childName: '小明',
    childId: 'child-1',
    completedAt: '2024-12-05',
    status: 'completed',
    riskLevel: 'low',
    riskLabel: '低风险',
  },
  {
    id: 'h-3',
    sessionId: 'session-3',
    scaleName: 'ABC',
    childName: '小宇',
    childId: 'child-3',
    completedAt: '2024-11-28',
    status: 'completed',
    riskLevel: 'low',
    riskLabel: '低风险',
  },
  {
    id: 'h-4',
    sessionId: 'session-4',
    scaleName: 'M-CHAT-R',
    childName: '小花',
    childId: 'child-2',
    completedAt: '2024-11-20',
    status: 'in_progress',
    riskLevel: 'moderate',
    riskLabel: '中度关注',
  },
  {
    id: 'h-5',
    sessionId: 'session-5',
    scaleName: 'SNAP-IV',
    childName: '小明',
    childId: 'child-1',
    completedAt: '2024-11-15',
    status: 'completed',
    riskLevel: 'high',
    riskLabel: '高度关注',
  },
  {
    id: 'h-6',
    sessionId: 'session-6',
    scaleName: 'CARS',
    childName: '小宇',
    childId: 'child-3',
    completedAt: '2024-11-08',
    status: 'completed',
    riskLevel: 'low',
    riskLabel: '低风险',
  },
];

// ─── Doctor Patients ───────────────────────────────────────────────────────────

export const doctorPatients: DoctorPatient[] = [
  {
    id: 'dp-1',
    name: '张一诺',
    age: 60,
    ageLabel: '5岁',
    gender: 'female',
    avatar: '👧',
    isTemporary: false,
    latestAssessment: {
      scaleName: 'SRS',
      date: '2024-12-08',
      riskLevel: 'low',
    },
  },
  {
    id: 'dp-2',
    name: '李子轩',
    age: 48,
    ageLabel: '4岁',
    gender: 'male',
    avatar: '👦',
    isTemporary: false,
    latestAssessment: null,
  },
  {
    id: 'dp-3',
    name: '王小宝',
    age: 36,
    ageLabel: '3岁',
    gender: 'male',
    avatar: '🧒',
    isTemporary: false,
    latestAssessment: {
      scaleName: 'M-CHAT-R',
      date: '2024-12-05',
      riskLevel: 'moderate',
    },
  },
  {
    id: 'dp-4',
    name: '刘小雨',
    age: 84,
    ageLabel: '7岁',
    gender: 'female',
    avatar: '👧',
    isTemporary: true,
    latestAssessment: null,
  },
  {
    id: 'dp-5',
    name: '赵天天',
    age: 54,
    ageLabel: '4岁6个月',
    gender: 'male',
    avatar: '👦',
    isTemporary: false,
    latestAssessment: {
      scaleName: 'SNAP-IV',
      date: '2024-11-20',
      riskLevel: 'high',
    },
  },
];

// ─── Doctor Stats ──────────────────────────────────────────────────────────────

export const doctorStats: DoctorStats = {
  todayCount: 3,
  monthCount: 28,
};

// ─── Doctor History ────────────────────────────────────────────────────────────

export const doctorHistory: DoctorHistoryRecord[] = [
  {
    id: 'dh-1',
    patientName: '张一诺',
    scaleName: 'SRS',
    date: '2024-12-08',
    fillMode: 'doctor_assisted',
    status: 'completed',
    riskLevel: 'low',
  },
  {
    id: 'dh-2',
    patientName: '王小宝',
    scaleName: 'M-CHAT-R',
    date: '2024-12-05',
    fillMode: 'caregiver_handoff_locked',
    status: 'completed',
    riskLevel: 'moderate',
  },
  {
    id: 'dh-3',
    patientName: '赵天天',
    scaleName: 'SNAP-IV',
    date: '2024-11-20',
    fillMode: 'doctor_assisted',
    status: 'completed',
    riskLevel: 'high',
  },
  {
    id: 'dh-4',
    patientName: '刘小雨',
    scaleName: 'ABC',
    date: '2024-11-15',
    fillMode: 'doctor_assisted',
    status: 'in_progress',
    riskLevel: 'low',
  },
  {
    id: 'dh-5',
    patientName: '李子轩',
    scaleName: 'CARS',
    date: '2024-11-10',
    fillMode: 'caregiver_handoff_locked',
    status: 'completed',
    riskLevel: 'moderate',
  },
];
