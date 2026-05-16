import { NextRequest, NextResponse } from 'next/server';

import { requirePatientUser } from '@/lib/auth/require-app-session';
import { upsertResearchConsent } from '@/lib/services/doctor-care';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { memberId } = await context.params;
    const member = await prisma.memberProfile.findFirst({
      where: {
        id: memberId,
        userId: user.id,
      },
      include: {
        researchConsent: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    return NextResponse.json({
      consent: member.researchConsent,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { memberId } = await context.params;

    const consent = await upsertResearchConsent({
      memberId,
      grantedByUserId: user.id,
      status: 'GRANTED',
    });

    return NextResponse.json({
      success: true,
      consent,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to grant research consent' },
      { status: 401 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { memberId } = await context.params;

    const consent = await upsertResearchConsent({
      memberId,
      grantedByUserId: user.id,
      status: 'REVOKED',
    });

    return NextResponse.json({
      success: true,
      consent,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke research consent' },
      { status: 401 }
    );
  }
}
