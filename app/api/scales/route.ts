import { NextRequest, NextResponse } from "next/server";

import {
  getSerializableScaleById,
  listSerializableScaleSummaries,
  listSerializableScales,
} from "@/lib/scales/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scaleId = searchParams.get("id");
  const view = searchParams.get("view");

  if (scaleId) {
    const scale = getSerializableScaleById(scaleId);

    if (!scale) {
      return NextResponse.json({ error: "Scale not found" }, { status: 404 });
    }

    return NextResponse.json({ scale });
  }

  if (view === "summary") {
    return NextResponse.json({
      scales: listSerializableScaleSummaries(),
    });
  }

  return NextResponse.json({
    scales: listSerializableScales(),
  });
}
