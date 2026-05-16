import { NextRequest, NextResponse } from 'next/server';

import { getClinicQrForPublic } from '@/lib/services/clinic-screenings';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const { qr, scale } = await getClinicQrForPublic(slug);

    return NextResponse.json({
      qr: {
        id: qr.id,
        slug: qr.slug,
      },
      point: {
        id: qr.point.id,
        name: qr.point.name,
        code: qr.point.code,
        locationLabel: qr.point.locationLabel,
        departmentLabel: qr.point.departmentLabel,
      },
      doctor: {
        id: qr.point.ownerDoctorProfile.id,
        realName: qr.point.ownerDoctorProfile.realName,
        hospitalName: qr.point.ownerDoctorProfile.hospitalName,
        departmentName: qr.point.ownerDoctorProfile.departmentName,
        title: qr.point.ownerDoctorProfile.title,
      },
      scale,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Clinic QR not found' },
      { status: 404 }
    );
  }
}
