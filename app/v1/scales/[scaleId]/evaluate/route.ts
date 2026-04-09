import { NextResponse } from "next/server";
import { z } from "zod";

import { buildAgentPitAuthErrorResponse, assertAgentPitSharedBearer } from "@/lib/agentpit/shared-auth";
import { evaluateScaleAnswers, getScaleDefinitionById } from "@/lib/scales/catalog";

const requestSchema = z.object({
  answers: z.array(z.number()),
  formData: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ scaleId: string }> }
) {
  try {
    assertAgentPitSharedBearer(request);

    const body = requestSchema.parse(await request.json());
    const { scaleId } = await context.params;
    const scale = getScaleDefinitionById(scaleId);

    if (!scale) {
      return NextResponse.json(
        { error: "Scale not found" },
        { status: 404 }
      );
    }

    if (body.answers.length !== scale.questions.length) {
      return NextResponse.json(
        {
          error: `Expected ${scale.questions.length} answers, received ${body.answers.length}.`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      scaleId: scale.id,
      result: evaluateScaleAnswers(scale.id, body.answers, body.formData),
    });
  } catch (error) {
    const authResponse = buildAgentPitAuthErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to evaluate scale" },
      { status: 500 }
    );
  }
}
