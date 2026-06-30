import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_ROLE } from '@/lib/auth/admin-role';
import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import {
  getAgentWorkspaceConfig,
  saveAgentWorkspaceConfig,
} from '@/lib/agent/config';

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request, { roles: [ADMIN_ROLE.SUPER_ADMIN] });
    const config = await getAgentWorkspaceConfig();
    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load agent config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRequest(request, { roles: [ADMIN_ROLE.SUPER_ADMIN] });
    const body = await request.json().catch(() => ({}));
    const config = body?.config ?? body;

    const savedConfig = await saveAgentWorkspaceConfig(config);
    return NextResponse.json({ success: true, config: savedConfig });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save agent config' },
      { status: 500 }
    );
  }
}
