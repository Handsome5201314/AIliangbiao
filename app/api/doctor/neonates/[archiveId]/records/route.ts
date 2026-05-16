import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import { createDoctorNeonateGrowthRecord } from '@/lib/services/doctor-neonates';

const createRecordSchema = z.object({
  recordDate: z.string().date(),
  recordTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  length: z.number().min(25).max(70).optional(),
  weight: z.number().min(0.4).max(8).optional(),
  headCircumference: z.number().min(18).max(45).optional(),
  bilirubinUmol: z.number().min(0).max(900).optional(),
  bilirubinContext: z.enum(['AMBIENT', 'PHOTOTHERAPY']).optional(),
})
  .refine(
    (value) =>
      value.length !== undefined ||
      value.weight !== undefined ||
      value.headCircumference !== undefined ||
      value.bilirubinUmol !== undefined,
    {
      message: 'At least one metric is required',
    },
  )
  .refine(
    (value) => value.bilirubinUmol === undefined || value.bilirubinContext !== undefined,
    {
      message: 'Bilirubin context is required when bilirubin is provided',
      path: ['bilirubinContext'],
    },
  );

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ archiveId: string }> },
) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { archiveId } = await context.params;
    const body = createRecordSchema.parse(await request.json());
    const result = await createDoctorNeonateGrowthRecord({
      doctorProfileId: doctorProfile.id,
      archiveId,
      ...body,
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save neonate growth record' },
      { status },
    );
  }
}
