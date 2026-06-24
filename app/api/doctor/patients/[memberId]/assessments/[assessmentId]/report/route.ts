import { NextRequest, NextResponse } from 'next/server';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { getDoctorAssessmentReport } from '@/lib/services/doctor-care';
import { recordReportView } from '@/lib/services/research-events';
import { renderAssessmentReportHtml } from '@/lib/utils/assessmentReportTemplate';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string; assessmentId: string }> }
) {
  try {
    const { user, doctorProfile } = await requireApprovedDoctorUser(request);
    const { memberId, assessmentId } = await context.params;
    const format = request.nextUrl.searchParams.get('format') || 'json';

    const report = await getDoctorAssessmentReport({
      doctorProfileId: doctorProfile.id,
      memberId,
      assessmentId,
    });

    await recordReportView({
      actor: { user },
      memberProfileId: memberId,
      assessmentHistoryId: assessmentId,
      viewerRole: 'DOCTOR',
      metadata: {
        format,
        reportNo: report.reportNo,
      },
    });

    if (format === 'print') {
      return new NextResponse(renderAssessmentReportHtml(report.report), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load assessment report' },
      { status: 401 }
    );
  }
}
