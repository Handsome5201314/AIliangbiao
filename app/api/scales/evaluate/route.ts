import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { evaluateScaleAnswers, getScaleDefinitionById } from "@/lib/scales/catalog";

const requestSchema = z.object({
  scaleId: z.string().min(1),
  answers: z.array(z.number()),
});

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const scale = getScaleDefinitionById(body.scaleId);

    if (!scale) {
      return NextResponse.json({ error: "Scale not found" }, { status: 404 });
    }

    if (body.answers.length !== scale.questions.length) {
      return NextResponse.json(
        {
          error: `Expected ${scale.questions.length} answers, received ${body.answers.length}.`,
        },
        { status: 400 }
      );
    }

    const result = evaluateScaleAnswers(body.scaleId, body.answers);

    return NextResponse.json({
      scaleId: scale.id,
      result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to evaluate scale" }, { status: 500 });
  }
}
