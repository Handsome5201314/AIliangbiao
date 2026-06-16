import { NextRequest, NextResponse } from 'next/server';

import { requireDoctorUser } from '@/lib/auth/require-app-session';
import {
  getDoctorVisibleScaleById,
  listDoctorVisibleScales,
  listExplorationScales,
  normalizeScaleCatalogCategoryParam,
} from '@/lib/scales/catalog';
import { getAdminPolicies } from '@/lib/services/admin-policies';

export async function GET(request: NextRequest) {
  try {
    await requireDoctorUser(request);

    const policies = await getAdminPolicies();
    const doctorExplorationEnabled = policies.catalog.doctorExplorationEnabled;
    const category = normalizeScaleCatalogCategoryParam(request.nextUrl.searchParams.get('category'));
    const scaleId = request.nextUrl.searchParams.get('id');

    if (scaleId) {
      const scale =
        category === 'exploration'
          ? doctorExplorationEnabled
            ? listExplorationScales().find((item) => item.id.toUpperCase() === scaleId.toUpperCase())
            : undefined
          : getDoctorVisibleScaleById(scaleId, { doctorExplorationEnabled });

      if (!scale) {
        return NextResponse.json({ error: 'Scale not found' }, { status: 404 });
      }

      return NextResponse.json({ scale, doctorExplorationEnabled });
    }

    const scales =
      category === 'exploration'
        ? doctorExplorationEnabled
          ? listExplorationScales()
          : []
        : listDoctorVisibleScales({ doctorExplorationEnabled });

    return NextResponse.json({
      scales,
      doctorExplorationEnabled,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
