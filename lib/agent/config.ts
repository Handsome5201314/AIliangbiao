import { prisma } from '@/lib/db/prisma';
import { PROVIDER_CONFIGS, type ApiServiceType } from '@/lib/services/apiKeyService';
import { TRIAGE_SYSTEM_PROMPT } from '@/lib/services/triageFlow';

export const AGENT_WORKSPACE_CONFIG_KEY = 'agentWorkspaceConfig';

export const DEFAULT_AGENT_WORKSPACE_CONFIG = {
  rollout: {
    unifiedShellEnabled: false,
    hermesBackendEnabled: false,
    publicShareUsesUnifiedShell: false,
    experimentalVoiceEnabled: false,
    knowledgeDefaultMode: 'platform_proxy',
  },
  models: {
    textProvider: 'qwen',
    textModel: 'qwen-max',
    speechProvider: 'siliconflow',
    speechModel: 'FunAudioLLM/SenseVoiceSmall',
    allowFallbackToSystemDefault: true,
  },
  quota: {
    guestAgentDailyLimit: 5,
    registeredAgentDailyLimit: 20,
    vipAgentDailyLimit: 999,
    warnAtRemaining: 1,
  },
  prompts: {
    triageSystemPrompt: TRIAGE_SYSTEM_PROMPT,
    bootstrapDoctor:
      '已进入医生自主工作台。我会先给出计划，再在你确认后执行邀填、画像查看或量表相关任务。',
    bootstrapPatient:
      '已进入自主工作台。我会先给出执行计划，再在你确认后自动完成推荐量表、启动会话和画像任务。',
    followUpUnknown:
      '我还不能准确判断你的任务。你可以直接说：推荐量表、查看画像、导出快照，或者为某个量表生成医生邀填。',
    followUpDoctorInviteNeedsScale:
      '我可以帮你生成医生邀填。请直接告诉我量表名称或量表 ID，例如：为 GAD-7 生成邀填。',
    assessmentPlan:
      '我建议先做 {scaleId}。确认后我会自动读取上下文、推荐量表并启动站内会话。',
    inspectProfilePlan:
      '我已经整理好一份“画像诊断”计划。确认后我会读取当前成员画像和最近评估，并给出摘要。',
    exportProfilePlan:
      '我已经整理好一份“画像读取与导出”计划。确认后我会读取当前画像，并导出最新的 Persona Snapshot。',
    doctorInvitePlan:
      '我已经整理好一份“医生邀填”计划：为 {scaleId} 生成邀填链接和二维码。确认后我会自动执行。',
    doctorUnknownGoal:
      '我需要再明确一点你的目标，例如“给 GAD-7 生成邀填”或“看看当前成员画像”。',
    patientUnknownGoal:
      '我需要再明确一点你的目标，例如“我最近很焦虑，帮我推荐量表”或“导出人格快照”。',
    activeAssessmentGuard:
      '当前有一个进行中的量表会话。建议先完成或取消它，再发起新的自主任务。',
    startedAssessment:
      '已在工作台中启动 {scaleId} 量表，接下来可以直接在右侧答题区推进会话。',
    cancelledAssessment:
      '当前量表会话已取消，你可以继续提新的任务。',
    completedAssessment:
      '量表已完成，结论是：{conclusion}。我会同步更新当前活体画像。',
    planCancelled:
      '本次计划已取消。',
    assessmentAdviceSystemZh:
      '你是一位专业、温和、注重可执行性的儿童与家庭评估助理。请根据量表结果，用简洁清晰的中文解释结果，并给出面向家长的实用建议。输出必须全中文，不要混入英文。重点包含：结果解读、值得关注的点、2到5条具体建议、何时需要专业支持。避免过度诊断。',
    assessmentAdviceSystemEn:
      'You are a professional, warm, and practical assessment assistant for children and families. Based on the assessment result, explain the outcome clearly in English and provide useful caregiver guidance. The output must stay fully in English. Include: a concise interpretation, key watch-outs, 2 to 5 actionable suggestions, and when to seek professional support. Avoid over-diagnosing.',
  },
  ui: {
    badgeLabel: 'Autonomous Agent Workspace',
    workspaceTitle: '小安 · 自主工作台',
    workspaceDescription:
      '这里不是简单聊天框，而是“先出计划、再确认、再自动执行”的任务型 agent 工作台。它会调用现有的量表、画像和医生邀填能力，但不会绕过你的权限边界。',
    loadingText: '正在建立自主工作台会话...',
    backToHomeLabel: '返回主站',
    currentIdentityLabel: '当前身份',
    doctorIdentityValue: '医生',
    patientIdentityValue: '患者/注册用户',
    guestIdentityValue: '游客',
    currentMemberLabel: '当前成员',
    workspaceStateLabel: '工作台状态',
    doctorWorkspaceHeadline: '医生可在这里生成邀填、查看画像，也能直接启动自己的量表任务',
    patientWorkspaceHeadline: '患者可在这里获得推荐量表、推进会话、更新画像并导出快照',
    availableToolsLabel: '当前可用工具',
    refreshWorkspaceLabel: '刷新工作台',
    goalPlaceholderDoctor: '例如：为 GAD-7 生成医生邀填；看看当前成员画像；帮我启动一次焦虑量表。',
    goalPlaceholderPatient: '例如：我最近总是很焦虑；帮我看看画像最近有什么变化；导出人格快照。',
    planningButtonLabel: '生成计划',
    voiceInputTitle: '语音输入通道',
    voiceInputDescription:
      '第一版语音输入继续复用现有 skill voice pipeline。它可以作为输入通道来直接启动推荐量表或站内会话，但计划器仍以文本计划为主。',
    currentPlanTitle: '当前计划',
    emptyPlanText: '先在左侧输入一个目标，工作台会先生成计划，再等待你确认。',
    confirmPlanLabel: '确认并执行',
    cancelPlanLabel: '取消计划',
    executionGoalTitle: '执行目标',
    executionStatusLabel: '状态',
    executionRefreshLabel: '刷新轨迹',
    retryExecutionLabel: '重试执行',
    emptyExecutionText: '计划执行后，这里会显示每一步工具调用的轨迹和结果。',
    contextPaneTitle: '当前成员',
    profilePaneTitle: '活体画像',
    rebuildProfileLabel: '重算画像',
    profileVersionLabel: '版本',
    profileReliabilityLabel: '可靠度',
    profileDepthLabel: '数据深度',
    exportSnapshotLabel: '导出 Persona Snapshot v1',
    emptyProfileText: '当前成员还没有可用画像。',
    assessmentSummaryTitle: '评估摘要',
    emptyAssessmentSummaryText: '暂无近期评估。',
    latestInviteTitle: '最新邀填结果',
    latestInviteScaleLabel: '量表',
    assessmentSessionTitle: '站内量表会话',
    currentScaleLabel: '当前量表',
    currentQuestionLabel: '当前题目',
    endAssessmentLabel: '结束本次量表',
    totalScoreLabel: '总分',
    emptyAssessmentSessionText: '当前没有进行中的量表会话。',
    quickStartTitle: '快速开始',
  },
  voiceUi: {
    stateLabels: {
      initialZh: '点击麦克风，告诉我最近最困扰的情况。',
      initialEn: 'Tap the microphone and tell me what has been happening recently.',
      triageZh: '我正在帮你梳理最关键的症状表现。',
      triageEn: 'I am narrowing down the main concerns.',
      consentZh: '已经推荐好量表，正在等待你的确认。',
      consentEn: 'A recommended scale is ready and waiting for your confirmation.',
      handoffZh: '即将开始推荐的量表评估。',
      handoffEn: 'Starting the recommended assessment...',
      pausedZh: '分诊会话已暂停。',
      pausedEn: 'The triage session is paused.',
      defaultZh: '分诊进行中。',
      defaultEn: 'Triage is in progress.',
    },
    introCallZh: '通话模式已开启。你可以直接告诉我{memberName}最近的情况，我会一步步引导到合适的量表。',
    introCallEn: 'Call mode is ready. Tell me about {memberName} and I will guide you to the right assessment.',
    timeoutPauseZh: '我暂时还没有听到你的回应，我们先停在这里。准备好了再点麦克风，或者直接说“继续”就可以。',
    timeoutPauseEn: 'I have not heard a response yet, so I will pause here. You can tap the microphone or say continue when you are ready.',
    timeoutRepromptZh: '我还在这儿。你可以直接说症状表现，也可以让我重复刚才的问题。',
    timeoutRepromptEn: 'I am still here. You can briefly describe the symptom, or ask me to repeat the last prompt.',
    startRecordingFailedZh: '录音启动失败。',
    startRecordingFailedEn: 'Failed to start recording.',
    microphoneDeniedZh: '麦克风权限被拒绝，请允许后重试。',
    microphoneDeniedEn: 'Microphone permission was denied.',
    microphoneMissingZh: '未检测到麦克风设备。',
    microphoneMissingEn: 'No microphone device was found.',
    unsupportedRecordingZh: '当前浏览器不支持录音。',
    unsupportedRecordingEn: 'This browser does not support recording.',
    unsupportedAudioFormatZh: '浏览器不支持当前音频格式。',
    unsupportedAudioFormatEn: 'No supported audio format was found.',
    voiceSessionPreparingZh: '语音会话还在准备中，请稍候再试。',
    voiceSessionPreparingEn: 'Voice session is still initializing.',
    noSystemApiKeyZh: '系统未配置可用的 API Key。',
    noSystemApiKeyEn: 'No system API key is configured.',
    aiEmptyResponseZh: 'AI 返回了空响应。',
    aiEmptyResponseEn: 'The AI returned an empty response.',
    triageFailedZh: '分诊处理失败。',
    triageFailedEn: 'Triage failed.',
    transcriptionFailedZh: '语音识别失败。',
    transcriptionFailedEn: 'Transcription failed.',
    noValidSpeechZh: '未识别到有效语音。',
    noValidSpeechEn: 'No valid speech was detected.',
    letMeHelpZh: '我来继续帮你梳理。',
    letMeHelpEn: 'Let me help with that.',
    fallbackSimpleZh: '我们可以说得更简单一些。你可以直接说：不爱说话、重复动作、眼神少、坐不住。',
    fallbackSimpleEn: 'Let us keep it simple. You can say things like: not speaking much, repeating actions, poor eye contact, or cannot sit still.',
    continuePromptZh: '继续刚才的分诊。',
    continuePromptEn: 'Continue the triage session.',
    pausePromptZh: '先暂停一下。',
    pausePromptEn: 'Pause for now.',
    phaseIdleZh: '待命中',
    phaseIdleEn: 'Ready',
    phaseRecordingZh: '正在听你说',
    phaseRecordingEn: 'Listening',
    phaseThinkingZh: '正在理解',
    phaseThinkingEn: 'Thinking',
    phaseSpeakingZh: '正在播报',
    phaseSpeakingEn: 'Speaking',
    phasePausedZh: '已暂停',
    phasePausedEn: 'Paused',
    phaseConsentZh: '已推荐量表',
    phaseConsentEn: 'Ready To Start',
    preparingWorkspaceZh: '正在准备语音工作区，请稍候...',
    preparingWorkspaceEn: 'Preparing the voice workspace...',
    youSaidZh: '你刚刚说：',
    youSaidEn: 'You said:',
    remainingQuotaZh: '今日剩余：',
    remainingQuotaEn: 'Remaining today:',
    startScaleNowZh: '直接开始 {scaleId} 评估',
    startScaleNowEn: 'Start {scaleId} now',
    startScaleShortZh: '开始 {scaleId}',
    startScaleShortEn: 'Start {scaleId}',
    repeatReplyZh: '重复播报',
    repeatReplyEn: 'Repeat assistant reply',
    pauseAriaZh: '暂停分诊',
    pauseAriaEn: 'Pause triage',
    resumeAriaZh: '继续分诊',
    resumeAriaEn: 'Resume triage',
    transcribingZh: '正在识别语音...',
    transcribingEn: 'Transcribing...',
    analyzingZh: '正在分析分诊内容...',
    analyzingEn: 'Analyzing...',
    processingZh: '处理中...',
    processingEn: 'Processing...',
    stopRecordingHintZh: '点击停止录音',
    stopRecordingHintEn: 'Tap to stop recording',
    startRecordingHintZh: '点击开始说话。你也可以直接说“重复一遍”“解释一下”“暂停”“继续”。',
    startRecordingHintEn: 'Tap to start talking. You can also say repeat, explain, pause, or continue.',
    timeoutRuleZh: '如果 {seconds} 秒内没有回应，我会轻柔重问，并在多次无回应后自动暂停。',
    timeoutRuleEn: 'If there is no response within {seconds} seconds, I will gently reprompt and then pause automatically.',
    fallbackRuleZh: '如果连续 {count} 次都没理解，我会自动切换成更简单的话术来引导。',
    fallbackRuleEn: 'If I fail to understand {count} times in a row, I will switch to simpler guidance automatically.',
    interruptRuleZh: '你可以随时打断并直接说“重复一遍”“解释一下”“暂停”“继续”或“现在开始”。',
    interruptRuleEn: 'You can interrupt at any time and say repeat, explain, pause, continue, or start now.',
  },
  toolRules: {
    intentKeywords: {
      exportProfile: ['persona', 'snapshot', 'dna', '导出', '画像快照', '人格快照', 'json'],
      inspectProfile: ['画像', '变化', '人格', '特征', '最近变化', 'profile'],
      doctorInvite: ['邀填', '二维码', '链接', '扫码', 'invite', 'qr'],
      anxiety: ['anxiety', 'anxious', '焦虑'],
      depression: ['depression', 'depressed', '抑郁'],
      adhd: ['adhd', 'attention', 'hyperactivity', '多动', '注意力'],
      autism: ['autism', 'asd', '自闭', '孤独症', '社交困难'],
      mbti: ['mbti', '人格'],
    },
    tools: {
      'context.read_member': {
        summaryTemplate: '读取当前成员上下文',
        riskLevel: 'low',
        confirmBeforeExecute: false,
      },
      'context.read_assessments': {
        summaryTemplate: '读取最近评估摘要',
        riskLevel: 'low',
        confirmBeforeExecute: false,
      },
      'profile.read': {
        summaryTemplate: '读取当前活体画像',
        riskLevel: 'low',
        confirmBeforeExecute: false,
      },
      'profile.rebuild': {
        summaryTemplate: '重算当前活体画像',
        riskLevel: 'medium',
        confirmBeforeExecute: false,
      },
      'profile.export_v1': {
        summaryTemplate: '导出最新 Persona Snapshot v1',
        riskLevel: 'high',
        confirmBeforeExecute: true,
      },
      'assessment.recommend': {
        summaryTemplate: '确认推荐量表 {scaleId}',
        riskLevel: 'low',
        confirmBeforeExecute: false,
      },
      'assessment.session.start': {
        summaryTemplate: '启动 {scaleId} 站内会话',
        riskLevel: 'low',
        confirmBeforeExecute: false,
      },
      'doctor.invites.create': {
        summaryTemplate: '为 {scaleId} 生成医生邀填链接',
        riskLevel: 'high',
        confirmBeforeExecute: true,
      },
      'doctor.invites.list': {
        summaryTemplate: '读取最近邀填状态',
        riskLevel: 'low',
        confirmBeforeExecute: false,
      },
    },
  },
  legacyFeatures: {
    profileContextApi: {
      title: 'Legacy Profile Context API',
      description: '旧的 deviceId 画像上下文接口，路径是 /api/profile/context，主要维护 interests / fears / behaviors。',
    },
    memoryMcpSkill: {
      title: 'Legacy Memory MCP Skill',
      description: '旧的 MCP 记忆技能，路径是 lib/mcp/skills/memory/handlers.ts，用于读写用户记忆。',
    },
    personaSnapshotV1: {
      title: 'Persona Snapshot v1',
      description: '当前对外导出的 Arena DNA / Persona Snapshot 协议，仍然由量表结果动态映射生成。',
    },
    agentProfileState: {
      title: 'Agent Profile State',
      description: '当前 /agent 新增的活体画像状态层，用于在自主工作台中汇总画像、状态效果和评估历史。',
    },
  },
} as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override ?? base) as T;
  }

  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

function normalizeStoredJson(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

type SystemAiKeyCandidate = {
  provider: string;
  serviceType: string;
  customModel: string | null;
  connectionStatus: string | null;
  usageCount: number;
};

function resolveModelForService(input: {
  serviceType: ApiServiceType;
  preferredProvider?: string;
  preferredModel?: string;
  candidates: SystemAiKeyCandidate[];
}) {
  const serviceCandidates = input.candidates.filter((item) => item.serviceType === input.serviceType);
  if (!serviceCandidates.length) {
    return {
      provider: input.preferredProvider || DEFAULT_AGENT_WORKSPACE_CONFIG.models[input.serviceType === 'speech' ? 'speechProvider' : 'textProvider'],
      model: input.preferredModel || DEFAULT_AGENT_WORKSPACE_CONFIG.models[input.serviceType === 'speech' ? 'speechModel' : 'textModel'],
    };
  }

  const matchingPreferred = input.preferredProvider
    ? serviceCandidates.find((item) => item.provider === input.preferredProvider)
    : null;

  const selected = matchingPreferred || serviceCandidates[0];
  const provider = selected.provider;
  const providerConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.custom;
  const fallbackModel =
    input.serviceType === 'speech' ? providerConfig.speechModel : providerConfig.textModel;

  return {
    provider,
    model: input.preferredModel && matchingPreferred
      ? input.preferredModel
      : selected.customModel || fallbackModel || input.preferredModel || '',
  };
}

async function hydrateAgentModelDefaults(config: typeof DEFAULT_AGENT_WORKSPACE_CONFIG) {
  const candidates = await prisma.apiKey.findMany({
    where: {
      purpose: 'AI',
      isActive: true,
      userId: null,
      NOT: { provider: 'mcp' },
    },
    select: {
      provider: true,
      serviceType: true,
      customModel: true,
      connectionStatus: true,
      usageCount: true,
    },
    orderBy: [
      { serviceType: 'asc' },
      { connectionStatus: 'asc' },
      { usageCount: 'asc' },
    ],
  });

  const text = resolveModelForService({
    serviceType: 'text',
    preferredProvider: config.models.textProvider,
    preferredModel: config.models.textModel,
    candidates,
  });

  const speech = resolveModelForService({
    serviceType: 'speech',
    preferredProvider: config.models.speechProvider,
    preferredModel: config.models.speechModel,
    candidates,
  });

  return {
    ...config,
    models: {
      ...config.models,
      textProvider: text.provider,
      textModel: text.model,
      speechProvider: speech.provider,
      speechModel: speech.model,
    },
  };
}

export async function getAgentWorkspaceConfig() {
  const stored = await prisma.systemConfig.findUnique({
    where: { configKey: AGENT_WORKSPACE_CONFIG_KEY },
  });

  const parsed = normalizeStoredJson(stored?.configValue);
  const merged = deepMerge(DEFAULT_AGENT_WORKSPACE_CONFIG, parsed || {});
  return hydrateAgentModelDefaults(merged);
}

export async function saveAgentWorkspaceConfig(config: unknown) {
  const normalized = deepMerge(DEFAULT_AGENT_WORKSPACE_CONFIG, config || {});

  await prisma.systemConfig.upsert({
    where: { configKey: AGENT_WORKSPACE_CONFIG_KEY },
    update: {
      configValue: JSON.stringify(normalized, null, 2),
      description: 'Agent workspace prompts, tool rules, UI guidance, and legacy feature notes',
      updatedAt: new Date(),
    },
    create: {
      configKey: AGENT_WORKSPACE_CONFIG_KEY,
      configValue: JSON.stringify(normalized, null, 2),
      description: 'Agent workspace prompts, tool rules, UI guidance, and legacy feature notes',
    },
  });

  return normalized;
}

export async function getDefaultAgentWorkspaceConfigJson() {
  const config = await getAgentWorkspaceConfig();
  return JSON.stringify(config, null, 2);
}
