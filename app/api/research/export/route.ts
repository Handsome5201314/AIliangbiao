import { NextRequest, NextResponse } from 'next/server';

import { ADMIN_ROLE } from '@/lib/auth/admin-role';
import { requireAdminRequest } from '@/lib/auth/require-admin';
import {
  exportResearchDataset,
  type ResearchExportFormat,
} from '@/lib/services/research-export';

function parseExportFormat(value: string | null): ResearchExportFormat {
  return value === 'csv' ? 'csv' : 'json';
}

async function requireResearchExportAccess(request: NextRequest) {
  const { admin } = await requireAdminRequest(request, {
    roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.AUDITOR],
  });

  return {
    actorType: 'ADMIN' as const,
    actorId: admin.id,
    adminId: admin.id,
    actorRole: admin.role,
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireResearchExportAccess(request);
    const format = parseExportFormat(request.nextUrl.searchParams.get('format'));
    const purpose = request.nextUrl.searchParams.get('purpose') || 'research-derived-dataset-export';
    const dataset = await exportResearchDataset({
      format,
      actor,
      purpose,
      persistBatch: true,
    });

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
