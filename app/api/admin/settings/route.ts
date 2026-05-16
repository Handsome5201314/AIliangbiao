import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import {
  AGENT_WORKSPACE_CONFIG_KEY,
  getDefaultAgentWorkspaceConfigJson,
  saveAgentWorkspaceConfig,
} from '@/lib/agent/config';

function getSettingDescription(key: string): string {
  const descriptions: Record<string, string> = {
    siteName: '站点名称',
    siteDescription: '站点描述',
    defaultDailyLimit: '游客每日默认限额',
    enableGuestMode: '是否启用游客模式',
    enableAPIKeyManagement: '是否启用 API Key 管理',
    requireLogin: '是否要求登录',
    enableNotifications: '是否启用通知',
    enableDataExport: '是否启用数据导出',
    [AGENT_WORKSPACE_CONFIG_KEY]: 'Agent workspace prompts, tool rules, UI guidance, and legacy feature notes',
  };

  return descriptions[key] || '';
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);

    const configs = await prisma.systemConfig.findMany();
    const settings: Record<string, string> = {};

    configs.forEach((config) => {
      settings[config.configKey] = config.configValue;
    });

    if (!settings[AGENT_WORKSPACE_CONFIG_KEY]) {
      settings[AGENT_WORKSPACE_CONFIG_KEY] = await getDefaultAgentWorkspaceConfigJson();
    }

    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const body = await request.json();
    const { settings } = body as { settings?: Record<string, unknown> };

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 });
    }

    const entries = Object.entries(settings);

    for (const [key, value] of entries) {
      if (key === AGENT_WORKSPACE_CONFIG_KEY) {
        const raw = typeof value === 'string' ? value : JSON.stringify(value);
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return NextResponse.json({ error: 'Agent 工作台配置 JSON 无法解析' }, { status: 400 });
        }
        await saveAgentWorkspaceConfig(parsed);
        continue;
      }

      await prisma.systemConfig.upsert({
        where: { configKey: key },
        update: {
          configValue: String(value),
          updatedAt: new Date(),
        },
        create: {
          configKey: key,
          configValue: String(value),
          description: getSettingDescription(key),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: '设置已保存',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json({ error: '保存设置失败' }, { status: 500 });
  }
}
