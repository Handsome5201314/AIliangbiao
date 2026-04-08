import { NextRequest } from 'next/server';

export function getInternalApiUrl(pathname: string, request: NextRequest) {
  const base =
    process.env.INTERNAL_APP_BASE_URL ||
    (process.env.NODE_ENV === 'production'
      ? `http://127.0.0.1:${process.env.PORT || '3000'}`
      : request.nextUrl.origin);

  return new URL(pathname, base);
}
