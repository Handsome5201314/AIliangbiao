import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ADMIN_ROLE } from "@/lib/auth/admin-role";
import { createAdminUnauthorizedResponse, requireAdminRequest } from "@/lib/auth/require-admin";
import { reviewKnowledgeItem } from "@/lib/services/admin-knowledge-reviews";

const approveSchema = z.object({
  itemType: z.enum(["KNOWLEDGE_DOC", "QUESTION_EXPLANATION"]).optional(),
  reviewNotes: z.string().trim().max(500, "审核备注不能超过 500 个字符").optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { admin } = await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.KB_REVIEWER, ADMIN_ROLE.ORG_REVIEWER],
    });
    const { id } = await context.params;
    const rawPayload = await request.json().catch(() => ({}));
    const payload = approveSchema.parse(rawPayload);

    const result = await reviewKnowledgeItem({
      itemType: payload.itemType || "KNOWLEDGE_DOC",
      itemId: id,
      action: "approve",
      reviewNotes: payload.reviewNotes,
      adminId: admin.id,
    });

    return NextResponse.json({
      result,
      message: "审核已通过",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAdminUnauthorizedResponse("仅超级管理员和知识审核员可执行知识审核");
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "审核参数无效" }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve knowledge review item" },
      { status: 500 }
    );
  }
}
