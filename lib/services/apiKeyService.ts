import { prisma } from '@/lib/db/prisma';
import {
  getProviderEndpoint,
  getProviderModel,
  normalizeApiServiceType,
  PROVIDER_CONFIGS,
  type ApiServiceType,
  type LegacyApiServiceType,
} from '@/lib/services/apiKeyProviderConfig';
import { decryptBusinessSecret } from '@/lib/utils/businessSecrets';

export { PROVIDER_CONFIGS, type ApiServiceType } from '@/lib/services/apiKeyProviderConfig';

export async function getSystemApiKey() {
  return getSystemApiKeyByService('text');
}

export async function getSystemApiKeyByService(serviceType: LegacyApiServiceType): Promise<{
  key: string;
  provider: string;
  endpoint: string;
  model: string;
}> {
  const normalizedServiceType = normalizeApiServiceType(serviceType);
  const serviceTypeFilter =
    normalizedServiceType === 'asr'
      ? { in: ['asr', 'speech'] }
      : normalizedServiceType;

  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        purpose: 'AI',
        isActive: true,
        userId: null,
        serviceType: serviceTypeFilter,
        NOT: { provider: 'mcp' },
      },
      select: {
        id: true,
        provider: true,
        secretCiphertext: true,
        usageCount: true,
        customEndpoint: true,
        customModel: true,
        connectionStatus: true,
      },
      orderBy: [
        { connectionStatus: 'asc' },
        { usageCount: 'asc' },
      ],
    });

    if (apiKeys.length === 0) {
      throw new Error(`系统暂未配置 ${normalizedServiceType} 类型的 API 密钥，请联系管理员`);
    }

    const onlineKey = apiKeys.find((item) => item.connectionStatus === 'online');
    const selectedKey = onlineKey || apiKeys[0];
    const providerConfig = PROVIDER_CONFIGS[selectedKey.provider] || PROVIDER_CONFIGS.custom;
    const endpoint =
      selectedKey.customEndpoint ||
      getProviderEndpoint(providerConfig, normalizedServiceType);
    const model =
      selectedKey.customModel ||
      getProviderModel(providerConfig, normalizedServiceType);

    if (!endpoint) {
      throw new Error(`服务商 ${selectedKey.provider} 的接口地址未配置`);
    }

    if (!selectedKey.secretCiphertext) {
      throw new Error(`系统 ${normalizedServiceType} API 密钥需要重新录入`);
    }

    await prisma.apiKey.update({
      where: { id: selectedKey.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return {
      key: decryptBusinessSecret(selectedKey.secretCiphertext),
      provider: selectedKey.provider,
      endpoint,
      model,
    };
  } catch (error) {
    console.error(`Failed to get system API key for ${normalizedServiceType}:`, error);
    throw error;
  }
}
