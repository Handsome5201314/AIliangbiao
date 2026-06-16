import { NextResponse } from "next/server";

import { getHermesHealthSnapshot } from "@/lib/realtime/hermes-health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const snapshot = await getHermesHealthSnapshot();
  return NextResponse.json(snapshot, {
    status: snapshot.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
