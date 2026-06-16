import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ADMIN_ROLE } from "@/lib/auth/admin-role";
import { createAdminUnauthorizedResponse, requireAdminRequest } from "@/lib/auth/require-admin";
import {
  createAdminHermesProfile,
  listAdminHermesProfiles,
  updateAdminHermesProfile,
} from "@/lib/services/admin-hermes-profiles";

const hermesProfileStatusSchema = z.enum(["DRAFT", "READY", "DEGRADED", "DISABLED"]);
const hermesProfileOwnerTypeSchema = z.enum(["ORGANIZATION", "DOCTOR"]);
const knowledgeDefaultModeSchema = z.enum(["platform_proxy", "direct_fastgpt"]);
const jsonObjectSchema = z.object({}).catchall(z.unknown());

const hermesProfileCreateSchema = z
  .object({
    ownerType: hermesProfileOwnerTypeSchema,
    organizationId: z.string().trim().min(1, "缺少组织 ID").optional().nullable(),
    doctorProfileId: z.string().trim().min(1, "缺少医生档案 ID").optional().nullable(),
    displayName: z
      .string()
      .trim()
      .max(80, "Profile 名称不能超过 80 个字符")
      .optional()
      .nullable(),
    status: hermesProfileStatusSchema.default("READY"),
    knowledgeDefaultMode: knowledgeDefaultModeSchema.default("platform_proxy"),
    doctorBotFallbackEnabled: z.boolean().default(true),
    policyJson: jsonObjectSchema.optional().nullable(),
    configJson: jsonObjectSchema.optional().nullable(),
    lastHealthAt: z.string().datetime().optional().nullable(),
  })
  .superRefine((value, context) => {
    if (value.ownerType === "ORGANIZATION" && !value.organizationId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organizationId"],
        message: "组织级 Hermes Profile 必须选择组织",
      });
    }

    if (value.ownerType === "DOCTOR" && !value.doctorProfileId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["doctorProfileId"],
        message: "医生级 Hermes Profile 必须选择独立医生",
      });
    }
  });

const hermesProfileUpdateSchema = z
  .object({
    id: z.string().trim().min(1, "缺少 Hermes Profile ID"),
    displayName: z
      .string()
      .trim()
      .max(80, "Profile 名称不能超过 80 个字符")
      .optional()
      .nullable(),
    status: hermesProfileStatusSchema.optional(),
    knowledgeDefaultMode: knowledgeDefaultModeSchema.optional(),
    doctorBotFallbackEnabled: z.boolean().optional(),
    policyJson: jsonObjectSchema.optional().nullable(),
    configJson: jsonObjectSchema.optional().nullable(),
    lastHealthAt: z.string().datetime().optional().nullable(),
  })
  .refine(
    (value) =>
      value.displayName !== undefined ||
      value.status !== undefined ||
      value.knowledgeDefaultMode !== undefined ||
      value.doctorBotFallbackEnabled !== undefined ||
      value.policyJson !== undefined ||
      value.configJson !== undefined ||
      value.lastHealthAt !== undefined,
    { message: "至少提供一个可更新字段" }
  );

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request, { roles: [ADMIN_ROLE.SUPER_ADMIN] });

    const rawStatus = request.nextUrl.searchParams.get("status")?.toUpperCase() || "ALL";
    const status =
      rawStatus === "DRAFT" ||
      rawStatus === "READY" ||
      rawStatus === "DISABLED" ||
      rawStatus === "DEGRADED"
        ? rawStatus
        : "ALL";
    const rawOwnerType = request.nextUrl.searchParams.get("ownerType")?.toUpperCase() || "ALL";
    const ownerType =
      rawOwnerType === "ORGANIZATION" || rawOwnerType === "DOCTOR" ? rawOwnerType : "ALL";
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";

    const result = await listAdminHermesProfiles({
      status,
      ownerType,
      query,
    });

    return NextResponse.json({
      ...result,
      filters: {
        status,
        ownerType,
        query,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAdminUnauthorizedResponse("仅超级管理员可查看 Hermes Profile 管理");
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Hermes profiles" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdminRequest(request, { roles: [ADMIN_ROLE.SUPER_ADMIN] });
    const payload = hermesProfileCreateSchema.parse(await request.json());
    const profile = await createAdminHermesProfile({
      ...payload,
      adminId: admin.id,
    });

    return NextResponse.json({
      profile,
      message: "Hermes Profile 已创建",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAdminUnauthorizedResponse("仅超级管理员可创建 Hermes Profile");
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Hermes Profile 参数校验失败" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Hermes profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin } = await requireAdminRequest(request, { roles: [ADMIN_ROLE.SUPER_ADMIN] });
    const payload = hermesProfileUpdateSchema.parse(await request.json());
    const profile = await updateAdminHermesProfile(payload.id, {
      ...payload,
      adminId: admin.id,
    });

    return NextResponse.json({
      profile,
      message: "Hermes Profile 已更新",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAdminUnauthorizedResponse("仅超级管理员可修改 Hermes Profile");
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Hermes Profile 参数校验失败" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update Hermes profile" },
      { status: 500 }
    );
  }
}
