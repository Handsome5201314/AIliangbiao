import { NextResponse } from 'next/server';

import { CURRENT_PRIVACY_CONSENT } from '@/lib/legal/privacyConsent';

export async function GET() {
  return NextResponse.json(CURRENT_PRIVACY_CONSENT);
}
