import { NextRequest, NextResponse } from "next/server";

import { ADMIN_ROLE } from "@/lib/auth/admin-role";
import { createAdminUnauthorizedResponse, requireAdminRequest } from "@/lib/auth/require-admin";
import {
  listAdminAuditLogs,
  type AdminAuditActorType,
  type AdminAuditTargetType,
} from "@/lib/services/admin-audit-logs";

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request, {
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.AUDITOR],
    });

    const actorType = request.nextUrl.searchParams.get("actorType")?.toUpperCase() || "ALL";
    const targetType = request.nextUrl.searchParams.get("targetType")?.toUpperCase() || "ALL";
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";

    const logs = await listAdminAuditLogs({
      actorType: actorType as AdminAuditActorType,
      targetType: targetType as AdminAuditTargetType,
      query,
    });

    return NextResponse.json({
      logs,
      actorType,
      targetType,
      query,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAdminUnauthorizedResponse("仅超级管理员和审计员可查看审计日志");
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load platform audit logs" },
      { status: 500 }
    );
  }
}
