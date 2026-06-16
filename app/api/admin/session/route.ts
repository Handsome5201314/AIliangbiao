import { NextRequest, NextResponse } from "next/server";

import { createAdminUnauthorizedResponse, requireAdminRequest } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdminRequest(request);

    return NextResponse.json({
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return createAdminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load admin session" },
      { status: 500 }
    );
  }
}
