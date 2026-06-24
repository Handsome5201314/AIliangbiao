import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApprovedDoctorUser } from "@/lib/auth/require-app-session";
import {
  createEducationContentDraft,
  listDoctorEducationContents,
} from "@/lib/services/health-education";

const createContentSchema = z.object({
  title: z.string().trim().min(1, "健康教育标题不能为空"),
  contentMd: z.string().trim().min(1, "健康教育内容不能为空"),
  summary: z.string().trim().optional().nullable(),
  scaleId: z.string().trim().optional().nullable(),
  dimensionKey: z.string().trim().optional().nullable(),
  riskLevel: z.string().trim().optional().nullable(),
  audience: z.string().trim().optional().nullable(),
  sourceDocId: z.string().trim().optional().nullable(),
  metadata: z.unknown().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const status = request.nextUrl.searchParams.get("status")?.toUpperCase() || "ALL";
    const contents = await listDoctorEducationContents({
      doctorProfileId: doctorProfile.id,
      status: status as any,
    });

    return NextResponse.json({ contents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load education contents" },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const payload = createContentSchema.parse(await request.json());
    const content = await createEducationContentDraft({
      doctorProfileId: doctorProfile.id,
      ...payload,
    });

    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "健康教育内容参数无效" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create education content" },
      { status: 401 }
    );
  }
}
