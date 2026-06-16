import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ADMIN_ROLE } from "@/lib/auth/admin-role";
import { createAdminUnauthorizedResponse, requireAdminRequest } from "@/lib/auth/require-admin";
import {
  createAdminOrganization,
  listAdminOrganizations,
  updateAdminOrganization,
} from "@/lib/services/admin-organizations";

const organizationStatusSchema = z.enum(["ACTIVE", "DISABLED"]);

const organizationCreateSchema = z.object({
  name: z.string().trim().min(2, "组织名称至少需要 2 个字符").max(80, "组织名称不能超过 80 个字符"),
  orgCode: z.string().trim().max(40, "机构编码不能超过 40 个字符").optional().nullable(),
  contactName: z.string().trim().max(40, "联系人不能超过 40 个字符").optional().nullable(),
  contactPhone: z.string().trim().max(40, "联系电话不能超过 40 个字符").optional().nullable(),
  status: organizationStatusSchema.default("ACTIVE"),
});

const organizationUpdateSchema = z
  .object({
    id: z.string().trim().min(1, "缺少组织 ID"),
    name: z
      .string()
      .trim()
      .min(2, "组织名称至少需要 2 个字符")
      .max(80, "组织名称不能超过 80 个字符")
      .optional(),
    orgCode: z.string().trim().max(40, "机构编码不能超过 40 个字符").optional().nullable(),
    contactName: z.string().trim().max(40, "联系人不能超过 40 个字符").optional().nullable(),
    contactPhone: z.string().trim().max(40, "联系电话不能超过 40 个字符").optional().nullable(),
    status: organizationStatusSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.orgCode !== undefined ||
      value.contactName !== undefined ||
      value.contactPhone !== undefined ||
      value.status !== undefined,
    { message: "至少提供一个可更新字段" }
  );

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request, { roles: [ADMIN_ROLE.SUPER_ADMIN] });

    const rawStatus = request.nextUrl.searchParams.get("status")?.toUpperCase() || "ALL";
    const status = rawStatus === "ACTIVE" || rawStatus === "DISABLED" ? rawStatus : "ALL";
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    const organizations = await listAdminOrganizations({
      status,
      query,
    });

    return NextResponse.json({
      organizations,
      status,
      query,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAdminUnauthorizedResponse("仅超级管理员可查看组织管理");
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load organizations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdminRequest(request, { roles: [ADMIN_ROLE.SUPER_ADMIN] });
    const payload = organizationCreateSchema.parse(await request.json());
    const organization = await createAdminOrganization({
      ...payload,
      createdByAdminId: admin.id,
    });

    return NextResponse.json({
      organization,
      message: "组织已创建",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAdminUnauthorizedResponse("仅超级管理员可创建组织");
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "组织信息校验失败" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create organization" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminRequest(request, { roles: [ADMIN_ROLE.SUPER_ADMIN] });
    const payload = organizationUpdateSchema.parse(await request.json());
    const organization = await updateAdminOrganization(payload.id, payload);

    return NextResponse.json({
      organization,
      message: "组织已更新",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAdminUnauthorizedResponse("仅超级管理员可修改组织");
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "组织信息校验失败" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update organization" },
      { status: 500 }
    );
  }
}
