import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';

export type ResearchExportFormat = 'json' | 'csv';

export type ResearchExportTableName =
  | 'child_baseline'
  | 'assessment_session'
  | 'assessment_history'
  | 'scale_score'
  | 'ai_interaction'
  | 'followup'
  | 'report_view'
  | 'inpatient_record'
  | 'outcome_3m';

type ResearchExportRow = Record<string, unknown>;

type ResearchExportTables = Record<ResearchExportTableName, ResearchExportRow[]>;

export const DIRECT_IDENTIFIER_FIELDS = new Set([
  'id',
  'userId',
  'memberProfileId',
  'profileId',
  'doctorProfileId',
  'requestedByUserId',
  'email',
  'passwordHash',
  'deviceId',
  'nickname',
  'contactPhone',
  'realName',
  'respondentRealName',
  'respondentPhone',
  'licenseNo',
  'guardianName',
  'signatureName',
]);

const EXPORT_TABLE_ORDER: ResearchExportTableName[] = [
  'child_baseline',
  'assessment_session',
  'assessment_history',
  'scale_score',
  'ai_interaction',
  'followup',
  'report_view',
  'inpatient_record',
  'outcome_3m',
];

const EXPORT_SECRET =
  process.env.RESEARCH_EXPORT_SECRET ||
  process.env.APP_SESSION_SECRET ||
  process.env.JWT_SECRET ||
  'local-research-export-secret';

function db() {
  return prisma as any;
}

export function createResearchSubjectId(sourceId: string | null | undefined) {
  if (!sourceId) {
    return null;
  }

  const digest = crypto.createHmac('sha256', EXPORT_SECRET).update(sourceId).digest('hex');
  return `RS-${digest.slice(0, 16).toUpperCase()}`;
}

function createExportRowId(sourceId: string | null | undefined) {
  if (!sourceId) {
    return null;
  }

  const digest = crypto.createHmac('sha256', EXPORT_SECRET).update(`row:${sourceId}`).digest('hex');
  return `RW-${digest.slice(0, 16).toUpperCase()}`;
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !DIRECT_IDENTIFIER_FIELDS.has(key))
        .map(([key, nestedValue]) => [key, serializeValue(nestedValue)])
    );
  }

  return value;
}

function compactRow(row: ResearchExportRow): ResearchExportRow {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, serializeValue(value)])
  );
}

function baseResearchRow(record: Record<string, unknown>, memberKey?: string | null) {
  const resolvedMemberKey =
    memberKey ||
    (typeof record.memberProfileId === 'string' ? record.memberProfileId : null) ||
    (typeof record.profileId === 'string' ? record.profileId : null);

  return {
    rowKey: createExportRowId(typeof record.id === 'string' ? record.id : null),
    researchSubjectId: createResearchSubjectId(resolvedMemberKey),
  };
}

function deidentifyRecord(
  record: Record<string, unknown>,
  extra: ResearchExportRow = {}
): ResearchExportRow {
  const row: ResearchExportRow = {
    ...baseResearchRow(record),
    ...extra,
  };

  for (const [key, value] of Object.entries(record)) {
    if (DIRECT_IDENTIFIER_FIELDS.has(key)) {
      continue;
    }

    row[key] = value;
  }

  return compactRow(row);
}

async function readModelRows(modelName: string, options: Record<string, unknown> = {}) {
  const model = db()[modelName];
  if (!model?.findMany) {
    return [];
  }

  return model.findMany(options);
}

function toCsvCell(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function tablesToCsv(tables: ResearchExportTables) {
  const lines = ['table,row'];

  for (const tableName of EXPORT_TABLE_ORDER) {
    for (const row of tables[tableName]) {
      lines.push(`${toCsvCell(tableName)},${toCsvCell(row)}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

async function buildResearchTables(): Promise<ResearchExportTables> {
  const [
    childBaselines,
    assessmentSessions,
    assessmentHistories,
    scaleScores,
    aiInteractions,
    followUps,
    reportViews,
    inpatientRecords,
    outcome3mRecords,
  ] = await Promise.all([
    readModelRows('childBaseline', { orderBy: { createdAt: 'asc' } }),
    db().assessmentSession.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        profileId: true,
        scaleId: true,
        scaleVersion: true,
        channel: true,
        language: true,
        status: true,
        currentQuestionIndex: true,
        totalScore: true,
        conclusion: true,
        resultDetails: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    }),
    db().assessmentHistory.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        profileId: true,
        scaleId: true,
        scaleVersion: true,
        totalScore: true,
        conclusion: true,
        resultDetails: true,
        source: true,
        respondentGender: true,
        respondentAgeMonths: true,
        createdAt: true,
      },
    }),
    readModelRows('scaleScore', { orderBy: { createdAt: 'asc' } }),
    readModelRows('aiInteraction', { orderBy: { createdAt: 'asc' } }),
    readModelRows('followUp', { orderBy: { createdAt: 'asc' } }),
    readModelRows('reportView', { orderBy: { viewedAt: 'asc' } }),
    readModelRows('inpatientRecord', { orderBy: { createdAt: 'asc' } }),
    readModelRows('outcome3m', { orderBy: { createdAt: 'asc' } }),
  ]);

  return {
    child_baseline: childBaselines.map((record: Record<string, unknown>) =>
      deidentifyRecord(record, {
        researchSubjectId: createResearchSubjectId(
          typeof record.memberProfileId === 'string' ? record.memberProfileId : null
        ),
      })
    ),
    assessment_session: assessmentSessions.map((record: Record<string, unknown>) =>
      deidentifyRecord(record, {
        assessmentSessionKey: createExportRowId(typeof record.id === 'string' ? record.id : null),
      })
    ),
    assessment_history: assessmentHistories.map((record: Record<string, unknown>) =>
      deidentifyRecord(record, {
        assessmentHistoryKey: createExportRowId(typeof record.id === 'string' ? record.id : null),
      })
    ),
    scale_score: scaleScores.map((record: Record<string, unknown>) => deidentifyRecord(record)),
    ai_interaction: aiInteractions.map((record: Record<string, unknown>) => deidentifyRecord(record)),
    followup: followUps.map((record: Record<string, unknown>) => deidentifyRecord(record)),
    report_view: reportViews.map((record: Record<string, unknown>) => deidentifyRecord(record)),
    inpatient_record: inpatientRecords.map((record: Record<string, unknown>) => deidentifyRecord(record)),
    outcome_3m: outcome3mRecords.map((record: Record<string, unknown>) => deidentifyRecord(record)),
  };
}

export async function exportResearchDataset(input: { format: ResearchExportFormat }) {
  const tables = await buildResearchTables();
  const generatedAt = new Date().toISOString();

  if (input.format === 'csv') {
    return {
      format: input.format,
      generatedAt,
      tables,
      content: tablesToCsv(tables),
      mimeType: 'text/csv; charset=utf-8',
      filename: `research-export-${generatedAt.slice(0, 10)}.csv`,
    };
  }

  const jsonPayload = {
    generatedAt,
    deidentification: {
      subjectId: 'HMAC-SHA256 over member profile identifier',
      directIdentifierFields: [...DIRECT_IDENTIFIER_FIELDS],
    },
    tables,
  };

  return {
    format: input.format,
    generatedAt,
    tables,
    content: JSON.stringify(jsonPayload, null, 2),
    mimeType: 'application/json; charset=utf-8',
    filename: `research-export-${generatedAt.slice(0, 10)}.json`,
  };
}
