import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { requirePatientUser } from '@/lib/auth/require-app-session';

const recordSchema = z
  .object({
    week: z.number().int().min(24).max(42),
    weight: z.number().min(0.5).max(5.0).optional(),
    length: z.number().min(25).max(60).optional(),
    headCircumference: z.number().min(20).max(40).optional(),
  })
  .refine(
    (value) =>
      typeof value.weight === 'number' ||
      typeof value.length === 'number' ||
      typeof value.headCircumference === 'number',
    {
      message: 'At least one growth metric is required',
      path: ['weight'],
    },
  );

type GestationalGrowthRow = {
  id: string;
  gestationalWeek: number | null;
  weight: number | null;
  height: number | null;
  headCircumference: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeRecord(record: GestationalGrowthRow) {
  return {
    id: record.id,
    week: record.gestationalWeek,
    weight: record.weight,
    length: record.height,
    headCircumference: record.headCircumference,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mergeGestationalRecords(records: GestationalGrowthRow[]) {
  const merged = new Map<number, ReturnType<typeof normalizeRecord>>();

  for (const record of records) {
    if (typeof record.gestationalWeek !== 'number') {
      continue;
    }

    const current = merged.get(record.gestationalWeek);
    const normalized = normalizeRecord(record);

    if (!current) {
      merged.set(record.gestationalWeek, normalized);
      continue;
    }

    merged.set(record.gestationalWeek, {
      ...current,
      weight: normalized.weight ?? current.weight,
      length: normalized.length ?? current.length,
      headCircumference: normalized.headCircumference ?? current.headCircumference,
      updatedAt: normalized.updatedAt > current.updatedAt ? normalized.updatedAt : current.updatedAt,
      createdAt: normalized.createdAt < current.createdAt ? normalized.createdAt : current.createdAt,
    });
  }

  return Array.from(merged.values()).sort((left, right) => (left.week ?? 0) - (right.week ?? 0));
}

async function getOwnedMember(userId: string, memberId: string) {
  return prisma.memberProfile.findFirst({
    where: {
      id: memberId,
      userId,
    },
    select: {
      id: true,
      nickname: true,
      gender: true,
      ageMonths: true,
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> },
) {
  try {
    const { user } = await requirePatientUser(request);
    const { memberId } = await context.params;
    const member = await getOwnedMember(user.id, memberId);

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const rawRecords = await prisma.growthRecord.findMany({
      where: {
        profileId: memberId,
        gestationalWeek: {
          not: null,
        },
      },
      select: {
        id: true,
        gestationalWeek: true,
        weight: true,
        height: true,
        headCircumference: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ gestationalWeek: 'asc' }, { updatedAt: 'asc' }],
    });

    return NextResponse.json({
      member,
      records: mergeGestationalRecords(rawRecords),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status: 401 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> },
) {
  try {
    const { user } = await requirePatientUser(request);
    const body = recordSchema.parse(await request.json());
    const { memberId } = await context.params;
    const member = await getOwnedMember(user.id, memberId);

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const existing = await prisma.growthRecord.findFirst({
      where: {
        profileId: memberId,
        gestationalWeek: body.week,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const data = {
      ageMonths: existing?.ageMonths ?? member.ageMonths ?? 0,
      gestationalWeek: body.week,
      weight: typeof body.weight === 'number' ? body.weight : existing?.weight ?? null,
      height: typeof body.length === 'number' ? body.length : existing?.height ?? null,
      headCircumference:
        typeof body.headCircumference === 'number'
          ? body.headCircumference
          : existing?.headCircumference ?? null,
      weightPercentile: null,
      heightPercentile: null,
      headPercentile: null,
      weightStatus: null,
      heightStatus: null,
      headStatus: null,
      notes: existing?.notes ?? 'gestational-tracker',
    };

    const record = existing
      ? await prisma.growthRecord.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.growthRecord.create({
          data: {
            profileId: memberId,
            ...data,
          },
        });

    return NextResponse.json({
      success: true,
      member,
      record: normalizeRecord(record),
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save growth record' },
      { status },
    );
  }
}
