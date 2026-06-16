import { NextRequest, NextResponse } from 'next/server';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { getSkillScale } from '@/lib/assessment-skill/scale-service';
import { normalizeScaleCatalogCategoryParam } from '@/lib/scales/catalog';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string }> }
) {
  try {
    authenticateSkillRequest(request, 'skill:scales:read');
    const { scaleId } = await context.params;
    const category = normalizeScaleCatalogCategoryParam(request.nextUrl.searchParams.get('category'));
    const scale = getSkillScale(scaleId, category);

    if (!scale) {
      return NextResponse.json({ error: 'Scale not found' }, { status: 404 });
    }

    return NextResponse.json({ scale });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
