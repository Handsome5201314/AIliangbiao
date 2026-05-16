import { Prisma, type DoctorNeonateGrowthRecord, type DoctorProfile } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import {
  assertDoctorCanAccessNeonate,
  assertDoctorCanWriteNeonate,
  assertDoctorOwnsNeonate,
  listAccessibleNeonateRoles,
  logNeonateWriteAction,
} from '@/lib/services/care-teams';
import type {
  BirthGestation,
  DoctorNeonateArchiveDetail,
  DoctorNeonateArchiveSummary,
  DoctorNeonateGrowthRecordView,
} from '@/lib/neonates/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TIME_INPUT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const archiveListInclude = {
  doctorProfile: true,
  growthRecords: {
    orderBy: [{ recordDate: 'desc' }, { recordTimeMinutes: 'desc' }, { createdAt: 'desc' }],
    take: 1,
  },
  _count: {
    select: {
      growthRecords: true,
    },
  },
} satisfies Prisma.DoctorNeonateArchiveInclude;

const archiveDetailInclude = {
  doctorProfile: true,
  growthRecords: {
    orderBy: [{ recordDate: 'asc' }, { recordTimeMinutes: 'asc' }, { createdAt: 'asc' }],
  },
  _count: {
    select: {
      growthRecords: true,
    },
  },
} satisfies Prisma.DoctorNeonateArchiveInclude;

type ArchiveWithRelations = Prisma.DoctorNeonateArchiveGetPayload<{
  include: typeof archiveDetailInclude;
}>;

function normalizeBabyName(value: string) {
  return value.trim().replace(/\s+/g, '');
}

function normalizeDateOnly(value: string | Date) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date');
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseTimeMinutes(value: string) {
  const trimmed = value.trim();
  const match = TIME_INPUT_PATTERN.exec(trimmed);

  if (!match) {
    throw new Error('时间格式无效');
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function formatTimeMinutes(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return null;
  }

  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (value % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function assertBirthPrecedesRecord(input: {
  birthDate: string | Date;
  birthTimeMinutes?: number | null;
  recordDate: string | Date;
  recordTimeMinutes?: number | null;
}) {
  const birthDate = normalizeDateOnly(input.birthDate);
  const recordDate = normalizeDateOnly(input.recordDate);
  const dayDelta = calculateDayOffset(birthDate, recordDate);

  if (dayDelta < 0) {
    throw new Error('记录日期不能早于出生日期');
  }

  if (
    dayDelta === 0 &&
    typeof input.birthTimeMinutes === 'number' &&
    typeof input.recordTimeMinutes === 'number' &&
    input.recordTimeMinutes < input.birthTimeMinutes
  ) {
    throw new Error('记录时间不能早于出生时间');
  }
}

function mapDoctorSummary(doctorProfile: Pick<DoctorProfile, 'id' | 'realName' | 'hospitalName' | 'departmentName' | 'title'>) {
  return {
    id: doctorProfile.id,
    realName: doctorProfile.realName,
    hospitalName: doctorProfile.hospitalName,
    departmentName: doctorProfile.departmentName,
    title: doctorProfile.title,
  };
}

function calculateDayOffset(from: Date, to: Date) {
  return Math.round((normalizeDateOnly(to).getTime() - normalizeDateOnly(from).getTime()) / MS_PER_DAY);
}

export function buildDoctorNeonateMatchKey(input: {
  babyName: string;
  sex: string;
  birthGestationWeeks: number;
  birthGestationDays: number;
}) {
  return [
    normalizeBabyName(input.babyName).toLowerCase(),
    input.sex.trim().toLowerCase(),
    String(input.birthGestationWeeks),
    String(input.birthGestationDays),
  ].join('|');
}

export function calculateCurrentGestation(input: {
  birthGestationWeeks: number;
  birthGestationDays: number;
  birthDate: string | Date;
  recordDate: string | Date;
}) {
  const birthDate = normalizeDateOnly(input.birthDate);
  const recordDate = normalizeDateOnly(input.recordDate);
  const dayDelta = calculateDayOffset(birthDate, recordDate);

  if (dayDelta < 0) {
    throw new Error('记录日期不能早于出生日期');
  }

  const totalDays = input.birthGestationWeeks * 7 + input.birthGestationDays + dayDelta;

  return {
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
  };
}

function serializeGrowthRecord(record: DoctorNeonateGrowthRecord): DoctorNeonateGrowthRecordView {
  return {
    id: record.id,
    recordDate: formatDateOnly(record.recordDate),
    recordTime: formatTimeMinutes(record.recordTimeMinutes),
    length: record.length ?? null,
    weight: record.weight ?? null,
    headCircumference: record.headCircumference ?? null,
    bilirubinUmol: record.bilirubinUmol ?? null,
    bilirubinContext: record.bilirubinContext ?? null,
    currentGestation: {
      weeks: record.currentGestationWeeks,
      days: record.currentGestationDays,
    },
  };
}

function serializeArchiveSummary(
  archive: ArchiveWithRelations,
  access?: {
    effectiveAccessRole: 'OWNER' | 'COLLABORATOR' | 'READONLY';
    source: 'OWNER' | 'GRANT';
  },
): DoctorNeonateArchiveSummary {
  const latestRecord = archive.growthRecords[archive.growthRecords.length - 1] ?? archive.growthRecords[0] ?? null;

  return {
    id: archive.id,
    babyName: archive.babyName,
    sex: archive.sex as 'boy' | 'girl',
    birthGestation: {
      weeks: archive.birthGestationWeeks,
      days: archive.birthGestationDays,
    },
    birthDate: formatDateOnly(archive.birthDate),
    birthTime: formatTimeMinutes(archive.birthTimeMinutes),
    effectiveAccessRole: access?.effectiveAccessRole || 'OWNER',
    accessSource: access?.source || 'OWNER',
    ownerDoctorProfile: mapDoctorSummary(archive.doctorProfile),
    recordCount: archive._count.growthRecords,
    latestRecordDate: latestRecord ? formatDateOnly(latestRecord.recordDate) : null,
    latestRecordTime: latestRecord ? formatTimeMinutes(latestRecord.recordTimeMinutes) : null,
    latestMetrics: latestRecord
      ? {
          length: latestRecord.length,
          weight: latestRecord.weight,
          headCircumference: latestRecord.headCircumference,
          bilirubinUmol: latestRecord.bilirubinUmol,
        }
      : null,
  };
}

function serializeArchiveDetail(
  archive: ArchiveWithRelations,
  access?: {
    effectiveAccessRole: 'OWNER' | 'COLLABORATOR' | 'READONLY';
    source: 'OWNER' | 'GRANT';
  },
): DoctorNeonateArchiveDetail {
  return {
    ...serializeArchiveSummary(archive, access),
    records: archive.growthRecords.map(serializeGrowthRecord),
  };
}

async function getDoctorOwnedArchiveOrThrow(doctorProfileId: string, archiveId: string) {
  const archive = await prisma.doctorNeonateArchive.findFirst({
    where: {
      id: archiveId,
      doctorProfileId,
    },
    include: archiveDetailInclude,
  });

  if (!archive) {
    throw new Error('未找到该病房宝宝档案');
  }

  return archive;
}

export async function listDoctorNeonateArchives(input: {
  doctorProfileId: string;
  search?: string;
  sex?: 'boy' | 'girl' | 'ALL';
  birthGestationWeeksFrom?: number;
  birthGestationWeeksTo?: number;
}) {
  const accessible = await listAccessibleNeonateRoles(input.doctorProfileId);
  const archiveIds = accessible.map((item) => item.archiveId);

  if (!archiveIds.length) {
    return [];
  }

  const archives = await prisma.doctorNeonateArchive.findMany({
    where: {
      id: { in: archiveIds },
      babyName: input.search
        ? {
            contains: input.search.trim(),
            mode: 'insensitive',
          }
        : undefined,
      sex: input.sex && input.sex !== 'ALL' ? input.sex : undefined,
      birthGestationWeeks:
        typeof input.birthGestationWeeksFrom === 'number' || typeof input.birthGestationWeeksTo === 'number'
          ? {
              ...(typeof input.birthGestationWeeksFrom === 'number'
                ? { gte: input.birthGestationWeeksFrom }
                : {}),
              ...(typeof input.birthGestationWeeksTo === 'number'
                ? { lte: input.birthGestationWeeksTo }
                : {}),
            }
          : undefined,
    },
    include: archiveListInclude,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const accessMap = new Map(accessible.map((item) => [item.archiveId, item]));
  return archives.map((archive) => serializeArchiveSummary(archive, accessMap.get(archive.id)));
}

export async function createOrMatchDoctorNeonateArchive(input: {
  doctorProfileId: string;
  babyName: string;
  sex: 'boy' | 'girl';
  birthGestationWeeks: number;
  birthGestationDays: number;
  birthDate: string;
  birthTime: string;
}) {
  const normalizedMatchKey = buildDoctorNeonateMatchKey(input);
  const birthTimeMinutes = parseTimeMinutes(input.birthTime);

  const matches = await prisma.doctorNeonateArchive.findMany({
    where: {
      doctorProfileId: input.doctorProfileId,
      normalizedMatchKey,
    },
    include: archiveListInclude,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  if (matches.length === 1) {
    return {
      status: 'matched' as const,
      archive: serializeArchiveSummary(matches[0]),
    };
  }

  if (matches.length > 1) {
    return {
      status: 'multiple_matches' as const,
      candidates: matches.map((archive) => serializeArchiveSummary(archive)),
    };
  }

  const created = await prisma.doctorNeonateArchive.create({
    data: {
      doctorProfileId: input.doctorProfileId,
      babyName: input.babyName.trim(),
      sex: input.sex,
      birthGestationWeeks: input.birthGestationWeeks,
      birthGestationDays: input.birthGestationDays,
      birthDate: normalizeDateOnly(input.birthDate),
      birthTimeMinutes,
      normalizedMatchKey,
    },
    include: archiveListInclude,
  });

  return {
    status: 'created' as const,
    archive: serializeArchiveSummary(created),
  };
}

export async function getDoctorNeonateArchiveDetail(doctorProfileId: string, archiveId: string) {
  const access = await assertDoctorCanAccessNeonate(archiveId, doctorProfileId);
  const archive = await prisma.doctorNeonateArchive.findUnique({
    where: { id: archiveId },
    include: archiveDetailInclude,
  });

  if (!archive) {
    throw new Error('未找到该病房宝宝档案');
  }

  return serializeArchiveDetail(archive, access);
}

export async function updateDoctorNeonateArchive(input: {
  doctorProfileId: string;
  archiveId: string;
  babyName?: string;
  sex?: 'boy' | 'girl';
  birthGestationWeeks?: number;
  birthGestationDays?: number;
  birthDate?: string;
  birthTime?: string;
}) {
  await assertDoctorOwnsNeonate(input.archiveId, input.doctorProfileId);
  const archive = await getDoctorOwnedArchiveOrThrow(input.doctorProfileId, input.archiveId);

  const nextBabyName = input.babyName?.trim() || archive.babyName;
  const nextSex = input.sex || (archive.sex as 'boy' | 'girl');
  const nextBirthGestationWeeks = input.birthGestationWeeks ?? archive.birthGestationWeeks;
  const nextBirthGestationDays = input.birthGestationDays ?? archive.birthGestationDays;
  const nextBirthDate = input.birthDate ? normalizeDateOnly(input.birthDate) : normalizeDateOnly(archive.birthDate);
  const nextBirthTimeMinutes =
    input.birthTime !== undefined ? parseTimeMinutes(input.birthTime) : archive.birthTimeMinutes;

  const invalidExistingRecord = archive.growthRecords.find((record) => {
    try {
      assertBirthPrecedesRecord({
        birthDate: nextBirthDate,
        birthTimeMinutes: nextBirthTimeMinutes,
        recordDate: record.recordDate,
        recordTimeMinutes: record.recordTimeMinutes,
      });
      return false;
    } catch {
      return true;
    }
  });

  if (invalidExistingRecord) {
    throw new Error('新的出生日期晚于现有记录日期，无法保存');
  }

  const normalizedMatchKey = buildDoctorNeonateMatchKey({
    babyName: nextBabyName,
    sex: nextSex,
    birthGestationWeeks: nextBirthGestationWeeks,
    birthGestationDays: nextBirthGestationDays,
  });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.doctorNeonateArchive.update({
      where: { id: archive.id },
      data: {
        babyName: nextBabyName,
        sex: nextSex,
        birthGestationWeeks: nextBirthGestationWeeks,
        birthGestationDays: nextBirthGestationDays,
        birthDate: nextBirthDate,
        birthTimeMinutes: nextBirthTimeMinutes,
        normalizedMatchKey,
      },
    });

    for (const record of archive.growthRecords) {
      const currentGestation = calculateCurrentGestation({
        birthGestationWeeks: nextBirthGestationWeeks,
        birthGestationDays: nextBirthGestationDays,
        birthDate: nextBirthDate,
        recordDate: record.recordDate,
      });

      await tx.doctorNeonateGrowthRecord.update({
        where: { id: record.id },
        data: {
          currentGestationWeeks: currentGestation.weeks,
          currentGestationDays: currentGestation.days,
        },
      });
    }

    return tx.doctorNeonateArchive.findUniqueOrThrow({
      where: { id: archive.id },
      include: archiveDetailInclude,
    });
  });

  await logNeonateWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    archiveId: input.archiveId,
    action: 'NEONATE_ARCHIVE_UPDATED',
    metadata: {
      babyName: nextBabyName,
      sex: nextSex,
      birthGestationWeeks: nextBirthGestationWeeks,
      birthGestationDays: nextBirthGestationDays,
      birthDate: formatDateOnly(nextBirthDate),
      birthTime: formatTimeMinutes(nextBirthTimeMinutes),
    },
  });

  return serializeArchiveDetail(updated, {
    effectiveAccessRole: 'OWNER',
    source: 'OWNER',
  });
}

export async function createDoctorNeonateGrowthRecord(input: {
  doctorProfileId: string;
  archiveId: string;
  recordDate: string;
  recordTime: string;
  length?: number;
  weight?: number;
  headCircumference?: number;
  bilirubinUmol?: number;
  bilirubinContext?: 'AMBIENT' | 'PHOTOTHERAPY';
}) {
  await assertDoctorCanWriteNeonate(input.archiveId, input.doctorProfileId);
  const archive = await prisma.doctorNeonateArchive.findUnique({
    where: { id: input.archiveId },
    include: {
      doctorProfile: true,
      growthRecords: true,
      _count: {
        select: {
          growthRecords: true,
        },
      },
    },
  });

  if (!archive) {
    throw new Error('未找到该病房宝宝档案');
  }
  const normalizedRecordDate = normalizeDateOnly(input.recordDate);
  const recordTimeMinutes = parseTimeMinutes(input.recordTime);
  assertBirthPrecedesRecord({
    birthDate: archive.birthDate,
    birthTimeMinutes: archive.birthTimeMinutes,
    recordDate: normalizedRecordDate,
    recordTimeMinutes,
  });
  const currentGestation = calculateCurrentGestation({
    birthGestationWeeks: archive.birthGestationWeeks,
    birthGestationDays: archive.birthGestationDays,
    birthDate: archive.birthDate,
    recordDate: normalizedRecordDate,
  });

  if (
    input.length === undefined &&
    input.weight === undefined &&
    input.headCircumference === undefined &&
    input.bilirubinUmol === undefined
  ) {
    throw new Error('至少填写一个指标后再保存');
  }

  if (input.bilirubinUmol !== undefined && !input.bilirubinContext) {
    throw new Error('填写胆红素时必须标注环境状态');
  }

  const updateData = {
    recordTimeMinutes,
    ...(input.length !== undefined ? { length: input.length } : {}),
    ...(input.weight !== undefined ? { weight: input.weight } : {}),
    ...(input.headCircumference !== undefined ? { headCircumference: input.headCircumference } : {}),
    ...(input.bilirubinUmol !== undefined ? { bilirubinUmol: input.bilirubinUmol } : {}),
    ...(input.bilirubinUmol !== undefined ? { bilirubinContext: input.bilirubinContext } : {}),
    currentGestationWeeks: currentGestation.weeks,
    currentGestationDays: currentGestation.days,
  };

  const record = await prisma.doctorNeonateGrowthRecord.upsert({
    where: {
      archiveId_recordDate_recordTimeMinutes: {
        archiveId: archive.id,
        recordDate: normalizedRecordDate,
        recordTimeMinutes,
      },
    },
    update: updateData,
    create: {
      archiveId: archive.id,
      recordDate: normalizedRecordDate,
      recordTimeMinutes,
      length: input.length ?? null,
      weight: input.weight ?? null,
      headCircumference: input.headCircumference ?? null,
      bilirubinUmol: input.bilirubinUmol ?? null,
      bilirubinContext: input.bilirubinUmol !== undefined ? input.bilirubinContext : null,
      currentGestationWeeks: currentGestation.weeks,
      currentGestationDays: currentGestation.days,
    },
  });

  const detail = await prisma.doctorNeonateArchive.findUniqueOrThrow({
    where: { id: archive.id },
    include: archiveDetailInclude,
  });

  await logNeonateWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    archiveId: input.archiveId,
    action: 'NEONATE_RECORD_SAVED',
    metadata: {
      recordDate: formatDateOnly(normalizedRecordDate),
      recordTime: formatTimeMinutes(recordTimeMinutes),
      length: input.length,
      weight: input.weight,
      headCircumference: input.headCircumference,
      bilirubinUmol: input.bilirubinUmol ?? null,
      bilirubinContext: input.bilirubinUmol !== undefined ? input.bilirubinContext : null,
      currentGestationWeeks: currentGestation.weeks,
      currentGestationDays: currentGestation.days,
    },
  });

  const access = await assertDoctorCanAccessNeonate(input.archiveId, input.doctorProfileId);

  return {
    record: serializeGrowthRecord(record),
    archive: serializeArchiveDetail(detail, access),
  };
}
