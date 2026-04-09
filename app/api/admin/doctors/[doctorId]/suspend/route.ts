import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { requireAdminToken } from '@/lib/auth/admin-token';

const requestSchema = z.object({
  reviewNotes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ doctorId: string }> }
) {
  try {
    await requireAdminToken(request);
    const body = requestSchema.parse(await request.json());
    const { doctorId } = await context.params;
    const profile = await prisma.doctorProfile.update({
      where: { id: doctorId },
      data: {
        verificationStatus: 'SUSPENDED',
        reviewNotes: body.reviewNotes || null,
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to suspend doctor' },
      { status }
    );
  }
}
