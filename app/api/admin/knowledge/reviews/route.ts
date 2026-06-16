import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ADMIN_ROLE } from "@/lib/auth/admin-role";
import { createAdminUnauthorizedResponse, requireAdminRequest } from "@/lib/auth/require-admin";
import {
  listAdminKnowledgeReviewItems,
  reviewKnowledgeItem,
  type AdminKnowledgeReviewItemType,
  type AdminKnowledgeReviewStatus,
} from "@/lib/services/admin-knowledge-reviews";

const reviewActionSchema = z.object({
  itemType: z.enum(["KNOWLEDGE_DOC", "QUESTION_EXPLANATION"]),
  itemId: z.string().trim().min(1, "缺少审核对象 ID"),
  action: z.enum(["approve", "reject"]),
  reviewNotes: z.string().trim().max(500, "审核备注不能超过 500 个字符").optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.KB_REVIEWER, ADMIN_ROLE.ORG_REVIEWER],
    });

    const itemType = request.nextUrl.searchParams.get("itemType")?.toUpperCase() || "ALL";
    const status = request.nextUrl.searchParams.get("status")?.toUpperCase() || "PENDING_REVIEW";
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";

    const items = await listAdminKnowledgeReviewItems({
      itemType: itemType as AdminKnowledgeReviewItemType,
      status: status as AdminKnowledgeReviewStatus,
      query,
    });

    return NextResponse.json({
      items,
      itemType,
      status,
      query,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAdminUnauthorizedResponse("仅超级管理员和知识审核员可查看知识审核队列");
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load knowledge reviews" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin } = await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.KB_REVIEWER, ADMIN_ROLE.ORG_REVIEWER],
    });
    const payload = reviewActionSchema.parse(await request.json());

    if (payload.action === "reject" && !payload.reviewNotes?.trim()) {
      return NextResponse.json({ error: "驳回时请填写审核原因" }, { status: 400 });
    }

    const result = await reviewKnowledgeItem({
      itemType: payload.itemType,
      itemId: payload.itemId,
      action: payload.action,
      reviewNotes: payload.reviewNotes,
      adminId: admin.id,
    });

    return NextResponse.json({
      result,
      message: payload.action === "approve" ? "审核已通过" : "审核已驳回",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAdminUnauthorizedResponse("仅超级管理员和知识审核员可执行知识审核");
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "审核参数无效" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to review knowledge item" },
      { status: 500 }
    );
  }
}
