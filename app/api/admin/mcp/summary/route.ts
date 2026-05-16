import { NextRequest, NextResponse } from 'next/server';

import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { getAdminMcpSummary } from '@/lib/services/admin-mcp';

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const summary = await getAdminMcpSummary();
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load MCP summary' },
      { status: 500 }
    );
  }
}
