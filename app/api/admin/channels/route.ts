import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { ADMIN_ROLE } from '@/lib/auth/admin-role';
import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import {
  ADMIN_CHANNEL_ROLLOUT_STAGE,
  listAdminChannels,
  saveAdminChannels,
} from '@/lib/services/admin-channels';

const channelPayloadSchema = z.object({
  channels: z.array(
    z.object({
      key: z.enum([
        'app_web',
        'agent_web',
        'doctor_workspace',
        'ai_toy',
        'wechat_h5',
        'feishu_bot',
        'wecom_bot',
        'dingtalk_bot',
        'public_share',
      ]),
      enabled: z.boolean(),
      rolloutStage: z.enum([
        ADMIN_CHANNEL_ROLLOUT_STAGE.ACTIVE,
        ADMIN_CHANNEL_ROLLOUT_STAGE.PILOT,
        ADMIN_CHANNEL_ROLLOUT_STAGE.PLANNED,
      ]),
      notes: z.string().max(400).optional().default(''),
    })
  ),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.OPS],
    });

    const result = await listAdminChannels();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json({ error: '获取渠道接入配置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.OPS],
    });

    const payload = channelPayloadSchema.parse(await request.json());
    const result = await saveAdminChannels(payload.channels);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '渠道接入配置格式不合法' }, { status: 400 });
    }

    return NextResponse.json({ error: '保存渠道接入配置失败' }, { status: 500 });
  }
}
