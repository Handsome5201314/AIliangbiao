import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { requirePatientUser } from '@/lib/auth/user-session';
import { setResearchConsent } from '@/lib/domain/care-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  try {
    const { user } = await requirePatientUser(request);
    const { memberId } = await context.params;
    const consent = await prisma.researchConsent.findFirst({
      where: {
        memberProfileId: memberId,
        grantedByUserId: user.id,
      },
    });
    return NextResponse.json({ consent });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load research consent' },
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
    const consent = await setResearchConsent({
      patientUserId: user.id,
      memberId,
      granted: true,
    });
    return NextResponse.json({ success: true, consent });
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
    const consent = await setResearchConsent({
      patientUserId: user.id,
      memberId,
      granted: false,
    });
    return NextResponse.json({ success: true, consent });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke research consent' },
      { status: 401 }
    );
  }
}
