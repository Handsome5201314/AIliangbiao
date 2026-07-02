import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';
import type { LanguageCode, ScaleDefinition } from '@/lib/schemas/core/types';
import {
  createAssessmentSessionForDevice,
  getLatestActiveAssessmentSession,
  getAssessmentSessionForDevice,
  submitAssessmentAnswerForDevice,
} from '@/lib/assessment-skill/scale-service';
import { resolveUserByDeviceId } from '@/lib/assessment-skill/member-service';
import { getSerializableScaleById, listDoctorVisibleScales } from '@/lib/scales/catalog';
import { decryptSecret, encryptSecret } from '@/lib/utils/secretCrypto';
import { generateUUID } from '@/lib/utils/uuid';
import { getActiveDoctorAssignment } from '@/lib/services/doctor-care';
import { analyzeCompletedAssessmentResult } from '@/lib/services/assessment-advice';

const toolCallArgumentsSchema = z.object({
  scaleId: z.string().min(1),
  reason: z.string().min(1),
  cardTitle: z.string().optional(),
  cardBody: z.string().optional(),
});

type DoctorBotStatus = 'draft' | 'published' | 'disabled';

type ChatCompletionMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type DoctorBotConfigInput = {
  assistantName: string;
  avatarUrl?: string;
  welcomeMessage?: string;
  publicSlug: string;
  fastgptBaseUrl: string;
  fastgptApiKey?: string;
  enabledScaleIds: string[];
  status: DoctorBotStatus;
};

type FastgptCompletionResponse = {
  id?: string;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | Array<{ type?: string; text?: string; [key: string]: unknown }>;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type LegacyFastgptEnvelope = {
  patientReply?: string;
  reply?: string;
  message?: string;
  text?: string;
  action?: string;
  scaleId?: string;
  reason?: string;
  cardTitle?: string;
  cardBody?: string;
};

const FASTGPT_REQUEST_TIMEOUT_MS = 25_000;

export class DoctorBotChatError extends Error {
  statusCode: number;
  code: string;
  data?: unknown;

  constructor(message: string, statusCode = 502, code = 'DOCTOR_BOT_ERROR', data?: unknown) {
    super(message);
    this.name = 'DoctorBotChatError';
    this.statusCode = statusCode;
    this.code = code;
    this.data = data;
  }
}

function doctorBotModel() {
  return (prisma as any).doctorBotConfig;
}

function doctorBotChatSessionModel() {
  return (prisma as any).doctorBotChatSession;
}

function normalizeLanguage(input?: string | null): LanguageCode {
  return String(input || '').toLowerCase() === 'en' ? 'en' : 'zh';
}

function normalizeScaleId(scaleId: string) {
  const canonical = getSerializableScaleById(scaleId);
  return canonical?.id || scaleId.trim().toUpperCase();
}

function normalizeScaleIdList(scaleIds: string[]) {
  const deduped = new Map<string, string>();

  scaleIds
    .map((scaleId) => normalizeScaleId(scaleId))
    .filter(Boolean)
    .forEach((scaleId) => {
      deduped.set(scaleId.toUpperCase(), scaleId);
    });

  return [...deduped.values()];
}

function hasEnabledScale(enabledScaleIds: string[], scaleId: string) {
  const normalized = scaleId.trim().toUpperCase();
  return enabledScaleIds.some((item) => item.toUpperCase() === normalized);
}

function normalizeChatCompletionUrl(input: string) {
  const url = new URL(input.trim());
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error('FastGPT API URL must start with http or https');
  }

  if (url.pathname.endsWith('/chat/completions')) {
    return url.toString();
  }

  if (url.pathname.endsWith('/api')) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/chat/completions`;
    return url.toString();
  }

  if (url.pathname.endsWith('/api/v1')) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/chat/completions`;
    return url.toString();
  }

  if (url.pathname === '/' || url.pathname === '') {
    url.pathname = '/api/v1/chat/completions';
    return url.toString();
  }

  return url.toString();
}

function isLikelyHtmlDocument(rawText: string, contentType?: string | null) {
  return (
    Boolean(contentType && contentType.includes('text/html')) ||
    /^\s*<!doctype html/i.test(rawText) ||
    /^\s*<html/i.test(rawText)
  );
}

function extractHtmlTitle(rawText: string) {
  const match = rawText.match(/<title>(.*?)<\/title>/i);
  return match?.[1]?.trim() || '';
}

function summarizeUpstreamText(rawText: string, maxLength = 160) {
  const cleaned = rawText
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned;
}

function buildHtmlResponseError(endpoint: string, status: number, rawText: string) {
  const title = extractHtmlTitle(rawText);
  const titleSuffix = title ? `（页面标题：${title}）` : '';
  return new DoctorBotChatError(
    `FastGPT 返回了页面而不是 OpenAI 兼容接口结果${titleSuffix}。请检查 API URL，建议填写 /api、/api/v1 或 /api/v1/chat/completions。当前地址：${endpoint}，HTTP ${status}。`,
    502,
    'FASTGPT_HTML_RESPONSE'
  );
}

function buildTimeoutError() {
  return new DoctorBotChatError('医生分身响应超时，请稍后重试。', 504, 'FASTGPT_TIMEOUT');
}

function buildUpstreamHttpError(status: number, payload: FastgptCompletionResponse, rawText: string) {
  const message = payload.error?.message?.trim() || summarizeUpstreamText(rawText);

  if (status === 502 || status === 503 || status === 504) {
    return new DoctorBotChatError(
      message || '医生分身上游服务暂时不可用，请稍后重试。',
      502,
      'FASTGPT_UPSTREAM_UNAVAILABLE'
    );
  }

  return new DoctorBotChatError(
    message || `FastGPT 请求失败（HTTP ${status}）`,
    status >= 400 && status < 500 ? 422 : 502,
    'FASTGPT_HTTP_ERROR'
  );
}

function buildInvalidJsonError() {
  return new DoctorBotChatError(
    'FastGPT 返回了无法识别的响应格式，请检查输出是否为 OpenAI 兼容 JSON。',
    502,
    'FASTGPT_INVALID_JSON'
  );
}

function tryParseJsonObject(rawText: string) {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore parse failure
  }

  return null;
}

function extractJsonObjectFromText(rawText: string) {
  const candidates: string[] = [];
  const trimmed = rawText.trim();

  if (trimmed) {
    candidates.push(trimmed);
  }

  const fencedBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of trimmed.matchAll(fencedBlockRegex)) {
    if (match[1]?.trim()) {
      candidates.push(match[1].trim());
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    const parsed = tryParseJsonObject(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function readLegacyEnvelopeText(envelope: LegacyFastgptEnvelope) {
  const candidates = [envelope.patientReply, envelope.reply, envelope.message, envelope.text];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return '';
}

function normalizeLegacyEnvelopeAction(action: unknown) {
  return typeof action === 'string' ? action.trim().toUpperCase() : '';
}

function slugify(input: string) {
  const trimmed = input.trim().toLowerCase();
  const ascii = trimmed
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return ascii || 'doctor-bot';
}

function buildSuggestedSlug(doctorProfile: {
  id: string;
  realName?: string | null;
  departmentName?: string | null;
}) {
  const base = slugify(
    [doctorProfile.realName, doctorProfile.departmentName, 'assistant']
      .filter(Boolean)
      .join('-')
  );
  return `${base}-${doctorProfile.id.slice(0, 6).toLowerCase()}`;
}

function filterEligibleScales(scales: ScaleDefinition[]) {
  return scales.filter((scale) => scale.interactionMode !== 'web_handoff');
}

async function getDoctorBotScaleRegistry() {
  const eligibleScales = filterEligibleScales(listDoctorVisibleScales());

  return {
    eligibleScales,
    eligibleScaleIds: new Set(eligibleScales.map((scale) => scale.id.toUpperCase())),
  };
}

function serializeEligibleScale(scale: ScaleDefinition, language: LanguageCode) {
  return {
    id: scale.id,
    title: resolveLocalizedText(scale.title, language),
    description: resolveLocalizedText(scale.description, language),
    category: scale.category || null,
    interactionMode: scale.interactionMode || 'manual_only',
    estimatedMinutes: scale.estimatedMinutes || null,
    resultDeliveryMode: scale.resultDeliveryMode || 'immediate',
  };
}

function ensureAllowedScale(scaleId: string, enabledScaleIds: string[]) {
  const normalized = normalizeScaleId(scaleId);
  if (!hasEnabledScale(enabledScaleIds, normalized)) {
    throw new Error(`Scale ${normalized} is not enabled for this doctor bot`);
  }

  const scale = getSerializableScaleById(normalized);
  if (!scale) {
    throw new Error(`Scale ${normalized} was not found`);
  }
  if (scale.interactionMode === 'web_handoff') {
    throw new Error(`Scale ${normalized} is not supported inside the chat assessment sheet`);
  }

  return scale;
}

function readFastgptContent(
  content: string | Array<{ type?: string; text?: string; [key: string]: unknown }> | undefined
) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item: { type?: string; text?: string; [key: string]: unknown }) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && typeof item.text === 'string') {
          return item.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

async function recordDoctorBotTokenUsage(input: {
  doctorBotId: string;
  doctorProfileId: string;
  chatId: string;
  modelName?: string;
  usage?: FastgptCompletionResponse['usage'];
  requestPath: string;
  responseStatus: number;
  metadata?: Record<string, unknown>;
}) {
  const totalTokens = input.usage?.total_tokens || 0;
  if (!totalTokens) {
    return;
  }

  const now = new Date();
  await prisma.tokenUsage.create({
    data: {
      userId: null,
      clientId: 'doctor-bot',
      agentId: `doctor-bot:${input.doctorBotId}`,
      tokensUsed: totalTokens,
      inputTokens: input.usage?.prompt_tokens,
      outputTokens: input.usage?.completion_tokens,
      startedAt: now,
      endedAt: now,
      modelName: input.modelName,
      requestPath: input.requestPath,
      responseStatus: input.responseStatus,
      metadata: {
        doctorBotId: input.doctorBotId,
        doctorProfileId: input.doctorProfileId,
        chatId: input.chatId,
        ...(input.metadata || {}),
      },
    },
  });
}

async function requestFastgptChatCompletion(input: {
  endpoint: string;
  apiKey: string;
  chatId?: string;
  messages: ChatCompletionMessage[];
  enabledScales: ScaleDefinition[];
}) {
  const tools =
    input.enabledScales.length > 0
      ? [
          {
            type: 'function',
            function: {
              name: 'suggest_assessment',
              description:
                'Recommend exactly one structured assessment when a formal scale would help. Only use one of the allowed scale IDs.',
              parameters: {
                type: 'object',
                properties: {
                  scaleId: {
                    type: 'string',
                    enum: input.enabledScales.map((scale) => scale.id),
                    description: input.enabledScales
                      .map((scale) => `${scale.id}: ${resolveLocalizedText(scale.title, 'zh')}`)
                      .join('; '),
                  },
                  reason: {
                    type: 'string',
                    description: 'Why this assessment is recommended.',
                  },
                  cardTitle: {
                    type: 'string',
                  },
                  cardBody: {
                    type: 'string',
                  },
                },
                required: ['scaleId', 'reason'],
              },
            },
          },
        ]
      : undefined;

  let response: Response;
  try {
    response = await fetch(input.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      signal: AbortSignal.timeout(FASTGPT_REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        chatId: input.chatId,
        stream: false,
        detail: false,
        messages: input.messages,
        ...(tools ? { tools, tool_choice: 'auto' } : {}),
      }),
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : '';
    if (errorName === 'AbortError' || errorName === 'TimeoutError') {
      throw buildTimeoutError();
    }

    throw new DoctorBotChatError(
      '医生分身暂时无法连接到 FastGPT，请稍后重试。',
      502,
      'FASTGPT_NETWORK_ERROR'
    );
  }

  const rawText = await response.text();
  const contentType = response.headers.get('content-type');
  const looksLikeHtml = isLikelyHtmlDocument(rawText, contentType);
  let payload: FastgptCompletionResponse = {};
  try {
    payload = rawText ? (JSON.parse(rawText) as FastgptCompletionResponse) : {};
  } catch {
    if (looksLikeHtml) {
      throw buildHtmlResponseError(input.endpoint, response.status, rawText);
    }
    if (!response.ok) {
      throw buildUpstreamHttpError(response.status, payload, rawText);
    }
    throw buildInvalidJsonError();
  }

  if (!response.ok) {
    if (looksLikeHtml) {
      throw buildHtmlResponseError(input.endpoint, response.status, rawText);
    }
    throw buildUpstreamHttpError(response.status, payload, rawText);
  }

  return payload;
}

function buildDefaultReplyText(language: LanguageCode) {
  return language === 'en'
    ? 'I received your message. Please continue describing the situation.'
    : '我收到你的情况了，请继续描述。';
}

function buildAssessmentReply(input: {
  scaleId: string;
  scale: ScaleDefinition;
  language: LanguageCode;
  reason?: string;
  cardTitle?: string;
  cardBody?: string;
  text?: string;
}) {
  const localizedTitle = resolveLocalizedText(input.scale.title, input.language);
  const reason =
    input.reason?.trim() ||
    (input.language === 'en'
      ? `Your doctor recommends ${localizedTitle} to better understand the current situation.`
      : `医生建议你完成 ${localizedTitle}，以便更准确地了解当前情况。`);
  const title =
    input.cardTitle?.trim() ||
    (input.language === 'en' ? `Start ${localizedTitle}` : `开始 ${localizedTitle}`);
  const body =
    input.cardBody?.trim() ||
    (input.language === 'en'
      ? `Your doctor recommends ${localizedTitle} to better understand the situation.`
      : `医生建议你完成 ${localizedTitle}，以便更准确地了解当前情况。`);

  return {
    text: input.text?.trim() || '',
    actionCard: {
      type: 'assessment' as const,
      scaleId: input.scaleId,
      title,
      body,
      reason,
    },
    toolCall: {
      name: 'suggest_assessment',
      args: {
        scaleId: input.scaleId,
        reason,
        cardTitle: title,
        cardBody: body,
      },
    },
  };
}

function normalizeIntentText(input: string) {
  return input.trim().toLowerCase();
}

function hasExplicitAssessmentStartIntent(input: string) {
  const normalized = normalizeIntentText(input);
  const patterns = [
    '想测',
    '想做',
    '想开始',
    '帮我测',
    '帮我做',
    '开始测',
    '开始做',
    '启动',
    '量表',
    '问卷',
    '测一下',
    '做一下',
    'start',
    'begin',
    'take',
    'assessment',
    'questionnaire',
  ];
  return patterns.some((pattern) => normalized.includes(pattern));
}

function pickFallbackScaleFromIntent(input: {
  userText: string;
  enabledScales: ScaleDefinition[];
}) {
  const normalized = normalizeIntentText(input.userText);
  const semanticMatches: Array<{ scaleId: string; keywords: string[] }> = [
    { scaleId: 'TAS_37', keywords: ['tas', '考试焦虑', '考试紧张', '考前焦虑'] },
  ];

  for (const semantic of semanticMatches) {
    if (!semantic.keywords.some((keyword) => normalized.includes(keyword))) {
      continue;
    }

    const matched = input.enabledScales.find((scale) => scale.id.toUpperCase() === semantic.scaleId);
    if (matched) {
      return matched;
    }
  }

  for (const scale of input.enabledScales) {
    const localizedTitle = [
      resolveLocalizedText(scale.title, 'zh'),
      resolveLocalizedText(scale.title, 'en'),
      resolveLocalizedText(scale.description, 'zh'),
      resolveLocalizedText(scale.description, 'en'),
      ...(scale.tags || []),
      scale.id,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    if (localizedTitle.some((token) => token && normalized.includes(token))) {
      return scale;
    }
  }

  return null;
}

function maybeBuildAssessmentFallback(input: {
  userText: string;
  enabledScales: ScaleDefinition[];
  language: LanguageCode;
  existingText?: string;
}) {
  if (!hasExplicitAssessmentStartIntent(input.userText)) {
    return null;
  }

  const matchedScale = pickFallbackScaleFromIntent({
    userText: input.userText,
    enabledScales: input.enabledScales,
  });
  if (!matchedScale) {
    return null;
  }

  const normalizedScaleId = matchedScale.id.trim().toUpperCase();
  const fallbackText =
    input.existingText?.trim() ||
    (input.language === 'en'
      ? `Sure, I can start the ${normalizedScaleId} assessment for you now.`
      : `可以，我们现在就开始 ${normalizedScaleId} 量表。`);
  return buildAssessmentReply({
    scaleId: normalizedScaleId,
    scale: matchedScale,
    language: input.language,
    reason:
      input.language === 'en'
        ? `The visitor explicitly asked to start the ${normalizedScaleId} assessment.`
        : `访客明确表达了想开始 ${normalizedScaleId} 量表。`,
    text: fallbackText,
  });
}

function normalizeFastgptReply(input: {
  payload: FastgptCompletionResponse;
  enabledScaleIds: string[];
  language: LanguageCode;
}) {
  const message = input.payload.choices?.[0]?.message;
  const content = readFastgptContent(message?.content).trim();
  const firstToolCall = message?.tool_calls?.[0];

  if (firstToolCall?.function?.name === 'suggest_assessment') {
    try {
      const args = toolCallArgumentsSchema.parse(
        JSON.parse(firstToolCall.function?.arguments || '{}')
      );
      const normalizedScaleId = normalizeScaleId(args.scaleId);
      if (!hasEnabledScale(input.enabledScaleIds, normalizedScaleId)) {
        return {
          text:
            content ||
            (input.language === 'en'
              ? 'I cannot start that assessment in this workspace.'
              : '这个评估不在当前医生开放的量表范围内。'),
          actionCard: null,
          toolCall: null,
        };
      }

      const scale = getSerializableScaleById(normalizedScaleId);
      if (!scale || scale.interactionMode === 'web_handoff') {
        return {
          text:
            content ||
            (input.language === 'en'
              ? 'That assessment is not available in the in-chat sheet right now.'
              : '这个量表当前不支持在聊天页内直接填写。'),
          actionCard: null,
          toolCall: null,
        };
      }

      return buildAssessmentReply({
        scaleId: normalizedScaleId,
        scale,
        language: input.language,
        reason: args.reason,
        cardTitle: args.cardTitle,
        cardBody: args.cardBody,
        text: content,
      });
    } catch {
      return {
        text:
          content ||
          (input.language === 'en'
            ? 'I could not prepare the suggested assessment card.'
            : '我暂时没能准备好推荐量表卡片。'),
        actionCard: null,
        toolCall: null,
      };
    }
  }

  const compatEnvelope = extractJsonObjectFromText(content) as LegacyFastgptEnvelope | null;
  if (compatEnvelope) {
    const compatText = readLegacyEnvelopeText(compatEnvelope) || buildDefaultReplyText(input.language);
    const compatAction = normalizeLegacyEnvelopeAction(compatEnvelope.action);
    const compatScaleId =
      typeof compatEnvelope.scaleId === 'string' ? compatEnvelope.scaleId.trim().toUpperCase() : '';

    if (!compatAction || compatAction === 'SPEAK_ONLY') {
      return {
        text: compatText,
        actionCard: null,
        toolCall: null,
      };
    }

    if (
      (compatAction === 'START_ASSESSMENT' || compatAction === 'RECOMMEND_ASSESSMENT') &&
      compatScaleId
    ) {
      if (!hasEnabledScale(input.enabledScaleIds, compatScaleId)) {
        return {
          text: compatText,
          actionCard: null,
          toolCall: null,
        };
      }

      const scale = getSerializableScaleById(compatScaleId);
      if (!scale || scale.interactionMode === 'web_handoff') {
        return {
          text: compatText,
          actionCard: null,
          toolCall: null,
        };
      }

      return buildAssessmentReply({
        scaleId: compatScaleId,
        scale,
        language: input.language,
        reason: compatEnvelope.reason,
        cardTitle: compatEnvelope.cardTitle,
        cardBody: compatEnvelope.cardBody,
        text: compatText,
      });
    }

    return {
      text: compatText,
      actionCard: null,
      toolCall: null,
    };
  }

  return {
    text: content,
    actionCard: null,
    toolCall: null,
  };
}

export async function listDoctorBotEligibleScales(language: LanguageCode = 'zh') {
  const { eligibleScales } = await getDoctorBotScaleRegistry();

  return eligibleScales.map((scale) =>
    serializeEligibleScale(scale, language)
  );
}

export async function getDoctorBotConfigForDoctor(input: {
  doctorProfileId: string;
  language?: LanguageCode;
}) {
  const language = input.language || 'zh';
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { id: input.doctorProfileId },
    select: {
      id: true,
      realName: true,
      departmentName: true,
      hospitalName: true,
      title: true,
    },
  });

  if (!doctorProfile) {
    throw new Error('Doctor profile not found');
  }

  const existing = await doctorBotModel().findUnique({
    where: { doctorProfileId: input.doctorProfileId },
  });
  const { eligibleScaleIds } = await getDoctorBotScaleRegistry();
  const normalizedEnabledScaleIds = normalizeScaleIdList(
    Array.isArray(existing?.enabledScaleIds) ? existing.enabledScaleIds : []
  ).filter((scaleId) => eligibleScaleIds.has(scaleId));

  const recentSessions = existing
    ? await doctorBotChatSessionModel().findMany({
        where: { doctorBotId: existing.id },
        orderBy: { lastActiveAt: 'desc' },
        take: 12,
        include: {
          memberProfile: {
            select: {
              id: true,
              nickname: true,
              realName: true,
              contactPhone: true,
            },
          },
        },
      })
    : [];

  const sharePath = existing?.publicSlug ? `/chat/${existing.publicSlug}` : null;

  return {
    config: existing
      ? {
          id: existing.id,
          assistantName: existing.assistantName,
          avatarUrl: existing.avatarUrl || '',
          welcomeMessage: existing.welcomeMessage || '',
          publicSlug: existing.publicSlug,
          fastgptBaseUrl: existing.fastgptBaseUrl,
          fastgptApiKeyConfigured: Boolean(existing.fastgptApiKeyEncrypted),
          enabledScaleIds: normalizedEnabledScaleIds,
          status: existing.status as DoctorBotStatus,
          lastValidatedAt: existing.lastValidatedAt,
          validationStatus: existing.validationStatus || null,
          lastValidationError: existing.lastValidationError || null,
          sharePath,
        }
      : {
          id: null,
          assistantName: `${doctorProfile.realName || '医生'}的小助手`,
          avatarUrl: '',
          welcomeMessage: '',
          publicSlug: buildSuggestedSlug(doctorProfile),
          fastgptBaseUrl: '',
          fastgptApiKeyConfigured: false,
          enabledScaleIds: [],
          status: 'draft' as DoctorBotStatus,
          lastValidatedAt: null,
          validationStatus: null,
          lastValidationError: null,
          sharePath: null,
        },
    doctor: doctorProfile,
    sharePath,
    eligibleScales: await listDoctorBotEligibleScales(language),
    recentSessions: recentSessions.map((session: any) => ({
      id: session.id,
      visitorSessionId: session.visitorSessionId,
      chatId: session.chatId,
      status: session.status,
      messageCount: session.messageCount || 0,
      lastError: session.lastError || null,
      lastActiveAt: session.lastActiveAt,
      member: session.memberProfile
        ? {
            id: session.memberProfile.id,
            nickname: session.memberProfile.nickname,
            realName: session.memberProfile.realName,
            contactPhone: session.memberProfile.contactPhone,
          }
        : null,
    })),
  };
}

export async function testDoctorBotConnection(input: {
  fastgptBaseUrl: string;
  fastgptApiKey: string;
}) {
  const endpoint = normalizeChatCompletionUrl(input.fastgptBaseUrl);
  const payload = await requestFastgptChatCompletion({
    endpoint,
    apiKey: input.fastgptApiKey.trim(),
    messages: [{ role: 'user', content: 'Please reply with OK.' }],
    enabledScales: [],
  });

  const content = readFastgptContent(payload.choices?.[0]?.message?.content).trim();
  return {
    success: true,
    endpoint,
    preview: content || 'OK',
    model: payload.model || null,
  };
}

export async function saveDoctorBotConfig(input: {
  doctorProfileId: string;
  config: DoctorBotConfigInput;
}) {
  const endpoint = normalizeChatCompletionUrl(input.config.fastgptBaseUrl);
  const { eligibleScaleIds } = await getDoctorBotScaleRegistry();
  const enabledScaleIds = normalizeScaleIdList(input.config.enabledScaleIds);

  if (!enabledScaleIds.length) {
    throw new Error('Please enable at least one supported scale');
  }

  const disallowedScaleId = enabledScaleIds.find((scaleId) => !eligibleScaleIds.has(scaleId));
  if (disallowedScaleId) {
    throw new Error(`Scale ${disallowedScaleId} is not supported in the doctor workspace`);
  }

  enabledScaleIds.forEach((scaleId) => ensureAllowedScale(scaleId, enabledScaleIds));

  const existing = await doctorBotModel().findUnique({
    where: { doctorProfileId: input.doctorProfileId },
  });

  let validationStatus = existing?.validationStatus || null;
  let lastValidatedAt = existing?.lastValidatedAt || null;
  let lastValidationError = existing?.lastValidationError || null;

  if (input.config.status === 'published') {
    const apiKey = input.config.fastgptApiKey?.trim() || '';
    const effectiveApiKey =
      apiKey || (existing?.fastgptApiKeyEncrypted ? decryptSecret(existing.fastgptApiKeyEncrypted) : '');
    if (!effectiveApiKey) {
      throw new Error('API Key is required before publishing this doctor bot');
    }

    try {
      await testDoctorBotConnection({
        fastgptBaseUrl: endpoint,
        fastgptApiKey: effectiveApiKey,
      });
      validationStatus = 'valid';
      lastValidatedAt = new Date();
      lastValidationError = null;
    } catch (error) {
      validationStatus = 'invalid';
      lastValidatedAt = new Date();
      lastValidationError = error instanceof Error ? error.message : 'FastGPT test failed';
      throw new Error(lastValidationError);
    }
  }

  const encryptedApiKey = input.config.fastgptApiKey?.trim()
    ? encryptSecret(input.config.fastgptApiKey.trim())
    : existing?.fastgptApiKeyEncrypted;

  if (!encryptedApiKey) {
    throw new Error('FastGPT API Key is required');
  }

  const publicSlug = slugify(input.config.publicSlug);
  const conflictingSlug = await doctorBotModel().findFirst({
    where: {
      publicSlug,
      NOT: existing ? { id: existing.id } : undefined,
    },
  });
  if (conflictingSlug) {
    throw new Error('This public slug is already in use');
  }

  const saved = existing
    ? await doctorBotModel().update({
        where: { doctorProfileId: input.doctorProfileId },
        data: {
          assistantName: input.config.assistantName.trim(),
          avatarUrl: input.config.avatarUrl?.trim() || null,
          welcomeMessage: input.config.welcomeMessage?.trim() || null,
          publicSlug,
          fastgptBaseUrl: endpoint,
          fastgptApiKeyEncrypted: encryptedApiKey,
          enabledScaleIds,
          status: input.config.status,
          validationStatus,
          lastValidatedAt,
          lastValidationError,
        },
      })
    : await doctorBotModel().create({
        data: {
          doctorProfileId: input.doctorProfileId,
          assistantName: input.config.assistantName.trim(),
          avatarUrl: input.config.avatarUrl?.trim() || null,
          welcomeMessage: input.config.welcomeMessage?.trim() || null,
          publicSlug,
          fastgptBaseUrl: endpoint,
          fastgptApiKeyEncrypted: encryptedApiKey,
          enabledScaleIds,
          status: input.config.status,
          validationStatus,
          lastValidatedAt,
          lastValidationError,
        },
      });

  return {
    id: saved.id,
    assistantName: saved.assistantName,
    avatarUrl: saved.avatarUrl || '',
    welcomeMessage: saved.welcomeMessage || '',
    publicSlug: saved.publicSlug,
    fastgptBaseUrl: saved.fastgptBaseUrl,
    fastgptApiKeyConfigured: true,
    enabledScaleIds: Array.isArray(saved.enabledScaleIds) ? saved.enabledScaleIds : [],
    status: saved.status as DoctorBotStatus,
    lastValidatedAt: saved.lastValidatedAt,
    validationStatus: saved.validationStatus || null,
    lastValidationError: saved.lastValidationError || null,
    sharePath: `/chat/${saved.publicSlug}`,
  };
}

export async function getPublishedDoctorBotBySlug(slug: string) {
  const config = await doctorBotModel().findFirst({
    where: {
      publicSlug: slug,
      status: 'published',
    },
    include: {
      doctorProfile: {
        select: {
          id: true,
          realName: true,
          hospitalName: true,
          departmentName: true,
          title: true,
        },
      },
    },
  });

  if (!config) {
    throw new DoctorBotChatError('Doctor assistant not found or not published', 404, 'DOCTOR_BOT_NOT_FOUND');
  }

  const enabledScaleIds = normalizeScaleIdList(
    Array.isArray(config.enabledScaleIds) ? config.enabledScaleIds : []
  );
  const { eligibleScaleIds } = await getDoctorBotScaleRegistry();
  const enabledScales = enabledScaleIds
    .filter((scaleId) => eligibleScaleIds.has(scaleId))
    .map((scaleId) => getSerializableScaleById(scaleId))
    .filter(Boolean)
    .filter((scale) => scale!.interactionMode !== 'web_handoff')
    .map((scale) => scale!);

  return {
    config,
    enabledScaleIds: enabledScales.map((scale) => scale.id),
    enabledScales,
    publicInfo: {
      id: config.id,
      assistantName: config.assistantName,
      avatarUrl: config.avatarUrl || '',
      welcomeMessage: config.welcomeMessage || '',
      publicSlug: config.publicSlug,
      doctor: config.doctorProfile,
    },
  };
}

async function getActiveDoctorBotAssessmentSession(input: {
  visitorSessionId: string;
  memberProfileId?: string | null;
}) {
  const visitorUser = await resolveUserByDeviceId(input.visitorSessionId);
  if (!visitorUser) {
    return null;
  }

  const profileId =
    input.memberProfileId ||
    visitorUser.profiles?.[0]?.id ||
    null;

  return getLatestActiveAssessmentSession({
    userId: visitorUser.id,
    profileId: profileId || undefined,
  });
}

export async function getOrCreateDoctorBotChatSession(input: {
  slug: string;
  visitorSessionId: string;
}) {
  const { config } = await getPublishedDoctorBotBySlug(input.slug);

  const existing = await doctorBotChatSessionModel().findFirst({
    where: {
      doctorBotId: config.id,
      visitorSessionId: input.visitorSessionId,
    },
  });

  if (existing) {
    const updated = await doctorBotChatSessionModel().update({
      where: { id: existing.id },
      data: {
        lastActiveAt: new Date(),
      },
    });
    const activeAssessment = await getActiveDoctorBotAssessmentSession({
      visitorSessionId: input.visitorSessionId,
      memberProfileId: updated.memberProfileId || null,
    });
    return {
      session: updated,
      activeAssessment,
      publicInfo: {
        assistantName: config.assistantName,
        avatarUrl: config.avatarUrl || '',
        welcomeMessage: config.welcomeMessage || '',
        publicSlug: config.publicSlug,
        doctor: config.doctorProfile,
      },
    };
  }

  const created = await doctorBotChatSessionModel().create({
    data: {
      doctorBotId: config.id,
      visitorSessionId: input.visitorSessionId,
      chatId: `${config.id}:${input.visitorSessionId}`,
      deviceId: input.visitorSessionId,
      status: 'active',
      lastActiveAt: new Date(),
    },
  });
  const activeAssessment = await getActiveDoctorBotAssessmentSession({
    visitorSessionId: input.visitorSessionId,
    memberProfileId: created.memberProfileId || null,
  });

  return {
    session: created,
    activeAssessment,
    publicInfo: {
      assistantName: config.assistantName,
      avatarUrl: config.avatarUrl || '',
      welcomeMessage: config.welcomeMessage || '',
      publicSlug: config.publicSlug,
      doctor: config.doctorProfile,
    },
  };
}

export async function sendDoctorBotChatMessage(input: {
  slug: string;
  visitorSessionId: string;
  content: string;
  language?: LanguageCode;
}) {
  const language = input.language || 'zh';
  const { config, enabledScaleIds, enabledScales } = await getPublishedDoctorBotBySlug(input.slug);
  const { session, activeAssessment } = await getOrCreateDoctorBotChatSession({
    slug: input.slug,
    visitorSessionId: input.visitorSessionId,
  });

  if (activeAssessment && !activeAssessment.result && activeAssessment.status !== 'COMPLETED') {
    throw new DoctorBotChatError(
      language === 'en'
        ? 'An assessment is already in progress. Please continue the current assessment first.'
        : '当前已有进行中的量表，请先继续完成当前量表。',
      409,
      'ASSESSMENT_IN_PROGRESS',
      { session: activeAssessment }
    );
  }

  const preflightAssessmentReply = maybeBuildAssessmentFallback({
    userText: input.content.trim(),
    enabledScales,
    language,
  });

  if (preflightAssessmentReply) {
    await doctorBotChatSessionModel().update({
      where: { id: session.id },
      data: {
        messageCount: { increment: 2 },
        lastError: null,
        lastActiveAt: new Date(),
      },
    });

    return {
      session: {
        id: session.id,
        visitorSessionId: session.visitorSessionId,
        chatId: session.chatId,
      },
      reply: preflightAssessmentReply,
    };
  }

  try {
    const payload = await requestFastgptChatCompletion({
      endpoint: config.fastgptBaseUrl,
      apiKey: decryptSecret(config.fastgptApiKeyEncrypted),
      chatId: session.chatId,
      messages: [{ role: 'user', content: input.content.trim() }],
      enabledScales,
    });

    const normalized = normalizeFastgptReply({
      payload,
      enabledScaleIds,
      language,
    });
    const finalReply =
      normalized.actionCard
        ? normalized
        : maybeBuildAssessmentFallback({
            userText: input.content.trim(),
            enabledScales,
            language,
            existingText: normalized.text,
          }) || normalized;

    await doctorBotChatSessionModel().update({
      where: { id: session.id },
      data: {
        messageCount: { increment: 2 },
        lastError: null,
        lastActiveAt: new Date(),
      },
    });

    await recordDoctorBotTokenUsage({
      doctorBotId: config.id,
      doctorProfileId: config.doctorProfileId,
      chatId: session.chatId,
      modelName: payload.model,
      usage: payload.usage,
      requestPath: config.fastgptBaseUrl,
      responseStatus: 200,
      metadata: {
        hasToolCall: Boolean(finalReply.toolCall),
        toolName: finalReply.toolCall?.name || null,
        hasActionCard: Boolean(finalReply.actionCard),
        slug: config.publicSlug,
      },
    });

    return {
      session: {
        id: session.id,
        visitorSessionId: session.visitorSessionId,
        chatId: session.chatId,
      },
      reply: finalReply,
    };
  } catch (error) {
    const resolvedError =
      error instanceof DoctorBotChatError
        ? error
        : new DoctorBotChatError(
            error instanceof Error ? error.message : 'FastGPT request failed',
            502,
            'FASTGPT_REQUEST_FAILED'
          );
    await doctorBotChatSessionModel().update({
      where: { id: session.id },
      data: {
        lastError: resolvedError.message,
        lastActiveAt: new Date(),
      },
    });
    throw resolvedError;
  }
}

export async function startDoctorBotAssessment(input: {
  slug: string;
  visitorSessionId: string;
  scaleId: string;
  language?: LanguageCode;
}) {
  const language = input.language || 'zh';
  const { config, enabledScaleIds } = await getPublishedDoctorBotBySlug(input.slug);
  const scale = ensureAllowedScale(input.scaleId, enabledScaleIds);

  const assessmentSession = await createAssessmentSessionForDevice({
    deviceId: input.visitorSessionId,
    scaleId: scale.id,
    language,
    memberSnapshot: {
      nickname: language === 'en' ? 'Visitor' : '访客',
      gender: 'unknown',
      relation: 'SELF',
      languagePreference: language === 'en' ? 'EN' : 'ZH',
    },
  });

  const visitorUser = await resolveUserByDeviceId(input.visitorSessionId);
  const memberId = visitorUser?.profiles?.[0]?.id || null;

  await doctorBotChatSessionModel().updateMany({
    where: {
      doctorBotId: config.id,
      visitorSessionId: input.visitorSessionId,
    },
    data: {
      memberProfileId: memberId,
      lastActiveAt: new Date(),
    },
  });

  return {
    session: assessmentSession,
    scale: serializeEligibleScale(scale, language),
  };
}

export async function submitDoctorBotAssessmentAnswer(input: {
  slug: string;
  visitorSessionId: string;
  sessionId: string;
  questionId: number;
  score: number;
}) {
  const { config, enabledScaleIds } = await getPublishedDoctorBotBySlug(input.slug);
  const existing = await getAssessmentSessionForDevice({
    deviceId: input.visitorSessionId,
    sessionId: input.sessionId,
  });

  ensureAllowedScale(existing.scaleId, enabledScaleIds);

  const updated = await submitAssessmentAnswerForDevice({
    deviceId: input.visitorSessionId,
    sessionId: input.sessionId,
    questionId: input.questionId,
    score: input.score,
  });

  await doctorBotChatSessionModel().updateMany({
    where: {
      doctorBotId: config.id,
      visitorSessionId: input.visitorSessionId,
    },
    data: {
      lastActiveAt: new Date(),
      lastError: null,
    },
  });

  return updated;
}

export async function sendDoctorBotAssessmentResultMessage(input: {
  slug: string;
  visitorSessionId: string;
  result: {
    scaleId: string;
    totalScore: number;
    conclusion: string;
    details?: {
      description?: string;
      [key: string]: unknown;
    };
  };
  language?: LanguageCode;
}) {
  const language = input.language || 'zh';
  const { config } = await getPublishedDoctorBotBySlug(input.slug);
  const scale = getSerializableScaleById(input.result.scaleId);
  const session = await getOrCreateDoctorBotChatSession({
    slug: input.slug,
    visitorSessionId: input.visitorSessionId,
  });

  const fallbackAdvice =
    language === 'en'
      ? `The ${input.result.scaleId} assessment is complete. The current conclusion is: ${input.result.conclusion}.`
      : `${input.result.scaleId} 量表已经完成，当前结论是：${input.result.conclusion}。`;

  try {
    const analyzed = await analyzeCompletedAssessmentResult({
      result: {
        scaleId: input.result.scaleId,
        scaleName: scale ? resolveLocalizedText(scale.title, language) : input.result.scaleId,
        totalScore: input.result.totalScore,
        conclusion: input.result.conclusion,
        details: input.result.details,
      },
      language,
      profileId: session.session.memberProfileId || undefined,
      deviceId: input.visitorSessionId,
      endpoint: config.fastgptBaseUrl,
      apiKey: decryptSecret(config.fastgptApiKeyEncrypted),
      provider: 'FastGPT',
      timeoutMs: FASTGPT_REQUEST_TIMEOUT_MS,
      mode: 'doctor_bot',
      assistantName: config.assistantName,
    });

    await doctorBotChatSessionModel().update({
      where: { id: session.session.id },
      data: {
        messageCount: { increment: 1 },
        lastError: null,
        lastActiveAt: new Date(),
      },
    });

    if (analyzed.usage?.total_tokens) {
      await recordDoctorBotTokenUsage({
        doctorBotId: config.id,
        doctorProfileId: config.doctorProfileId,
        chatId: session.session.chatId,
        modelName: analyzed.model || undefined,
        usage: analyzed.usage,
        requestPath: config.fastgptBaseUrl,
        responseStatus: 200,
        metadata: {
          analysisType: 'assessment_result',
          scaleId: input.result.scaleId,
          slug: config.publicSlug,
        },
      });
    }

    return {
      session: {
        id: session.session.id,
        visitorSessionId: session.session.visitorSessionId,
        chatId: session.session.chatId,
      },
      reply: {
        text: analyzed.advice,
        actionCard: null,
        toolCall: null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : fallbackAdvice;
    await doctorBotChatSessionModel().update({
      where: { id: session.session.id },
      data: {
        messageCount: { increment: 1 },
        lastError: message,
        lastActiveAt: new Date(),
      },
    });

    return {
      session: {
        id: session.session.id,
        visitorSessionId: session.session.visitorSessionId,
        chatId: session.session.chatId,
      },
      reply: {
        text: fallbackAdvice,
        actionCard: null,
        toolCall: null,
      },
    };
  }
}

export async function getMemberAgentStatus(input: {
  userId: string;
  memberId: string;
}) {
  const assignment = await getActiveDoctorAssignment(input.memberId);

  if (!assignment || assignment.memberProfile.userId !== input.userId) {
    return {
      hasBoundDoctor: false,
      doctor: null,
      doctorBotStatus: 'missing' as const,
      doctorBotSlug: null,
      doctorBot: null,
      agentMode: 'generic_self_service' as const,
    };
  }

  const config = await doctorBotModel().findUnique({
    where: { doctorProfileId: assignment.doctorProfile.id },
    select: {
      id: true,
      assistantName: true,
      avatarUrl: true,
      publicSlug: true,
      status: true,
    },
  });

  const botStatus =
    config?.status === 'published'
      ? 'published'
      : config?.status === 'disabled'
        ? 'disabled'
        : 'missing';

  return {
    hasBoundDoctor: true,
    doctor: {
      id: assignment.doctorProfile.id,
      realName: assignment.doctorProfile.realName,
      hospitalName: assignment.doctorProfile.hospitalName,
      departmentName: assignment.doctorProfile.departmentName,
      title: assignment.doctorProfile.title,
    },
    doctorBotStatus: botStatus,
    doctorBotSlug: botStatus === 'published' ? config?.publicSlug || null : null,
    doctorBot:
      config && botStatus === 'published'
        ? {
            id: config.id,
            assistantName: config.assistantName,
            avatarUrl: config.avatarUrl || '',
            publicSlug: config.publicSlug,
          }
        : null,
    agentMode:
      botStatus === 'published' ? ('doctor_bot' as const) : ('generic_self_service' as const),
  };
}
