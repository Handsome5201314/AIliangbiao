import { NextRequest, NextResponse } from 'next/server';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { listAiToyVoiceSkillScales, listSkillScales } from '@/lib/assessment-skill/scale-service';
import { normalizeScaleCatalogCategoryParam } from '@/lib/scales/catalog';

export async function GET(request: NextRequest) {
  try {
    authenticateSkillRequest(request, 'skill:scales:read');
    const aiToy = request.nextUrl.searchParams.get('aiToy');
    const voiceFriendly = request.nextUrl.searchParams.get('voiceFriendly');
    const category = normalizeScaleCatalogCategoryParam(request.nextUrl.searchParams.get('category'));
    const shouldUseAiToyVoiceList = aiToy === 'voiceFriendly' || voiceFriendly === '1';

    return NextResponse.json({
      scales: shouldUseAiToyVoiceList ? listAiToyVoiceSkillScales() : listSkillScales(category),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
