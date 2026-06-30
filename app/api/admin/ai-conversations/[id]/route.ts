import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_ROLE } from '@/lib/auth/admin-role';
import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/db/prisma';

type AiConversationDb = {
  aiConversationSession: {
    findUnique(args: Record<string, unknown>): Promise<unknown | null>;
  };
  aiConversationEvent: {
    findMany(args: Record<string, unknown>): Promise<unknown[]>;
  };
};

function db(): AiConversationDb {
  return prisma as unknown as AiConversationDb;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRequest(request, { roles: [ADMIN_ROLE.SUPER_ADMIN] });
    const { id } = await params;

    const session = await db().aiConversationSession.findUnique({
      where: { id },
    });
    if (!session) {
      return NextResponse.json({ error: 'AI conversation not found' }, { status: 404 });
    }

    const events = await db().aiConversationEvent.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      session,
      events,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load AI conversation detail' },
      { status: 500 }
    );
  }
}
