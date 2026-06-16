import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ROLE } from "@/lib/auth/admin-role";
import { createAdminUnauthorizedResponse, requireAdminRequest } from "@/lib/auth/require-admin";
import {
  listAdminKnowledgeReviewItems,
  type AdminKnowledgeReviewItemType,
  type AdminKnowledgeReviewStatus,
} from "@/lib/services/admin-knowledge-reviews";

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
      { error: error instanceof Error ? error.message : "Failed to load platform knowledge reviews" },
      { status: 500 }
    );
  }
}
