import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'System API secrets are no longer exposed through HTTP. Use server-side key resolvers only.',
    },
    { status: 410 }
  );
}
