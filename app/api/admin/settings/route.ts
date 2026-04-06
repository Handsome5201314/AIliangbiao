/**
 * 系统设置 API
 * GET: 获取所有设置
 * POST: 保存设置
 */

import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';

// 获取所有系统设置
export async function GET() {
  try {
    const configs = await prisma.systemConfig.findMany();
    
    // 转换为对象格式
    const settings: Record<string, string> = {};
    configs.forEach(config => {
      settings[config.configKey] = config.configValue;
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[Get Settings Error]:', error);
    return NextResponse.json(
      { error: '获取设置失败' },
      { status: 500 }
    );
  }
}

// 保存系统设置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;

    // 批量更新或创建配置
    const updates = Object.entries(settings).map(([key, value]) =>
      prisma.systemConfig.upsert({
        where: { configKey: key },
        update: { 
          configValue: String(value),
          updatedAt: new Date()
        },
        create: {
          configKey: key,
          configValue: String(value),
          description: getSettingDescription(key)
        }
      })
    );

    await Promise.all(updates);

    return NextResponse.json({ 
      success: true,
      message: '设置已保存'
    });
  } catch (error) {
    console.error('[Save Settings Error]:', error);
    return NextResponse.json(
      { error: '保存设置失败' },
      { status: 500 }
    );
  }
}

// 设置项描述
function getSettingDescription(key: string): string {
  const descriptions: Record<string, string> = {
    siteName: '站点名称',
    siteDescription: '站点描述',
    defaultDailyLimit: '游客每日默认限额',
    enableGuestMode: '是否启用游客模式',
    enableAPIKeyManagement: '是否启用API密钥管理',
    requireLogin: '是否要求登录',
    enableNotifications: '是否启用通知',
    enableDataExport: '是否启用数据导出'
  };
  return descriptions[key] || '';
}
