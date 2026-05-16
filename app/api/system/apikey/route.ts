import { NextRequest, NextResponse } from 'next/server';

import { ApiServiceType, getSystemApiKeyByService, PROVIDER_CONFIGS } from '@/lib/services/apiKeyService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceType = (searchParams.get('serviceType') || 'text') as ApiServiceType;

    if (serviceType !== 'text' && serviceType !== 'speech') {
      return NextResponse.json(
        {
          success: false,
          error: '无效的 serviceType 参数',
        },
        { status: 400 }
      );
    }

    const selectedKey = await getSystemApiKeyByService(serviceType);
    const providerConfig = PROVIDER_CONFIGS[selectedKey.provider] || PROVIDER_CONFIGS.custom;

    return NextResponse.json({
      success: true,
      provider: selectedKey.provider,
      apiKey: selectedKey.key,
      endpoint: selectedKey.endpoint,
      model: selectedKey.model,
      providerName: providerConfig.name,
      serviceType,
    });
  } catch (error) {
    console.error('Failed to fetch system API key:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取 API 密钥失败',
      },
      { status: 500 }
    );
  }
}
