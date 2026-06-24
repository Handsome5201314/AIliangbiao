import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { ADMIN_ROLE } from '@/lib/auth/admin-role';
import { requireAdminRequest } from '@/lib/auth/require-admin';
import { importHistoricalResearchCsv } from '@/lib/services/research-import';

const importRequestSchema = z.object({
  sourceName: z.string().min(1),
  csvContent: z.string().min(1),
  fieldMapping: z.record(z.string(), z.string()),
});

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.AUDITOR],
    });
    const body = importRequestSchema.parse(await request.json());
    const result = await importHistoricalResearchCsv({
      sourceName: body.sourceName,
      csvContent: body.csvContent,
      fieldMapping: body.fieldMapping as Parameters<typeof importHistoricalResearchCsv>[0]['fieldMapping'],
      actor: {
        requestedByUserId: null,
        uploadedByDoctorProfileId: null,
      },
    });

    return NextResponse.json({
      batchId: result.batch?.id || null,
      importedRowCount: result.rows.length,
      qualitySummary: result.qualitySummary,
      requestedByAdminId: admin.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import research CSV' },
      { status: error instanceof z.ZodError ? 400 : 401 }
    );
  }
}
