import type { AgentChannel } from '@/lib/assessment-skill/auth';
import { prisma } from '@/lib/db/prisma';

export const ADMIN_CHANNELS_CONFIG_KEY = 'adminChannelRegistry';

export const ADMIN_CHANNEL_ROLLOUT_STAGE = {
  ACTIVE: 'ACTIVE',
  PILOT: 'PILOT',
  PLANNED: 'PLANNED',
} as const;

export type AdminChannelRolloutStage =
  (typeof ADMIN_CHANNEL_ROLLOUT_STAGE)[keyof typeof ADMIN_CHANNEL_ROLLOUT_STAGE];

export type AdminChannelEntry = {
  key: AgentChannel;
  label: string;
  description: string;
  surface: 'WEB' | 'DESKTOP' | 'BOT' | 'DEVICE';
  authMode: string;
  sessionPath: string;
  webhookPath: string | null;
  enabled: boolean;
  rolloutStage: AdminChannelRolloutStage;
  notes: string;
};

type StoredAdminChannelEntry = Pick<AdminChannelEntry, 'key' | 'enabled' | 'rolloutStage' | 'notes'>;

type ChannelCatalogEntry = Omit<AdminChannelEntry, 'enabled' | 'rolloutStage' | 'notes'> & {
  defaultEnabled: boolean;
  defaultRolloutStage: AdminChannelRolloutStage;
};

const CHANNEL_CATALOG: ChannelCatalogEntry[] = [
  {
    key: 'app_web',
    label: 'App Web',
    description: '站内主应用入口，沿用应用会话与成员上下文签发链路。',
    surface: 'WEB',
    authMode: '应用会话签名',
    sessionPath: '/api/agent/session',
    webhookPath: null,
    defaultEnabled: true,
    defaultRolloutStage: ADMIN_CHANNEL_ROLLOUT_STAGE.ACTIVE,
  },
  {
    key: 'agent_web',
    label: 'Agent H5',
    description: '患者 / 家长通过 H5 打开的自助评估入口。',
    surface: 'WEB',
    authMode: '设备签名 + 平台 token',
    sessionPath: '/api/agent/session',
    webhookPath: null,
    defaultEnabled: true,
    defaultRolloutStage: ADMIN_CHANNEL_ROLLOUT_STAGE.ACTIVE,
  },
  {
    key: 'wechat_h5',
    label: '微信内 H5',
    description: '微信内打开的移动端入口，要求兼容安全区与浏览器限制。',
    surface: 'WEB',
    authMode: '平台签发 + 微信内浏览器约束',
    sessionPath: '/api/agent/session',
    webhookPath: null,
    defaultEnabled: true,
    defaultRolloutStage: ADMIN_CHANNEL_ROLLOUT_STAGE.PILOT,
  },
  {
    key: 'doctor_workspace',
    label: '医生工作台',
    description: 'PC 医生工作台入口，带医生组织与 Hermes profile 解析。',
    surface: 'DESKTOP',
    authMode: '管理员 / 医生登录态',
    sessionPath: '/api/agent/session',
    webhookPath: null,
    defaultEnabled: true,
    defaultRolloutStage: ADMIN_CHANNEL_ROLLOUT_STAGE.ACTIVE,
  },
  {
    key: 'ai_toy',
    label: 'AI 玩具 / 小智',
    description: '设备侧入口，复用 deviceId + memberId 的平台签发链路。',
    surface: 'DEVICE',
    authMode: '合作方 token + deviceId 绑定',
    sessionPath: '/api/agent/session',
    webhookPath: '/api/platform/v1/channels/ai_toy/webhook',
    defaultEnabled: true,
    defaultRolloutStage: ADMIN_CHANNEL_ROLLOUT_STAGE.PILOT,
  },
  {
    key: 'feishu_bot',
    label: '飞书机器人',
    description: '飞书消息先进入平台网关，再转成统一 agent 会话。',
    surface: 'BOT',
    authMode: '渠道签名校验',
    sessionPath: '/api/agent/session',
    webhookPath: '/api/platform/v1/channels/feishu_bot/webhook',
    defaultEnabled: false,
    defaultRolloutStage: ADMIN_CHANNEL_ROLLOUT_STAGE.PLANNED,
  },
  {
    key: 'wecom_bot',
    label: '企微机器人',
    description: '企业微信回调经平台统一验签、路由与审计。',
    surface: 'BOT',
    authMode: '渠道签名校验',
    sessionPath: '/api/agent/session',
    webhookPath: '/api/platform/v1/channels/wecom_bot/webhook',
    defaultEnabled: false,
    defaultRolloutStage: ADMIN_CHANNEL_ROLLOUT_STAGE.PLANNED,
  },
  {
    key: 'dingtalk_bot',
    label: '钉钉机器人',
    description: '钉钉消息走平台网关，统一处理租户解析与审计。',
    surface: 'BOT',
    authMode: '渠道签名校验',
    sessionPath: '/api/agent/session',
    webhookPath: '/api/platform/v1/channels/dingtalk_bot/webhook',
    defaultEnabled: false,
    defaultRolloutStage: ADMIN_CHANNEL_ROLLOUT_STAGE.PLANNED,
  },
  {
    key: 'public_share',
    label: '公开分享',
    description: '医生公开分享出来的患者访问入口。',
    surface: 'WEB',
    authMode: '公开 slug + 平台会话',
    sessionPath: '/api/agent/session',
    webhookPath: null,
    defaultEnabled: true,
    defaultRolloutStage: ADMIN_CHANNEL_ROLLOUT_STAGE.PILOT,
  },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseStoredChannels(raw: string | null | undefined) {
  if (!raw) {
    return new Map<AgentChannel, StoredAdminChannelEntry>();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Map<AgentChannel, StoredAdminChannelEntry>();
    }

    const entries = parsed
      .filter((item): item is Record<string, unknown> => isPlainObject(item))
      .map((item) => ({
        key: String(item.key || '') as AgentChannel,
        enabled: item.enabled !== false,
        rolloutStage:
          item.rolloutStage === ADMIN_CHANNEL_ROLLOUT_STAGE.ACTIVE ||
          item.rolloutStage === ADMIN_CHANNEL_ROLLOUT_STAGE.PILOT ||
          item.rolloutStage === ADMIN_CHANNEL_ROLLOUT_STAGE.PLANNED
            ? item.rolloutStage
            : ADMIN_CHANNEL_ROLLOUT_STAGE.PLANNED,
        notes: typeof item.notes === 'string' ? item.notes : '',
      }))
      .filter((item) => CHANNEL_CATALOG.some((channel) => channel.key === item.key));

    return new Map(entries.map((item) => [item.key, item]));
  } catch {
    return new Map<AgentChannel, StoredAdminChannelEntry>();
  }
}

export async function listAdminChannels() {
  const stored = await prisma.systemConfig.findUnique({
    where: { configKey: ADMIN_CHANNELS_CONFIG_KEY },
    select: { configValue: true },
  });
  const storedMap = parseStoredChannels(stored?.configValue);

  const channels: AdminChannelEntry[] = CHANNEL_CATALOG.map((channel) => {
    const override = storedMap.get(channel.key);

    return {
      key: channel.key,
      label: channel.label,
      description: channel.description,
      surface: channel.surface,
      authMode: channel.authMode,
      sessionPath: channel.sessionPath,
      webhookPath: channel.webhookPath,
      enabled: override?.enabled ?? channel.defaultEnabled,
      rolloutStage: override?.rolloutStage ?? channel.defaultRolloutStage,
      notes: override?.notes ?? '',
    };
  });

  return { channels };
}

export async function saveAdminChannels(channels: StoredAdminChannelEntry[]) {
  const nextChannels = CHANNEL_CATALOG.map((channel) => {
    const override = channels.find((item) => item.key === channel.key);

    return {
      key: channel.key,
      enabled: override?.enabled ?? channel.defaultEnabled,
      rolloutStage: override?.rolloutStage ?? channel.defaultRolloutStage,
      notes: override?.notes?.trim() || '',
    };
  });

  await prisma.systemConfig.upsert({
    where: { configKey: ADMIN_CHANNELS_CONFIG_KEY },
    update: {
      configValue: JSON.stringify(nextChannels),
      updatedAt: new Date(),
    },
    create: {
      configKey: ADMIN_CHANNELS_CONFIG_KEY,
      configValue: JSON.stringify(nextChannels),
      description: '平台统一渠道入口启用状态、发布阶段与运维备注',
    },
  });

  return listAdminChannels();
}
