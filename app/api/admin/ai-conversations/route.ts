import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_ROLE } from '@/lib/auth/admin-role';
import { createAdminUnauthorizedResponse, requireAdminRequest } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/db/prisma';

type AiConversationDb = {
  aiConversationSession: {
    findMany(args: Record<string, unknown>): Promise<unknown[]>;
    count(args: Record<string, unknown>): Promise<number>;
  };
};

function db(): AiConversationDb {
  return prisma as unknown as AiConversationDb;
}

function readBoolean(value: string | null) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request, { roles: [ADMIN_ROLE.SUPER_ADMIN] });

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 30)));
    const lowConfidence = readBoolean(searchParams.get('lowConfidence'));
    const confirmed = readBoolean(searchParams.get('confirmed'));

    const where: Record<string, unknown> = {};
    for (const key of ['memberProfileId', 'assessmentSessionId', 'assessmentHistoryId', 'scaleId', 'provider']) {
      const value = searchParams.get(key);
      if (value) {
        where[key] = value;
      }
    }

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const eventFilter: Record<string, unknown> = {};
    if (lowConfidence !== undefined) {
      eventFilter.confidence = lowConfidence ? { lt: 0.8 } : { gte: 0.8 };
    }
    if (confirmed !== undefined) {
      eventFilter.confirmedLowConfidence = confirmed;
    }
    if (Object.keys(eventFilter).length) {
      where.events = { some: eventFilter };
    }

    const [items, total] = await Promise.all([
      db().aiConversationSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          events: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      }),
      db().aiConversationSession.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load AI conversations' },
      { status: 500 }
    );
  }
}
