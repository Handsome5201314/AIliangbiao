import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ADMIN_ROLE } from "@/lib/auth/admin-role";
import { requireAdminRequest } from "@/lib/auth/require-admin";
import { requireApprovedDoctorUser } from "@/lib/auth/require-app-session";
import {
  createPlatformKnowledgeDoc,
  listPlatformKnowledgeDocs,
  type PlatformKnowledgeDocActor,
} from "@/lib/services/platform-kb-docs";

const createKnowledgeDocSchema = z.object({
  title: z.string().trim().min(2, "知识文档标题至少需要 2 个字符").max(120, "知识文档标题不能超过 120 个字符"),
  summary: z.string().trim().max(500, "知识文档摘要不能超过 500 个字符").optional().nullable(),
  rawMd: z.string().trim().min(10, "知识文档内容至少需要 10 个字符"),
  language: z.string().trim().max(12, "语言标识过长").optional().nullable(),
  sourceFileName: z.string().trim().max(200, "源文件名不能超过 200 个字符").optional().nullable(),
  scopeType: z.enum(["PLATFORM", "ORGANIZATION", "DOCTOR"]).optional(),
  organizationId: z.string().trim().optional().nullable(),
  doctorProfileId: z.string().trim().optional().nullable(),
});

async function resolveKnowledgeDocActor(request: NextRequest): Promise<PlatformKnowledgeDocActor> {
  try {
    const { admin } = await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.KB_REVIEWER, ADMIN_ROLE.ORG_REVIEWER],
    });
    return {
      kind: "admin",
      adminId: admin.id,
    };
  } catch (adminError) {
    try {
      const { user, doctorProfile } = await requireApprovedDoctorUser(request);
      return {
        kind: "doctor",
        userId: user.id,
        doctorProfileId: doctorProfile.id,
        organizationId: doctorProfile.organizationId || null,
        isOrganizationOwner: doctorProfile.isOrganizationOwner,
      };
    } catch {
      throw adminError;
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveKnowledgeDocActor(request);
    const status = request.nextUrl.searchParams.get("status")?.toUpperCase() || "ALL";
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    const docs = await listPlatformKnowledgeDocs({
      actor,
      status: status as Parameters<typeof listPlatformKnowledgeDocs>[0]["status"],
      query,
    });

    return NextResponse.json({ docs, status, query });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message.includes("Unauthorized") || message.includes("Missing Bearer token") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveKnowledgeDocActor(request);
    const payload = createKnowledgeDocSchema.parse(await request.json());
    const doc = await createPlatformKnowledgeDoc({
      actor,
      ...payload,
    });

    return NextResponse.json({
      doc,
      message: "知识文档已保存为草稿",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "知识文档参数无效" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Failed to create knowledge doc";
    const status = message.includes("Unauthorized") || message.includes("Missing Bearer token") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
