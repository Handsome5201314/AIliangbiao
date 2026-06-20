import { NextRequest, NextResponse } from "next/server";

import {
  getPublicClinicalChildScaleById,
  listPublicClinicalChildScales,
} from "@/lib/scales/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scaleId = searchParams.get("id");

  if (scaleId) {
    const scale = getPublicClinicalChildScaleById(scaleId);

    if (!scale) {
      return NextResponse.json({ error: "Scale not found" }, { status: 404 });
    }

    return NextResponse.json({ scale });
  }

  return NextResponse.json({
    scales: listPublicClinicalChildScales(),
  });
}
