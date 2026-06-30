import { prisma } from '@/lib/db/prisma';
import { getAgentWorkspaceConfig } from '@/lib/agent/config';
import {
  getProviderEndpoint,
  normalizeApiServiceType,
  PROVIDER_CONFIGS,
  type LegacyApiServiceType,
} from '@/lib/services/apiKeyProviderConfig';
import { decryptBusinessSecret } from '@/lib/utils/businessSecrets';

export async function getAgentModelConfig(serviceType: LegacyApiServiceType) {
  const normalizedServiceType = normalizeApiServiceType(serviceType);
  const config = await getAgentWorkspaceConfig();
  const provider =
    normalizedServiceType === 'asr'
      ? config.models.asrProvider
      : normalizedServiceType === 'tts'
        ? config.models.ttsProvider
        : config.models.textProvider;
  const model =
    normalizedServiceType === 'asr'
      ? config.models.asrModel
      : normalizedServiceType === 'tts'
        ? config.models.ttsModel
        : config.models.textModel;

  const providerConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.custom;
  const endpoint = getProviderEndpoint(providerConfig, normalizedServiceType);

  return {
    provider,
    model,
    endpoint,
    allowFallbackToSystemDefault: Boolean(config.models.allowFallbackToSystemDefault),
  };
}

export async function resolveAgentApiKeyByService(serviceType: LegacyApiServiceType) {
  const normalizedServiceType = normalizeApiServiceType(serviceType);
  const preferred = await getAgentModelConfig(serviceType);
  const serviceTypeFilter =
    normalizedServiceType === 'asr'
      ? { in: ['asr', 'speech'] }
      : normalizedServiceType;

  const preferredKey = await prisma.apiKey.findFirst({
    where: {
      purpose: 'AI',
      provider: preferred.provider,
      serviceType: serviceTypeFilter,
      isActive: true,
      userId: null,
      NOT: { provider: 'mcp' },
    },
    orderBy: [
      { connectionStatus: 'asc' },
      { usageCount: 'asc' },
    ],
  });

  if (preferredKey) {
    if (!preferredKey.secretCiphertext) {
      throw new Error(`Agent ${normalizedServiceType} API 密钥需要重新录入`);
    }

    const endpoint =
      preferredKey.customEndpoint ||
      preferred.endpoint ||
      '';
    const model = preferred.model || preferredKey.customModel || '';

    await prisma.apiKey.update({
      where: { id: preferredKey.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return {
      key: decryptBusinessSecret(preferredKey.secretCiphertext),
      provider: preferredKey.provider,
      endpoint,
      model,
      source: 'agent_preferred' as const,
    };
  }

  if (!preferred.allowFallbackToSystemDefault) {
    throw new Error(`Agent 未找到可用的 ${normalizedServiceType} 模型密钥配置`);
  }

  return null;
}
