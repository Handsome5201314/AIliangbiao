import { prisma } from '@/lib/db/prisma';
import { getAgentWorkspaceConfig } from '@/lib/agent/config';
import { PROVIDER_CONFIGS, type ApiServiceType } from '@/lib/services/apiKeyProviderConfig';
import { decryptBusinessSecret } from '@/lib/utils/businessSecrets';

export async function getAgentModelConfig(serviceType: ApiServiceType) {
  const config = await getAgentWorkspaceConfig();
  const provider =
    serviceType === 'speech'
      ? config.models.speechProvider
      : config.models.textProvider;
  const model =
    serviceType === 'speech'
      ? config.models.speechModel
      : config.models.textModel;

  const providerConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.custom;
  const endpoint =
    serviceType === 'speech' ? providerConfig.speechEndpoint : providerConfig.textEndpoint;

  return {
    provider,
    model,
    endpoint,
    allowFallbackToSystemDefault: Boolean(config.models.allowFallbackToSystemDefault),
  };
}

export async function resolveAgentApiKeyByService(serviceType: ApiServiceType) {
  const preferred = await getAgentModelConfig(serviceType);

  const preferredKey = await prisma.apiKey.findFirst({
    where: {
      purpose: 'AI',
      provider: preferred.provider,
      serviceType,
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
      throw new Error(`Agent ${serviceType} API 密钥需要重新录入`);
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
    throw new Error(`Agent 未找到可用的 ${serviceType} 模型密钥配置`);
  }

  return null;
}
