import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import {
  createResearchSubjectId,
  RESEARCH_DERIVED_FIELD_DICTIONARY,
  type ResearchDerivedFieldName,
} from '@/lib/services/research-export';

type FieldMapping = Record<string, ResearchDerivedFieldName>;
type RawCsvRow = Record<string, string>;

type HistoricalImportRow = {
  rowNumber: number;
  raw: RawCsvRow;
  normalized: Partial<Record<ResearchDerivedFieldName, unknown>>;
  qualityFlags: string[];
  sourceRowHash: string;
  researchSubjectId: string | null;
};
type ResearchImportDb = {
  researchImportBatch?: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string } & Record<string, unknown>>;
  };
  researchFieldMapping?: {
    createMany(args: { data: Array<Record<string, unknown>> }): Promise<unknown>;
  };
  researchImportRow?: {
    createMany(args: { data: Array<Record<string, unknown>> }): Promise<unknown>;
  };
};

const CANONICAL_FIELDS = new Set<ResearchDerivedFieldName>(
  RESEARCH_DERIVED_FIELD_DICTIONARY.map((field) => field.name)
);

const NUMBER_FIELDS = new Set<ResearchDerivedFieldName>([
  'age_months',
  'baseline_score',
  'doctor_assessment_duration_seconds',
  'pre_score',
  'post_score',
]);

const BOOLEAN_FIELDS = new Set<ResearchDerivedFieldName>([
  'report_viewed',
  'education_pushed',
  'education_read',
  'doctor_review_completed',
  'one_month_reassessment_completed',
  'three_month_reassessment_completed',
  'three_month_window_75_105_completed',
  'hospitalized',
]);

const JSON_FIELDS = new Set<ResearchDerivedFieldName>(['dimension_scores', 'data_quality_flags']);

const MISSING_FLAG_BY_FIELD: Partial<Record<ResearchDerivedFieldName, string>> = {
  research_subject_id: 'MISSING_RESEARCH_SUBJECT_ID',
  baseline_date: 'MISSING_BASELINE_DATE',
  baseline_score: 'MISSING_BASELINE_SCORE',
  scale_id: 'MISSING_SCALE_ID',
  three_month_reassessment_completed: 'MISSING_THREE_MONTH_REASSESSMENT',
};

function db(tx: unknown = prisma): ResearchImportDb {
  return tx as ResearchImportDb;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(csvContent: string) {
  const lines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('CSV content is empty');
  }

  const headers = parseCsvLine(lines[0]);
  if (headers.length === 0 || headers.some((header) => !header)) {
    throw new Error('CSV header contains empty field names');
  }

  return lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    return {
      rowNumber: rowIndex + 2,
      raw: Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])),
    };
  });
}

function assertValidFieldMapping(fieldMapping: FieldMapping) {
  const entries = Object.entries(fieldMapping);
  if (entries.length === 0) {
    throw new Error('fieldMapping is required');
  }

  for (const [sourceField, canonicalField] of entries) {
    if (!sourceField.trim()) {
      throw new Error('fieldMapping contains an empty source field');
    }
    if (!CANONICAL_FIELDS.has(canonicalField)) {
      throw new Error(`Unsupported research field mapping target: ${canonicalField}`);
    }
  }
}

function normalizeNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeBoolean(value: string) {
  if (!value.trim()) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', '是', '已', '已完成', '完成'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', '否', '未', '未完成'].includes(normalized)) {
    return false;
  }

  return null;
}

function normalizeJson(value: string) {
  if (!value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeMappedValue(fieldName: ResearchDerivedFieldName, value: string) {
  if (NUMBER_FIELDS.has(fieldName)) {
    return normalizeNumber(value);
  }

  if (BOOLEAN_FIELDS.has(fieldName)) {
    return normalizeBoolean(value);
  }

  if (JSON_FIELDS.has(fieldName)) {
    return normalizeJson(value);
  }

  return value.trim() ? value.trim() : null;
}

function sourceRowHash(raw: RawCsvRow) {
  return crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex');
}

function qualityFlagsForRow(normalized: Partial<Record<ResearchDerivedFieldName, unknown>>, mappedFields: ResearchDerivedFieldName[]) {
  const flags = new Set<string>();
  for (const fieldName of mappedFields) {
    const flagName = MISSING_FLAG_BY_FIELD[fieldName];
    if (!flagName) {
      continue;
    }

    const value = normalized[fieldName];
    if (value === null || value === undefined || value === '') {
      flags.add(flagName);
    }
  }

  return [...flags];
}

function normalizeResearchSubjectId(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.startsWith('RS-') ? trimmed : createResearchSubjectId(trimmed);
}

function buildQualitySummary(rows: HistoricalImportRow[]) {
  const flagCounts: Record<string, number> = {};
  for (const row of rows) {
    for (const flag of row.qualityFlags) {
      flagCounts[flag] = (flagCounts[flag] || 0) + 1;
    }
  }

  return {
    totalRows: rows.length,
    rowsWithQualityFlags: rows.filter((row) => row.qualityFlags.length > 0).length,
    flagCounts,
  };
}

export function buildHistoricalResearchImportRows(input: {
  csvContent: string;
  fieldMapping: FieldMapping;
}) {
  assertValidFieldMapping(input.fieldMapping);
  const parsedRows = parseCsv(input.csvContent);
  const mappedFields = Object.values(input.fieldMapping);
  const rows = parsedRows.map((row): HistoricalImportRow => {
    const normalized: Partial<Record<ResearchDerivedFieldName, unknown>> = {};

    for (const [sourceField, canonicalField] of Object.entries(input.fieldMapping)) {
      normalized[canonicalField] = normalizeMappedValue(canonicalField, row.raw[sourceField] ?? '');
    }

    const qualityFlags = qualityFlagsForRow(normalized, mappedFields);
    if (qualityFlags.length > 0) {
      normalized.data_quality_flags = qualityFlags;
    }

    return {
      rowNumber: row.rowNumber,
      raw: row.raw,
      normalized,
      qualityFlags,
      sourceRowHash: sourceRowHash(row.raw),
      researchSubjectId: normalizeResearchSubjectId(normalized.research_subject_id),
    };
  });

  return {
    rows,
    qualitySummary: buildQualitySummary(rows),
  };
}

export async function importHistoricalResearchCsv(input: {
  sourceName: string;
  csvContent: string;
  fieldMapping: FieldMapping;
  actor?: {
    requestedByUserId?: string | null;
    uploadedByDoctorProfileId?: string | null;
  };
  persistBatch?: boolean;
}) {
  const built = buildHistoricalResearchImportRows({
    csvContent: input.csvContent,
    fieldMapping: input.fieldMapping,
  });

  if (input.persistBatch === false) {
    return {
      batch: null,
      rows: built.rows,
      qualitySummary: built.qualitySummary,
    };
  }

  const database = db();
  if (!database.researchImportBatch?.create || !database.researchFieldMapping?.createMany || !database.researchImportRow?.createMany) {
    throw new Error('Research import persistence models are not available');
  }

  const batch = await database.researchImportBatch.create({
    data: {
      uploadedByDoctorProfileId: input.actor?.uploadedByDoctorProfileId || null,
      requestedByUserId: input.actor?.requestedByUserId || null,
      sourceName: input.sourceName,
      status: built.qualitySummary.rowsWithQualityFlags > 0 ? 'VALIDATED' : 'IMPORTED',
      fieldMapping: input.fieldMapping,
      qualitySummary: built.qualitySummary,
      importedRowCount: built.rows.length,
      completedAt: new Date(),
    },
  });

  await database.researchFieldMapping.createMany({
    data: Object.entries(input.fieldMapping).map(([sourceField, canonicalField]) => ({
      batchId: batch.id,
      sourceField,
      canonicalField,
      required: Boolean(RESEARCH_DERIVED_FIELD_DICTIONARY.find((field) => field.name === canonicalField)?.required),
    })),
  });

  await database.researchImportRow.createMany({
    data: built.rows.map((row) => ({
      batchId: batch.id,
      rowNumber: row.rowNumber,
      sourceRowHash: row.sourceRowHash,
      researchSubjectId: row.researchSubjectId,
      rawData: row.raw,
      normalizedData: row.normalized,
      qualityFlags: row.qualityFlags,
      importStatus: row.qualityFlags.length > 0 ? 'VALIDATED_WITH_FLAGS' : 'IMPORTED',
    })),
  });

  return {
    batch,
    rows: built.rows,
    qualitySummary: built.qualitySummary,
  };
}
