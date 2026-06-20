import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_ROLE } from '@/lib/auth/admin-role';
import { requireAdminRequest } from '@/lib/auth/require-admin';
import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import {
  exportResearchDataset,
  type ResearchExportFormat,
} from '@/lib/services/research-export';

function parseExportFormat(value: string | null): ResearchExportFormat {
  return value === 'csv' ? 'csv' : 'json';
}

async function requireResearchExportAccess(request: NextRequest) {
  try {
    const { admin } = await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.AUDITOR],
    });

    return {
      actorType: 'ADMIN' as const,
      actorId: admin.id,
      actorRole: admin.role,
    };
  } catch {
    const { user, doctorProfile } = await requireApprovedDoctorUser(request);

    return {
      actorType: 'DOCTOR' as const,
      actorId: user.id,
      doctorProfileId: doctorProfile.id,
      actorRole: 'APPROVED_DOCTOR',
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireResearchExportAccess(request);
    const format = parseExportFormat(request.nextUrl.searchParams.get('format'));
    const dataset = await exportResearchDataset({ format });

    return new NextResponse(dataset.content, {
      status: 200,
      headers: {
        'Content-Type': dataset.mimeType,
        'Content-Disposition': `attachment; filename="${dataset.filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
