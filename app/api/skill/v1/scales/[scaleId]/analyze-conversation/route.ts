import { NextRequest, NextResponse } from 'next/server';

import { getInternalApiUrl } from '@/lib/assessment-skill/internal-api';
import { authenticateSkillRequest } from '@/lib/assessment-skill/request-auth';
import { recordConversationAnalysisDecision } from '@/lib/services/ai-decision-audit';

function isAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('Bearer token') ||
    error.message.includes('Agent session') ||
    error.message.includes('required scope')
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ scaleId: string }> }
) {
  try {
    const session = authenticateSkillRequest(request, 'skill:scales:read');
    const body = await request.json();
    const { scaleId } = await context.params;

    const proxied = await fetch(getInternalApiUrl('/api/scales/analyze-conversation', request), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        scaleId,
      }),
    });

    const text = await proxied.text();
    if (proxied.ok) {
      await recordConversationAnalysisDecision({
        session,
        scaleId,
        messages: Array.isArray(body.messages) ? body.messages : [],
        result: JSON.parse(text),
      });
    }

    return new NextResponse(text, {
      status: proxied.status,
      headers: {
        'Content-Type': proxied.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Conversation analysis failed' },
      { status: isAuthError(error) ? 401 : 500 }
    );
  }
}
