import { NextResponse } from 'next/server';

import { getAgentWorkspaceConfig } from '@/lib/agent/config';

export async function GET() {
  try {
    const config = await getAgentWorkspaceConfig();
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load agent config' },
      { status: 500 }
    );
  }
}
