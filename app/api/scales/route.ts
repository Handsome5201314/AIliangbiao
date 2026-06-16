import { NextRequest, NextResponse } from "next/server";

import {
  getExplorationScaleById,
  getPublicClinicalChildScaleById,
  listExplorationScales,
  listPublicClinicalChildScales,
  normalizeScaleCatalogCategoryParam,
} from "@/lib/scales/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scaleId = searchParams.get("id");
  const category = normalizeScaleCatalogCategoryParam(searchParams.get("category"));

  if (scaleId) {
    const scale =
      category === "exploration"
        ? getExplorationScaleById(scaleId)
        : getPublicClinicalChildScaleById(scaleId);

    if (!scale) {
      return NextResponse.json({ error: "Scale not found" }, { status: 404 });
    }

    return NextResponse.json({ scale });
  }

  return NextResponse.json({
    scales: category === "exploration" ? listExplorationScales() : listPublicClinicalChildScales(),
  });
}
