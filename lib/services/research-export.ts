import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';

export type ResearchExportFormat = 'json' | 'csv';

export type ResearchExportTableName =
  | 'child_baseline'
  | 'assessment_session'
  | 'assessment_history'
  | 'scale_score'
  | 'ai_interaction'
  | 'ai_conversation_session'
  | 'ai_conversation_event'
  | 'followup'
  | 'report_view'
  | 'inpatient_record'
  | 'outcome_3m'
  | 'research_derived_dataset';

type ResearchExportRow = Record<string, unknown>;

type ResearchExportTables = Record<ResearchExportTableName, ResearchExportRow[]>;
type ResearchModelDelegate = {
  findMany?: (options?: Record<string, unknown>) => Promise<RawResearchRecord[]>;
  create?: (args: { data: Record<string, unknown> }) => Promise<RawResearchRecord>;
};
type ResearchDb = Partial<Record<string, ResearchModelDelegate>>;

type ResearchActor = {
  actorType: 'ADMIN' | 'DOCTOR';
  actorId: string;
  adminId?: string | null;
  userId?: string | null;
  doctorProfileId?: string | null;
};

type RawResearchRecord = Record<string, unknown>;

export const DIRECT_IDENTIFIER_FIELDS = new Set<string>([
  'id',
  'userId',
  'memberProfileId',
  'profileId',
  'doctorProfileId',
  'requestedByUserId',
  'requestedByAdminId',
  'email',
  'phone',
  'mobile',
  'passwordHash',
  'deviceId',
  'rawDeviceId',
  'nickname',
  'name',
  'realName',
  'contactPhone',
  'respondentRealName',
  'respondentPhone',
  'licenseNo',
  'guardianName',
  'signatureName',
  'idCardNo',
  'identityNo',
  'outpatientNo',
  'inpatientNo',
  'admissionId',
  'transcriptText',
  'assistantText',
  'rawTranscript',
]);

const AI_CONVERSATION_RESEARCH_EXPORT_POLICY = 'confirmed_answer_only';

export const RESEARCH_DERIVED_FIELD_DICTIONARY = [
  { name: 'research_subject_id', required: true, description: 'HMAC 脱敏研究编号' },
  { name: 'group_type', required: false, description: '历史对照组或系统干预组' },
  { name: 'baseline_date', required: true, description: '基线日期' },
  { name: 'age_months', required: false, description: '月龄' },
  { name: 'sex', required: false, description: '性别' },
  { name: 'clinical_phenotype', required: false, description: '临床表型' },
  { name: 'diagnosis_label', required: false, description: '医生或历史资料诊断标签' },
  { name: 'scale_id', required: false, description: '量表 ID' },
  { name: 'scale_version', required: false, description: '量表版本' },
  { name: 'baseline_score', required: false, description: '基线总分' },
  { name: 'baseline_risk_level', required: false, description: '基线风险层级' },
  { name: 'dimension_scores', required: false, description: '维度分 JSON' },
  { name: 'report_viewed', required: true, description: '报告是否查看' },
  { name: 'education_pushed', required: true, description: '健康教育是否推送' },
  { name: 'education_read', required: true, description: '健康教育是否阅读' },
  { name: 'doctor_review_completed', required: true, description: '医生复核是否完成' },
  { name: 'doctor_assessment_duration_seconds', required: false, description: '医生评估/复核耗时' },
  { name: 'one_month_reassessment_completed', required: true, description: '1 个月复测是否完成' },
  { name: 'three_month_reassessment_completed', required: true, description: '3 个月复测是否完成' },
  { name: 'three_month_window_75_105_completed', required: true, description: '75-105 天窗口内是否完成复测' },
  { name: 'lost_to_followup_reason', required: false, description: '失访原因' },
  { name: 'hospitalized', required: true, description: '是否住院' },
  { name: 'intervention_subgroup', required: false, description: '干预亚组' },
  { name: 'pre_score', required: false, description: '干预前分数' },
  { name: 'post_score', required: false, description: '干预后分数' },
  { name: 'data_quality_flags', required: true, description: '缺失、异常、来源不一致等质量标记' },
] as const;

export type ResearchDerivedFieldName = (typeof RESEARCH_DERIVED_FIELD_DICTIONARY)[number]['name'];

export type ResearchDerivedRow = {
  [K in ResearchDerivedFieldName]: unknown;
};

const RESEARCH_DATASET_VERSION = 'research-derived-v1';
const FIELD_SET_VERSION = '2026.06.phase7';

const EXPORT_TABLE_ORDER: ResearchExportTableName[] = [
  'child_baseline',
  'assessment_session',
  'assessment_history',
  'scale_score',
  'ai_interaction',
  'ai_conversation_session',
  'ai_conversation_event',
  'followup',
  'report_view',
  'inpatient_record',
  'outcome_3m',
  'research_derived_dataset',
];

const RESEARCH_DERIVED_FIELD_NAMES = RESEARCH_DERIVED_FIELD_DICTIONARY.map((field) => field.name);

function db(tx: unknown = prisma): ResearchDb {
  return tx as ResearchDb;
}

function resolveExportSecret(secret = process.env.RESEARCH_EXPORT_SECRET) {
  if (!secret) {
    throw new Error('RESEARCH_EXPORT_SECRET is required for research de-identification');
  }

  return secret;
}

export function createResearchSubjectId(
  sourceId: string | null | undefined,
  secret = process.env.RESEARCH_EXPORT_SECRET
) {
  if (!sourceId) {
    return null;
  }

  const digest = crypto.createHmac('sha256', resolveExportSecret(secret)).update(sourceId).digest('hex');
  return `RS-${digest.slice(0, 16).toUpperCase()}`;
}

function createExportRowId(sourceId: string | null | undefined) {
  if (!sourceId) {
    return null;
  }

  const digest = crypto.createHmac('sha256', resolveExportSecret()).update(`row:${sourceId}`).digest('hex');
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

export function sanitizeResearchExportRow(row: ResearchExportRow): ResearchExportRow {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key, value]) => !DIRECT_IDENTIFIER_FIELDS.has(key) && value !== undefined)
      .map(([key, value]) => [key, serializeValue(value)])
  );
}

function baseResearchRow(record: RawResearchRecord, memberKey?: string | null) {
  const resolvedMemberKey =
    memberKey ||
    (typeof record.memberProfileId === 'string' ? record.memberProfileId : null) ||
    (typeof record.profileId === 'string' ? record.profileId : null);

  return {
    row_key: createExportRowId(typeof record.id === 'string' ? record.id : null),
    research_subject_id: createResearchSubjectId(resolvedMemberKey),
  };
}

function deidentifyRecord(record: RawResearchRecord, extra: ResearchExportRow = {}): ResearchExportRow {
  return sanitizeResearchExportRow({
    ...baseResearchRow(record),
    ...record,
    ...extra,
  });
}

async function readModelRows(modelName: string, options: Record<string, unknown> = {}) {
  const model = db()[modelName];
  if (!model?.findMany) {
    return [];
  }

  return model.findMany(options);
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function getDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function toDateOnly(value: unknown) {
  const date = getDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function isThreeMonthWindowCompleted(input: {
  baselineDate: unknown;
  completedAt: unknown;
}) {
  const baselineDate = getDate(input.baselineDate);
  const completedAt = getDate(input.completedAt);
  if (!baselineDate || !completedAt) {
    return false;
  }

  const elapsedDays = Math.floor((completedAt.getTime() - baselineDate.getTime()) / 86_400_000);
  return elapsedDays >= 75 && elapsedDays <= 105;
}

function sortByDateAscending<T extends RawResearchRecord>(rows: T[], fieldName: string): T[] {
  return [...rows].sort((left, right) => {
    const leftTime = getDate(left[fieldName])?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightTime = getDate(right[fieldName])?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });
}

function groupByMember(rows: RawResearchRecord[], memberFieldName = 'memberProfileId') {
  const grouped = new Map<string, RawResearchRecord[]>();
  for (const row of rows) {
    const memberId = getString(row[memberFieldName]);
    if (!memberId) {
      continue;
    }

    const existing = grouped.get(memberId) || [];
    existing.push(row);
    grouped.set(memberId, existing);
  }

  return grouped;
}

function getCompletedAtFromTask(task: RawResearchRecord) {
  const completedHistory = getRecord(task.completedAssessmentHistory);
  const completedSession = getRecord(task.completedAssessmentSession);

  return (
    getDate(task.completedAt) ||
    getDate(completedHistory.createdAt) ||
    getDate(completedSession.completedAt) ||
    getDate(task.updatedAt)
  );
}

function resolveFollowUpTaskCompletion(tasks: RawResearchRecord[], taskType: 'ONE_MONTH' | 'THREE_MONTH') {
  const matching = tasks.filter((task) => getString(task.taskType) === taskType);
  const completed = matching.find((task) => getString(task.status) === 'COMPLETED' || getCompletedAtFromTask(task));
  return {
    completed: Boolean(completed),
    completedAt: completed ? getCompletedAtFromTask(completed) : null,
    lostReason:
      getString(matching.find((task) => getString(task.status) === 'LOST_TO_FOLLOWUP')?.lostToFollowupReason) ||
      null,
  };
}

function resolveOutcomeCompletion(outcomeRows: RawResearchRecord[]) {
  const measured = sortByDateAscending(outcomeRows, 'measuredAt').find((row) => getDate(row.measuredAt));
  return measured
    ? {
        completed: true,
        completedAt: getDate(measured.measuredAt),
        followUpScore: getNumber(measured.followUpScore),
        baselineScore: getNumber(measured.baselineScore),
        metadata: getRecord(measured.metadata),
      }
    : {
        completed: false,
        completedAt: null,
        followUpScore: null,
        baselineScore: null,
        metadata: {},
      };
}

function hasEducationRead(row: RawResearchRecord) {
  return Boolean(getDate(row.readAt) || getDate(row.confirmedAt) || getString(row.deliveryStatus) === 'READ');
}

function resolveBaseline(input: {
  baseline: RawResearchRecord | null;
  assessmentRows: RawResearchRecord[];
  sessionRows: RawResearchRecord[];
}) {
  const snapshot = getRecord(input.baseline?.baselineSnapshot);
  const firstAssessment = sortByDateAscending(input.assessmentRows, 'createdAt')[0] || null;
  const firstSession = sortByDateAscending(input.sessionRows, 'createdAt')[0] || null;
  const baselineDate =
    getDate(snapshot.baselineDate) ||
    getDate(snapshot.baseline_date) ||
    getDate(input.baseline?.createdAt) ||
    getDate(firstAssessment?.createdAt) ||
    getDate(firstSession?.createdAt);
  const baselineScore =
    getNumber(snapshot.baselineScore) ??
    getNumber(snapshot.baseline_score) ??
    getNumber(firstAssessment?.totalScore) ??
    getNumber(firstSession?.totalScore);

  return {
    snapshot,
    firstAssessment,
    firstSession,
    baselineDate,
    baselineScore,
  };
}

export function calculatePrimaryOutcome(rows: ResearchDerivedRow[]) {
  const denominator = rows.filter((row) => Boolean(row.baseline_date)).length;
  const numerator = rows.filter((row) => row.three_month_window_75_105_completed === true).length;

  return {
    name: 'three_month_window_75_105_completion_rate',
    numerator,
    denominator,
    rate: denominator > 0 ? numerator / denominator : null,
  };
}

function calculateSecondaryOutcomes(rows: ResearchDerivedRow[]) {
  const denominator = rows.length;
  const ratio = (count: number) => (denominator > 0 ? count / denominator : null);
  const knownScoreRows = rows.filter((row) => row.baseline_score !== null && row.baseline_score !== undefined);

  return {
    scale_data_completeness_rate: denominator > 0 ? knownScoreRows.length / denominator : null,
    report_view_rate: ratio(rows.filter((row) => row.report_viewed === true).length),
    education_read_rate: ratio(rows.filter((row) => row.education_read === true).length),
    doctor_review_completion_rate: ratio(rows.filter((row) => row.doctor_review_completed === true).length),
    one_month_reassessment_completion_rate: ratio(rows.filter((row) => row.one_month_reassessment_completed === true).length),
  };
}

function buildQualitySummary(rows: ResearchDerivedRow[]) {
  const flagCounts: Record<string, number> = {};
  for (const row of rows) {
    const flags = Array.isArray(row.data_quality_flags) ? row.data_quality_flags : [];
    for (const flag of flags) {
      if (typeof flag !== 'string') {
        continue;
      }
      flagCounts[flag] = (flagCounts[flag] || 0) + 1;
    }
  }

  return {
    totalRows: rows.length,
    rowsWithQualityFlags: rows.filter((row) => Array.isArray(row.data_quality_flags) && row.data_quality_flags.length > 0).length,
    flagCounts,
  };
}

function toCanonicalDerivedRow(row: Partial<ResearchDerivedRow>): ResearchDerivedRow {
  return Object.fromEntries(RESEARCH_DERIVED_FIELD_NAMES.map((fieldName) => [fieldName, row[fieldName] ?? null])) as ResearchDerivedRow;
}

function buildResearchDerivedRows(input: {
  memberIds: string[];
  childBaselines: RawResearchRecord[];
  assessmentHistories: RawResearchRecord[];
  assessmentSessions: RawResearchRecord[];
  reportViews: RawResearchRecord[];
  inpatientRecords: RawResearchRecord[];
  outcome3mRecords: RawResearchRecord[];
  doctorReviews: RawResearchRecord[];
  educationDeliveries: RawResearchRecord[];
  followUpTasks: RawResearchRecord[];
}) {
  const baselineByMember = new Map(
    input.childBaselines
      .map((row) => [getString(row.memberProfileId), row] as const)
      .filter((entry): entry is readonly [string, RawResearchRecord] => Boolean(entry[0]))
  );
  const historiesByMember = groupByMember(input.assessmentHistories, 'profileId');
  const sessionsByMember = groupByMember(input.assessmentSessions, 'profileId');
  const viewsByMember = groupByMember(input.reportViews);
  const inpatientByMember = groupByMember(input.inpatientRecords);
  const outcomeByMember = groupByMember(input.outcome3mRecords);
  const reviewsByMember = groupByMember(input.doctorReviews);
  const educationByMember = groupByMember(input.educationDeliveries);
  const tasksByMember = groupByMember(input.followUpTasks);

  return input.memberIds.map((memberId) => {
    const baseline = baselineByMember.get(memberId) || null;
    const assessmentRows = historiesByMember.get(memberId) || [];
    const sessionRows = sessionsByMember.get(memberId) || [];
    const reportRows = viewsByMember.get(memberId) || [];
    const inpatientRows = inpatientByMember.get(memberId) || [];
    const outcomeRows = outcomeByMember.get(memberId) || [];
    const reviewRows = reviewsByMember.get(memberId) || [];
    const educationRows = educationByMember.get(memberId) || [];
    const taskRows = tasksByMember.get(memberId) || [];
    const baselineInfo = resolveBaseline({ baseline, assessmentRows, sessionRows });
    const firstAssessment = baselineInfo.firstAssessment;
    const firstSession = baselineInfo.firstSession;
    const threeMonthTask = resolveFollowUpTaskCompletion(taskRows, 'THREE_MONTH');
    const oneMonthTask = resolveFollowUpTaskCompletion(taskRows, 'ONE_MONTH');
    const outcome = resolveOutcomeCompletion(outcomeRows);
    const threeMonthCompletedAt = threeMonthTask.completedAt || outcome.completedAt;
    const dataQualityFlags = [];
    const dimensionScores =
      getRecord(firstAssessment?.resultDetails).dimensions ||
      getRecord(firstSession?.resultDetails).dimensions ||
      baselineInfo.snapshot.dimensionScores ||
      baselineInfo.snapshot.dimension_scores ||
      null;

    if (!baselineInfo.baselineDate) {
      dataQualityFlags.push('MISSING_BASELINE_DATE');
    }
    if (baselineInfo.baselineScore === null) {
      dataQualityFlags.push('MISSING_BASELINE_SCORE');
    }
    if (!threeMonthCompletedAt) {
      dataQualityFlags.push('MISSING_THREE_MONTH_REASSESSMENT');
    }

    const completedReviews = reviewRows.filter((row) => getDate(row.completedAt));
    const durationSeconds = completedReviews
      .map((row) => getNumber(row.durationSeconds))
      .filter((value): value is number => value !== null)
      .reduce((sum, value) => sum + value, 0);
    const firstInpatient = sortByDateAscending(inpatientRows, 'admissionDate')[0] || null;
    const firstOutcomeMetadata = outcome.metadata;
    const postScore =
      outcome.followUpScore ??
      getNumber(sortByDateAscending(assessmentRows, 'createdAt').find((row) =>
        isThreeMonthWindowCompleted({ baselineDate: baselineInfo.baselineDate, completedAt: row.createdAt })
      )?.totalScore);

    return toCanonicalDerivedRow({
      research_subject_id: createResearchSubjectId(memberId),
      group_type: getString(baselineInfo.snapshot.groupType) || getString(baselineInfo.snapshot.group_type) || 'SYSTEM_INTERVENTION',
      baseline_date: toDateOnly(baselineInfo.baselineDate),
      age_months:
        getNumber(baselineInfo.snapshot.ageMonths) ??
        getNumber(baselineInfo.snapshot.age_months) ??
        getNumber(firstAssessment?.respondentAgeMonths),
      sex: getString(baseline?.sex) || getString(baselineInfo.snapshot.sex) || getString(firstAssessment?.respondentGender),
      clinical_phenotype:
        getString(baselineInfo.snapshot.clinicalPhenotype) || getString(baselineInfo.snapshot.clinical_phenotype),
      diagnosis_label: getString(baselineInfo.snapshot.diagnosisLabel) || getString(baselineInfo.snapshot.diagnosis_label),
      scale_id: getString(firstAssessment?.scaleId) || getString(firstSession?.scaleId),
      scale_version: getString(firstAssessment?.scaleVersion) || getString(firstSession?.scaleVersion),
      baseline_score: baselineInfo.baselineScore,
      baseline_risk_level:
        getString(baselineInfo.snapshot.baselineRiskLevel) ||
        getString(baselineInfo.snapshot.baseline_risk_level) ||
        getString(firstAssessment?.conclusion) ||
        getString(firstSession?.conclusion),
      dimension_scores: dimensionScores ? serializeValue(dimensionScores) : null,
      report_viewed: reportRows.length > 0,
      education_pushed: educationRows.length > 0,
      education_read: educationRows.some(hasEducationRead),
      doctor_review_completed: completedReviews.length > 0,
      doctor_assessment_duration_seconds: durationSeconds || null,
      one_month_reassessment_completed: oneMonthTask.completed,
      three_month_reassessment_completed: threeMonthTask.completed || outcome.completed,
      three_month_window_75_105_completed: isThreeMonthWindowCompleted({
        baselineDate: baselineInfo.baselineDate,
        completedAt: threeMonthCompletedAt,
      }),
      lost_to_followup_reason: threeMonthTask.lostReason || oneMonthTask.lostReason,
      hospitalized: inpatientRows.length > 0,
      intervention_subgroup:
        getString(firstOutcomeMetadata.interventionSubgroup) ||
        getString(firstOutcomeMetadata.intervention_subgroup) ||
        getString(firstInpatient?.treatmentType),
      pre_score: outcome.baselineScore ?? baselineInfo.baselineScore,
      post_score: postScore,
      data_quality_flags: dataQualityFlags,
    });
  });
}

function toCsvCell(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function derivedRowsToCsv(rows: ResearchDerivedRow[]) {
  const lines = [RESEARCH_DERIVED_FIELD_NAMES.join(',')];
  for (const row of rows) {
    lines.push(RESEARCH_DERIVED_FIELD_NAMES.map((fieldName) => toCsvCell(row[fieldName])).join(','));
  }

  return `${lines.join('\n')}\n`;
}

async function buildResearchTables(): Promise<{
  tables: ResearchExportTables;
  primaryOutcome: ReturnType<typeof calculatePrimaryOutcome>;
  secondaryOutcomes: ReturnType<typeof calculateSecondaryOutcomes>;
  qualitySummary: ReturnType<typeof buildQualitySummary>;
}> {
  const researchConsents = await readModelRows('researchConsent', {
    where: { status: 'GRANTED' },
    select: { memberProfileId: true },
  });
  const memberIds = researchConsents
    .map((record: RawResearchRecord) => getString(record.memberProfileId))
    .filter((value: string | null): value is string => Boolean(value));
  const memberWhere = memberIds.length ? { in: memberIds } : { in: ['__NO_GRANTED_RESEARCH_CONSENT__'] };
  const [
    childBaselines,
    assessmentSessions,
    assessmentHistories,
    scaleScores,
    aiInteractions,
    aiConversationSessions,
    aiConversationEvents,
    followUps,
    reportViews,
    inpatientRecords,
    outcome3mRecords,
    doctorReviews,
    educationDeliveries,
    followUpTasks,
  ] = await Promise.all([
    readModelRows('childBaseline', { where: { memberProfileId: memberWhere }, orderBy: { createdAt: 'asc' } }),
    readModelRows('assessmentSession', { where: { profileId: memberWhere }, orderBy: { createdAt: 'asc' } }),
    readModelRows('assessmentHistory', { where: { profileId: memberWhere }, orderBy: { createdAt: 'asc' } }),
    readModelRows('scaleScore', { where: { memberProfileId: memberWhere }, orderBy: { createdAt: 'asc' } }),
    readModelRows('aiInteraction', { where: { memberProfileId: memberWhere }, orderBy: { createdAt: 'asc' } }),
    readModelRows('aiConversationSession', { where: { memberProfileId: memberWhere }, orderBy: { createdAt: 'asc' } }),
    readModelRows('aiConversationEvent', {
      where: {
        memberProfileId: memberWhere,
        OR: [
          { confirmedLowConfidence: true },
          { eventType: 'answer_confirmation' },
          { eventType: 'assessment_answer_committed' },
        ],
      },
      orderBy: { createdAt: 'asc' },
    }),
    readModelRows('followUp', { where: { memberProfileId: memberWhere }, orderBy: { createdAt: 'asc' } }),
    readModelRows('reportView', { where: { memberProfileId: memberWhere }, orderBy: { viewedAt: 'asc' } }),
    readModelRows('inpatientRecord', { where: { memberProfileId: memberWhere }, orderBy: { createdAt: 'asc' } }),
    readModelRows('outcome3m', { where: { memberProfileId: memberWhere }, orderBy: { createdAt: 'asc' } }),
    readModelRows('doctorReview', { where: { memberProfileId: memberWhere }, orderBy: { createdAt: 'asc' } }),
    readModelRows('educationDelivery', { where: { memberProfileId: memberWhere }, orderBy: { createdAt: 'asc' } }),
    readModelRows('followUpTask', {
      where: { memberProfileId: memberWhere },
      include: {
        completedAssessmentHistory: true,
        completedAssessmentSession: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const derivedRows = buildResearchDerivedRows({
    memberIds,
    childBaselines,
    assessmentHistories,
    assessmentSessions,
    reportViews,
    inpatientRecords,
    outcome3mRecords,
    doctorReviews,
    educationDeliveries,
    followUpTasks,
  });
  const tables: ResearchExportTables = {
    child_baseline: childBaselines.map((record: RawResearchRecord) => deidentifyRecord(record)),
    assessment_session: assessmentSessions.map((record: RawResearchRecord) =>
      deidentifyRecord(record, {
        assessment_session_key: createExportRowId(getString(record.id)),
      })
    ),
    assessment_history: assessmentHistories.map((record: RawResearchRecord) =>
      deidentifyRecord(record, {
        assessment_history_key: createExportRowId(getString(record.id)),
      })
    ),
    scale_score: scaleScores.map((record: RawResearchRecord) => deidentifyRecord(record)),
    ai_interaction: aiInteractions.map((record: RawResearchRecord) => deidentifyRecord(record)),
    ai_conversation_session: aiConversationSessions.map((record: RawResearchRecord) =>
      deidentifyRecord(record, {
        export_policy: AI_CONVERSATION_RESEARCH_EXPORT_POLICY,
        ai_conversation_session_key: createExportRowId(getString(record.id)),
      })
    ),
    ai_conversation_event: aiConversationEvents.map((record: RawResearchRecord) =>
      deidentifyRecord(record, {
        export_policy: AI_CONVERSATION_RESEARCH_EXPORT_POLICY,
        ai_conversation_event_key: createExportRowId(getString(record.id)),
        ai_conversation_session_key: createExportRowId(getString(record.sessionId)),
      })
    ),
    followup: followUps.map((record: RawResearchRecord) => deidentifyRecord(record)),
    report_view: reportViews.map((record: RawResearchRecord) => deidentifyRecord(record)),
    inpatient_record: inpatientRecords.map((record: RawResearchRecord) => deidentifyRecord(record)),
    outcome_3m: outcome3mRecords.map((record: RawResearchRecord) => deidentifyRecord(record)),
    research_derived_dataset: derivedRows,
  };

  return {
    tables,
    primaryOutcome: calculatePrimaryOutcome(derivedRows),
    secondaryOutcomes: calculateSecondaryOutcomes(derivedRows),
    qualitySummary: buildQualitySummary(derivedRows),
  };
}

function hashExportContent(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function logResearchExportBatch(input: {
  actor: ResearchActor;
  format: ResearchExportFormat;
  purpose: string;
  content: string;
  rows: ResearchDerivedRow[];
  primaryOutcome: ReturnType<typeof calculatePrimaryOutcome>;
  secondaryOutcomes: ReturnType<typeof calculateSecondaryOutcomes>;
  qualitySummary: ReturnType<typeof buildQualitySummary>;
}) {
  const model = db();
  const exportLogModel = model.researchExportLog;
  const derivedDatasetModel = model.researchDerivedDataset;
  if (!exportLogModel?.create || !derivedDatasetModel?.create) {
    return null;
  }

  const exportLog = await exportLogModel.create({
    data: {
      requestedByAdminId: input.actor.adminId || null,
      requestedByUserId: input.actor.userId || null,
      doctorProfileId: input.actor.doctorProfileId || null,
      memberProfileId: null,
      actorType: input.actor.actorType,
      format: input.format.toUpperCase(),
      purpose: input.purpose,
      datasetVersion: RESEARCH_DATASET_VERSION,
      fieldSetVersion: FIELD_SET_VERSION,
      recordCount: input.rows.length,
      exportedFields: RESEARCH_DERIVED_FIELD_NAMES,
      tables: EXPORT_TABLE_ORDER,
      qualitySummary: input.qualitySummary,
      exportBatchKey: `REB-${crypto.randomUUID()}`,
    },
  });

  const derivedDataset = await derivedDatasetModel.create({
    data: {
      exportLogId: exportLog.id,
      datasetVersion: RESEARCH_DATASET_VERSION,
      fieldSetVersion: FIELD_SET_VERSION,
      rowCount: input.rows.length,
      primaryOutcome: input.primaryOutcome,
      secondaryOutcomes: input.secondaryOutcomes,
      qualitySummary: input.qualitySummary,
      rowsSnapshot: input.rows,
      contentHash: hashExportContent(input.content),
    },
  });

  return { exportLog, derivedDataset };
}

export async function exportResearchDataset(input: {
  format: ResearchExportFormat;
  actor?: ResearchActor;
  purpose?: string;
  persistBatch?: boolean;
}) {
  const { tables, primaryOutcome, secondaryOutcomes, qualitySummary } = await buildResearchTables();
  const generatedAt = new Date().toISOString();
  const rows = tables.research_derived_dataset as ResearchDerivedRow[];
  const content =
    input.format === 'csv'
      ? derivedRowsToCsv(rows)
      : JSON.stringify(
          {
            generatedAt,
            datasetVersion: RESEARCH_DATASET_VERSION,
            fieldSetVersion: FIELD_SET_VERSION,
            deidentification: {
              subjectId: 'HMAC-SHA256 over member profile identifier',
              directIdentifierFields: [...DIRECT_IDENTIFIER_FIELDS],
            },
            dataDictionary: RESEARCH_DERIVED_FIELD_DICTIONARY,
            primaryOutcome,
            secondaryOutcomes,
            qualitySummary,
            tables,
          },
          null,
          2
        );
  const batch =
    input.actor && input.persistBatch !== false
      ? await logResearchExportBatch({
          actor: input.actor,
          format: input.format,
          purpose: input.purpose || 'research-derived-dataset-export',
          content,
          rows,
          primaryOutcome,
          secondaryOutcomes,
          qualitySummary,
        })
      : null;

  return {
    format: input.format,
    generatedAt,
    tables,
    primaryOutcome,
    secondaryOutcomes,
    qualitySummary,
    exportBatchId: batch?.exportLog?.id || null,
    content,
    mimeType: input.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
    filename: `research-derived-${generatedAt.slice(0, 10)}.${input.format}`,
  };
}
