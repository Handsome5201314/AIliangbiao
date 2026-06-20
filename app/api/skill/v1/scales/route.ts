import { NextRequest, NextResponse } from 'next/server';

import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { listAiToyVoiceSkillScales, listSkillScales } from '@/lib/assessment-skill/scale-service';

export async function GET(request: NextRequest) {
  try {
    authenticateSkillRequest(request, 'skill:scales:read');
    const aiToy = request.nextUrl.searchParams.get('aiToy');
    const voiceFriendly = request.nextUrl.searchParams.get('voiceFriendly');
    const shouldUseAiToyVoiceList = aiToy === 'voiceFriendly' || voiceFriendly === '1';

    return NextResponse.json({
      scales: shouldUseAiToyVoiceList ? listAiToyVoiceSkillScales() : listSkillScales(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 }
    );
  }
}
