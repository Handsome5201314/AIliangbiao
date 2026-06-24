export const DEFAULT_REPORT_HOSPITAL_NAME = '解放军总医院第一医学中心';

export type AssessmentReportTemplateKind = 'SNAP_IV' | 'ABC' | 'GENERAL';

export interface AssessmentReportTemplateConfig {
  kind: AssessmentReportTemplateKind;
  name: string;
  templateVersion: string;
  hospitalName: string;
  departmentName: string | null;
  reportTitle: string;
  scaleIds: string[];
}

export interface AssessmentReportDimensionRow {
  key: string;
  label: string;
  score: number;
  maxScore: number | null;
  display: string;
}

export interface AssessmentReportAnswerRow {
  questionId: number;
  questionText: string;
  answerScore: number | null;
  answerLabel: string;
}

export interface AssessmentReportSnapshot {
  reportNo: string | null;
  generatedAt: string;
  approvedAt: string;
  template: AssessmentReportTemplateConfig;
  hospital: {
    name: string;
    departmentName: string;
    logoUrl: string | null;
  };
  child: {
    id: string | null;
    displayName: string;
    gender: string | null;
    birthDate: string | null;
    ageMonths: number | null;
    contactPhone: string | null;
  };
  scale: {
    id: string;
    name: string;
    version: string;
  };
  assessment: {
    id: string;
    assessedAt: string;
  };
  result: {
    rawScore: number;
    totalScore: number;
    scoreLabel: string;
    scoreDisplay: string;
    conclusion: string;
    resultExplanation: string;
    dimensionRows: AssessmentReportDimensionRow[];
  };
  review: {
    id: string;
    doctorName: string;
    doctorTitle: string;
    reviewConclusion: string | null;
    reviewNotes: string | null;
    completedAt: string;
  };
  optional: {
    outpatientNo: string | null;
    inpatientNo: string | null;
    clinicalDiagnosis: string | null;
  };
  answerRows: AssessmentReportAnswerRow[];
  safetyNotice: string;
}

export interface BuildAssessmentReportSnapshotInput {
  reportNo: string;
  template: AssessmentReportTemplateConfig;
  assessment: {
    id: string;
    scaleId: string;
    scaleName?: string | null;
    scaleVersion?: string | null;
    totalScore: number;
    conclusion: string;
    resultDetails?: {
      description?: string;
      scoreLabel?: string;
      scoreDisplay?: string;
      totalScoreLabel?: string;
      dimensions?: Record<string, unknown>;
      [key: string]: unknown;
    } | null;
    createdAt: Date | string;
  };
  member: {
    id?: string | null;
    nickname: string;
    realName?: string | null;
    contactPhone?: string | null;
    gender?: string | null;
    ageMonths?: number | null;
  };
  doctor: {
    id: string;
    realName: string;
    title: string;
    hospitalName?: string | null;
    departmentName?: string | null;
  };
  review: {
    id: string;
    reviewConclusion?: string | null;
    reviewNotes?: string | null;
    completedAt: Date | string;
  };
  approvedAt: Date | string;
  answerRows?: AssessmentReportAnswerRow[];
  optional?: Partial<AssessmentReportSnapshot['optional']>;
}

export interface AssessmentReportExportLike {
  assessmentId: string;
  report?: AssessmentReportSnapshot;
  reportSnapshot?: AssessmentReportSnapshot;
  reportNo?: string | null;
  member: {
    nickname: string;
    relation?: string;
    gender: string;
    ageMonths?: number | null;
    realName?: string | null;
    contactPhone?: string | null;
  };
  scale: {
    id: string;
    name: string;
    version: string;
  };
  result: {
    totalScore: number;
    conclusion: string;
    details?: {
      description?: string;
      scoreLabel?: string;
      scoreDisplay?: string;
      totalScoreLabel?: string;
      dimensions?: Record<string, unknown>;
      [key: string]: unknown;
    };
  };
  answerDetails: AssessmentReportAnswerRow[];
  assessedAt: string;
  exportedAt: string;
}

function normalizeScaleCode(scaleId: string) {
  return scaleId.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase() || 'GENERAL';
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function toIso(value: Date | string) {
  return toDate(value).toISOString();
}

function toYmd(value: Date | string) {
  const date = toDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function optionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildAssessmentReportNo(input: {
  scaleId: string;
  approvedAt: Date | string;
  doctorReviewId: string;
  assessmentHistoryId?: string | null;
}) {
  const scaleCode = normalizeScaleCode(input.scaleId);
  const dateCode = toYmd(input.approvedAt);
  const suffix = hashSeed([
    input.scaleId,
    input.doctorReviewId,
    input.assessmentHistoryId || '',
    dateCode,
  ].join(':'));

  return `RPT-${scaleCode}-${dateCode}-${suffix}`;
}

export function resolveAssessmentReportTemplateConfig(scaleId: string): AssessmentReportTemplateConfig {
  const normalized = scaleId.toUpperCase();

  if (normalized === 'SNAP-IV' || normalized === 'SNAP_IV') {
    return {
      kind: 'SNAP_IV',
      name: 'SNAP-IV 正式报告模板',
      templateVersion: '1.0',
      hospitalName: DEFAULT_REPORT_HOSPITAL_NAME,
      departmentName: null,
      reportTitle: 'SNAP-IV 儿童注意缺陷多动筛查正式报告',
      scaleIds: ['SNAP-IV'],
    };
  }

  if (normalized === 'ABC') {
    return {
      kind: 'ABC',
      name: 'ABC 正式报告模板',
      templateVersion: '1.0',
      hospitalName: DEFAULT_REPORT_HOSPITAL_NAME,
      departmentName: null,
      reportTitle: '孤独症行为评定量表（ABC）正式报告',
      scaleIds: ['ABC'],
    };
  }

  return {
    kind: 'GENERAL',
    name: '通用量表正式报告模板',
    templateVersion: '1.0',
    hospitalName: DEFAULT_REPORT_HOSPITAL_NAME,
    departmentName: null,
    reportTitle: '儿童发育行为量表正式报告',
    scaleIds: ['*'],
  };
}

function extractDimensionRows(details?: BuildAssessmentReportSnapshotInput['assessment']['resultDetails']) {
  const dimensions =
    typeof details?.dimensions === 'object' && details.dimensions !== null
      ? details.dimensions
      : undefined;

  if (!dimensions) {
    return [];
  }

  return Object.entries(dimensions)
    .filter(([key, value]) => key !== 'functional_impact' && typeof value === 'object' && value !== null)
    .map(([key, value]) => {
      const entry = value as { label?: unknown; score?: unknown; maxScore?: unknown };
      const label = typeof entry.label === 'string' ? entry.label : key;
      const score = typeof entry.score === 'number' ? entry.score : null;
      const maxScore = typeof entry.maxScore === 'number' ? entry.maxScore : null;

      if (score === null) {
        return null;
      }

      return {
        key,
        label,
        score,
        maxScore,
        display: maxScore === null ? String(score) : `${score} / ${maxScore}`,
      };
    })
    .filter((item): item is AssessmentReportDimensionRow => item !== null);
}

export function buildAssessmentReportSnapshot(input: BuildAssessmentReportSnapshotInput): AssessmentReportSnapshot {
  const scoreLabel =
    typeof input.assessment.resultDetails?.scoreLabel === 'string'
      ? input.assessment.resultDetails.scoreLabel
      : '原始分';
  const scoreDisplay =
    typeof input.assessment.resultDetails?.scoreDisplay === 'string'
      ? input.assessment.resultDetails.scoreDisplay
      : String(input.assessment.totalScore);
  const resultExplanation =
    optionalText(input.review.reviewConclusion) ||
    optionalText(input.assessment.resultDetails?.description) ||
    input.assessment.conclusion;
  const departmentName =
    optionalText(input.doctor.departmentName) ||
    optionalText(input.template.departmentName) ||
    '';

  return {
    reportNo: input.reportNo,
    generatedAt: toIso(input.approvedAt),
    approvedAt: toIso(input.approvedAt),
    template: input.template,
    hospital: {
      name: optionalText(input.doctor.hospitalName) || input.template.hospitalName,
      departmentName,
      logoUrl: null,
    },
    child: {
      id: input.member.id || null,
      displayName: optionalText(input.member.realName) || input.member.nickname,
      gender: optionalText(input.member.gender),
      birthDate: null,
      ageMonths: typeof input.member.ageMonths === 'number' ? input.member.ageMonths : null,
      contactPhone: optionalText(input.member.contactPhone),
    },
    scale: {
      id: input.assessment.scaleId,
      name: optionalText(input.assessment.scaleName) || input.assessment.scaleId,
      version: input.assessment.scaleVersion || '1.0',
    },
    assessment: {
      id: input.assessment.id,
      assessedAt: toIso(input.assessment.createdAt),
    },
    result: {
      rawScore: input.assessment.totalScore,
      totalScore: input.assessment.totalScore,
      scoreLabel,
      scoreDisplay,
      conclusion: input.assessment.conclusion,
      resultExplanation,
      dimensionRows: extractDimensionRows(input.assessment.resultDetails),
    },
    review: {
      id: input.review.id,
      doctorName: input.doctor.realName,
      doctorTitle: input.doctor.title,
      reviewConclusion: optionalText(input.review.reviewConclusion),
      reviewNotes: optionalText(input.review.reviewNotes),
      completedAt: toIso(input.review.completedAt),
    },
    optional: {
      outpatientNo: optionalText(input.optional?.outpatientNo),
      inpatientNo: optionalText(input.optional?.inpatientNo),
      clinicalDiagnosis: optionalText(input.optional?.clinicalDiagnosis),
    },
    answerRows: input.answerRows || [],
    safetyNotice: '本报告基于量表筛查结果和医生复核记录，仅用于发育行为筛查、随访和临床沟通参考，不能替代专业诊断。',
  };
}

export function createAssessmentReportSnapshotFromExportData(
  data: AssessmentReportExportLike
): AssessmentReportSnapshot {
  if (data.report) {
    return data.report;
  }

  if (data.reportSnapshot) {
    return data.reportSnapshot;
  }

  const template = resolveAssessmentReportTemplateConfig(data.scale.id);

  return {
    reportNo: data.reportNo || null,
    generatedAt: data.exportedAt,
    approvedAt: data.exportedAt,
    template,
    hospital: {
      name: template.hospitalName,
      departmentName: template.departmentName || '',
      logoUrl: null,
    },
    child: {
      id: null,
      displayName: data.member.realName || data.member.nickname,
      gender: optionalText(data.member.gender),
      birthDate: null,
      ageMonths: typeof data.member.ageMonths === 'number' ? data.member.ageMonths : null,
      contactPhone: optionalText(data.member.contactPhone),
    },
    scale: data.scale,
    assessment: {
      id: data.assessmentId,
      assessedAt: data.assessedAt,
    },
    result: {
      rawScore: data.result.totalScore,
      totalScore: data.result.totalScore,
      scoreLabel: typeof data.result.details?.scoreLabel === 'string' ? data.result.details.scoreLabel : '原始分',
      scoreDisplay: typeof data.result.details?.scoreDisplay === 'string'
        ? data.result.details.scoreDisplay
        : String(data.result.totalScore),
      conclusion: data.result.conclusion,
      resultExplanation: optionalText(data.result.details?.description) || data.result.conclusion,
      dimensionRows: extractDimensionRows(data.result.details),
    },
    review: {
      id: '',
      doctorName: '',
      doctorTitle: '',
      reviewConclusion: null,
      reviewNotes: null,
      completedAt: data.exportedAt,
    },
    optional: {
      outpatientNo: null,
      inpatientNo: null,
      clinicalDiagnosis: null,
    },
    answerRows: data.answerDetails,
    safetyNotice: '本报告基于量表筛查结果，仅用于筛查、随访和临床沟通参考，不能替代专业诊断。',
  };
}

function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAgeMonths(ageMonths: number | null) {
  if (typeof ageMonths !== 'number') {
    return '';
  }

  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  if (years <= 0) {
    return `${months} 月龄`;
  }
  if (months === 0) {
    return `${years} 岁`;
  }
  return `${years} 岁 ${months} 月`;
}

function fieldRow(label: string, value?: string | number | null, optional = false) {
  if (optional && (value === null || value === undefined || value === '')) {
    return '';
  }

  return `
    <div class="report-field">
      <span class="report-label">${escapeHtml(label)}</span>
      <span class="report-value">${value === null || value === undefined ? '' : escapeHtml(value)}</span>
    </div>
  `;
}

function dimensionRows(snapshot: AssessmentReportSnapshot) {
  if (!snapshot.result.dimensionRows.length) {
    return '';
  }

  return `
    <section class="report-section">
      <h2>维度分 / 项目分</h2>
      <table>
        <thead>
          <tr><th>维度</th><th>得分</th></tr>
        </thead>
        <tbody>
          ${snapshot.result.dimensionRows
            .map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.display)}</td></tr>`)
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function answerRows(snapshot: AssessmentReportSnapshot) {
  if (!snapshot.answerRows.length) {
    return '';
  }

  return `
    <section class="report-section answer-section">
      <h2>答题明细</h2>
      <table>
        <thead>
          <tr><th>题号</th><th>题目</th><th>作答</th><th>分值</th></tr>
        </thead>
        <tbody>
          ${snapshot.answerRows
            .map((item) => `
              <tr>
                <td>${escapeHtml(item.questionId)}</td>
                <td>${escapeHtml(item.questionText)}</td>
                <td>${escapeHtml(item.answerLabel)}</td>
                <td>${item.answerScore === null ? '' : escapeHtml(item.answerScore)}</td>
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

export function renderAssessmentReportHtml(snapshot: AssessmentReportSnapshot) {
  const templateClass = `template-${snapshot.template.kind.toLowerCase().replace(/_/g, '-')}`;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(snapshot.template.reportTitle)}</title>
    <style>
      :root {
        color: #0f172a;
        background: #f8fafc;
        font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 24px; }
      .report-page {
        width: 820px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #dbe3ef;
        padding: 36px 42px;
      }
      .report-header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        border-bottom: 3px solid #0f766e;
        padding-bottom: 18px;
        margin-bottom: 24px;
      }
      .hospital { font-size: 22px; font-weight: 800; letter-spacing: 0.04em; }
      .department { margin-top: 6px; color: #475569; font-size: 14px; }
      .report-no { text-align: right; color: #475569; font-size: 13px; line-height: 1.8; }
      h1 { margin: 0 0 6px; text-align: center; font-size: 24px; }
      .subtitle { text-align: center; color: #64748b; font-size: 13px; margin-bottom: 24px; }
      .report-section {
        border: 1px solid #e2e8f0;
        margin: 16px 0;
        padding: 16px;
      }
      .template-snap-iv .report-section { border-left: 4px solid #f59e0b; }
      .template-abc .report-section { border-left: 4px solid #e11d48; }
      .template-general .report-section { border-left: 4px solid #0f766e; }
      h2 { margin: 0 0 12px; font-size: 16px; }
      .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
      .report-field { display: flex; border-bottom: 1px solid #edf2f7; min-height: 30px; }
      .report-label { width: 92px; color: #64748b; }
      .report-value { flex: 1; color: #0f172a; }
      .score-box {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 14px;
        align-items: stretch;
      }
      .score-number {
        border: 1px solid #cbd5e1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 110px;
      }
      .score-number strong { font-size: 32px; }
      .score-number span { color: #64748b; font-size: 13px; }
      .explanation { white-space: pre-wrap; line-height: 1.8; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f8fafc; color: #334155; }
      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin-top: 24px;
      }
      .signature-box { min-height: 70px; border-top: 1px solid #cbd5e1; padding-top: 10px; }
      .notice { margin-top: 20px; color: #475569; font-size: 12px; line-height: 1.8; }
      @media print {
        body { background: #ffffff; padding: 0; }
        .report-page { width: auto; border: 0; margin: 0; page-break-after: auto; }
        .answer-section { page-break-before: auto; }
      }
    </style>
  </head>
  <body>
    <main class="report-page ${templateClass}">
      <header class="report-header">
        <div>
          <div class="hospital">${escapeHtml(snapshot.hospital.name)}</div>
          ${snapshot.hospital.departmentName ? `<div class="department">${escapeHtml(snapshot.hospital.departmentName)}</div>` : ''}
        </div>
        <div class="report-no">
          ${snapshot.reportNo ? `<div>报告编号：${escapeHtml(snapshot.reportNo)}</div>` : ''}
          <div>复核时间：${escapeHtml(formatDateTime(snapshot.review.completedAt))}</div>
        </div>
      </header>

      <h1>${escapeHtml(snapshot.template.reportTitle)}</h1>
      <div class="subtitle">医生复核后生成 · 仅用于筛查、随访和临床沟通参考</div>

      <section class="report-section">
        <h2>儿童信息</h2>
        <div class="field-grid">
          ${fieldRow('姓名', snapshot.child.displayName)}
          ${fieldRow('性别', snapshot.child.gender)}
          ${fieldRow('出生日期', snapshot.child.birthDate, true)}
          ${fieldRow('年龄', formatAgeMonths(snapshot.child.ageMonths), true)}
          ${fieldRow('联系电话', snapshot.child.contactPhone, true)}
          ${fieldRow('门诊号', snapshot.optional.outpatientNo, true)}
          ${fieldRow('住院号', snapshot.optional.inpatientNo, true)}
        </div>
      </section>

      <section class="report-section">
        <h2>评估信息</h2>
        <div class="field-grid">
          ${fieldRow('量表名称', snapshot.scale.name)}
          ${fieldRow('量表版本', snapshot.scale.version)}
          ${fieldRow('评估日期', formatDateTime(snapshot.assessment.assessedAt))}
          ${fieldRow('审核医生', `${snapshot.review.doctorName} ${snapshot.review.doctorTitle}`.trim())}
          ${fieldRow('科室', snapshot.hospital.departmentName)}
          ${fieldRow('临床诊断', snapshot.optional.clinicalDiagnosis, true)}
        </div>
      </section>

      <section class="report-section">
        <h2>量表结果</h2>
        <div class="score-box">
          <div class="score-number">
            <strong>${escapeHtml(snapshot.result.scoreDisplay)}</strong>
            <span>${escapeHtml(snapshot.result.scoreLabel)}</span>
          </div>
          <div>
            <div class="report-field">
              <span class="report-label">结果说明</span>
              <span class="report-value">${escapeHtml(snapshot.result.conclusion)}</span>
            </div>
            <p class="explanation">${escapeHtml(snapshot.result.resultExplanation)}</p>
          </div>
        </div>
      </section>

      ${dimensionRows(snapshot)}
      ${answerRows(snapshot)}

      <section class="signatures">
        <div class="signature-box">审核医生：${escapeHtml(snapshot.review.doctorName)}</div>
        <div class="signature-box">医生职称：${escapeHtml(snapshot.review.doctorTitle)}</div>
      </section>

      <p class="notice">${escapeHtml(snapshot.safetyNotice)}</p>
    </main>
  </body>
</html>`;
}
