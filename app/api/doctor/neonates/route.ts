import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApprovedDoctorUser } from '@/lib/auth/require-app-session';
import {
  createOrMatchDoctorNeonateArchive,
  listDoctorNeonateArchives,
} from '@/lib/services/doctor-neonates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createArchiveSchema = z.object({
  babyName: z.string().trim().min(1).max(50),
  sex: z.enum(['boy', 'girl']),
  birthGestationWeeks: z.number().int().min(20).max(45),
  birthGestationDays: z.number().int().min(0).max(6),
  birthDate: z.string().date(),
  birthTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
});

export async function GET(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';
    const sex = (searchParams.get('sex') || 'ALL') as 'boy' | 'girl' | 'ALL';
    const birthGestationWeeksFrom = searchParams.get('birthGestationWeeksFrom');
    const birthGestationWeeksTo = searchParams.get('birthGestationWeeksTo');
    const parsedFrom = birthGestationWeeksFrom ? Number(birthGestationWeeksFrom) : undefined;
    const parsedTo = birthGestationWeeksTo ? Number(birthGestationWeeksTo) : undefined;

    const archives = await listDoctorNeonateArchives({
      doctorProfileId: doctorProfile.id,
      search,
      sex,
      birthGestationWeeksFrom: Number.isFinite(parsedFrom) ? parsedFrom : undefined,
      birthGestationWeeksTo: Number.isFinite(parsedTo) ? parsedTo : undefined,
    });

    return NextResponse.json({ archives });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { doctorProfile } = await requireApprovedDoctorUser(request);
    const body = createArchiveSchema.parse(await request.json());

    const result = await createOrMatchDoctorNeonateArchive({
      doctorProfileId: doctorProfile.id,
      ...body,
    });

    if (result.status === 'multiple_matches') {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create neonate archive' },
      { status },
    );
  }
}
