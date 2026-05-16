'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Baby,
  CalendarDays,
  ClipboardList,
  Clock3,
  Droplets,
  Plus,
  RefreshCcw,
  Ruler,
  Save,
  Search,
  Share2,
  Weight,
} from 'lucide-react';
import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BHUTANI_TSB_CURVES } from '@/lib/neonates/bhutani-curves';
import {
  evaluateAgainstPercentiles,
  formatGestationLabel,
  formatGestationTick,
  formatReferenceLookupLabel,
  gestationToDecimal,
  getReferenceLookupWeek,
  getReferencePoint,
  REFERENCE_CURVES,
  type MetricKey,
  type PercentilePoint,
  type SexKey,
} from '@/lib/neonates/reference-curves';
import type {
  DoctorNeonateBilirubinContext,
  DoctorNeonateArchiveDetail,
  DoctorNeonateArchiveSummary,
  DoctorNeonateGrowthRecordView,
} from '@/lib/neonates/types';
import { useCompactViewport } from '@/lib/useCompactViewport';

type ArchiveFormState = {
  babyName: string;
  sex: SexKey;
  birthGestationWeeks: string;
  birthGestationDays: string;
  birthDate: string;
  birthTime: string;
};

type RecordFormState = {
  recordDate: string;
  recordTime: string;
  length: string;
  weight: string;
  headCircumference: string;
  bilirubinValue: string;
  bilirubinUnit: 'umol' | 'mg';
  bilirubinContext: DoctorNeonateBilirubinContext;
};

type ChartRow = {
  x: number;
  recordId?: string;
  recordDate?: string;
  recordTime?: string | null;
  recordDateTime?: string;
  gestationLabel?: string;
  lookupWeek?: number;
  lookupWeekLabel?: string;
  value?: number;
  bandLabel?: string;
  zoneLabel?: string;
  approxPercentile?: number | null;
  ageHoursEstimated?: boolean;
  p3?: number;
  p10?: number;
  p25?: number;
  p50?: number;
  p75?: number;
  p90?: number;
  p97?: number;
};

type MetricAssessmentSnapshot = {
  value: number;
  bandLabel: string;
  zoneLabel: string;
  approxPercentile: number | null;
};

type MetricAssessmentValue = MetricAssessmentSnapshot | null;

type EvaluatedRecordRow = {
  record: DoctorNeonateGrowthRecordView;
  x: number;
  gestationLabel: string;
  lookupWeek: number;
  lookupWeekLabel: string;
  ageHours: number;
  ageHoursEstimated: boolean;
  metrics: Record<MetricKey, MetricAssessmentValue>;
};

type JaundiceRiskBand = '<P40' | 'P40-P75' | 'P75-P95' | '>=P95';

type JaundiceCurvePoint = {
  hours: number;
  umol: number;
};

type JaundiceChartRow = {
  hours: number;
  p40: number;
  p75: number;
  p95: number;
  recordId?: string;
  recordDate?: string;
  recordTime?: string | null;
  recordDateTime?: string;
  umol?: number;
  mg?: number;
  riskBand?: JaundiceRiskBand;
  bilirubinContext?: DoctorNeonateBilirubinContext | null;
  hoursEstimated?: boolean;
};

type JaundiceTooltipPayloadEntry = {
  dataKey?: string | number;
  value?: number | string;
  payload?: JaundiceChartRow;
};

type JaundiceTooltipProps = {
  active?: boolean;
  payload?: JaundiceTooltipPayloadEntry[];
};

type TooltipPayloadEntry = {
  dataKey?: string | number;
  value?: number | string;
  payload?: ChartRow;
};

type GrowthTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  metric: MetricKey;
};

type TerminalLabelProps = {
  x?: number | string;
  y?: number | string;
  index?: number;
  payload?: ChartRow;
};

type MetricChartProps = {
  metric: MetricKey;
  sex: SexKey;
  evaluatedRecords: EvaluatedRecordRow[];
  selectedRecordId: string | null;
  onSelectRecord: (recordId: string) => void;
  xDomain: [number, number];
  xTicks: number[];
  isCompactViewport: boolean;
};

type NeonateAccessGrant = {
  id: string;
  accessRole: 'COLLABORATOR' | 'READONLY';
  sourceTeam: {
    id: string;
    name: string;
  };
  targetDoctor: {
    doctorProfileId: string;
    realName: string;
    departmentName: string;
    title: string;
  };
};

type ShareableTeam = {
  id: string;
  name: string;
  members: Array<{
    doctorProfileId: string;
    realName: string;
    departmentName: string;
    title: string;
  }>;
};

type MobileTabKey = 'ledger' | 'record' | 'growth' | 'profile';

const MOBILE_TAB_LABELS: Array<{ key: MobileTabKey; label: string }> = [
  { key: 'ledger', label: '台账' },
  { key: 'record', label: '记录' },
  { key: 'growth', label: '生长' },
  { key: 'profile', label: '档案' },
];

const BILIRUBIN_CONTEXT_META: Record<
  DoctorNeonateBilirubinContext,
  { label: string; dotClass: string; badgeClass: string; lineStroke: string; fill: string; stroke: string }
> = {
  AMBIENT: {
    label: '普通环境',
    dotClass: 'bg-amber-400',
    badgeClass: 'border border-amber-200 bg-amber-50 text-amber-700',
    lineStroke: '#f59e0b',
    fill: '#fbbf24',
    stroke: '#b45309',
  },
  PHOTOTHERAPY: {
    label: '蓝光中',
    dotClass: 'bg-sky-500',
    badgeClass: 'border border-sky-200 bg-sky-50 text-sky-700',
    lineStroke: '#0ea5e9',
    fill: '#e0f2fe',
    stroke: '#0284c7',
  },
};

function getCurrentTimeValue() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function parseTimeValueToMinutes(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function buildDateTimeMs(date: string, time: string | null | undefined) {
  const [year, month, day] = date.split('-').map(Number);
  const totalMinutes = parseTimeValueToMinutes(time) ?? 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return Date.UTC(year, month - 1, day, hours, minutes);
}

function formatDateTimeDisplay(date: string, time: string | null | undefined) {
  return time ? `${date} ${time}` : `${date} · 时间未补录`;
}

function formatOptionalDateTimeDisplay(date: string | null, time: string | null | undefined, fallback = '暂无') {
  if (!date) {
    return fallback;
  }

  return formatDateTimeDisplay(date, time);
}

function formatBirthMoment(date: string, time: string | null | undefined) {
  return time ? `${date} ${time}` : `${date}（出生时间未补录）`;
}

function getRecordAgeHoursContext(input: {
  birthDate: string;
  birthTime: string | null;
  recordDate: string;
  recordTime: string | null;
}) {
  const estimated = !input.birthTime || !input.recordTime;
  const birthMs = buildDateTimeMs(input.birthDate, input.birthTime);
  const recordMs = buildDateTimeMs(input.recordDate, input.recordTime);

  return {
    hours: Math.max(0, (recordMs - birthMs) / (1000 * 60 * 60)),
    estimated,
  };
}

function formatHoursDisplay(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatBilirubinContextLabel(context: DoctorNeonateBilirubinContext | null | undefined) {
  if (!context) {
    return '未标注';
  }

  return BILIRUBIN_CONTEXT_META[context].label;
}

function sortGrowthRecords(records: DoctorNeonateGrowthRecordView[]) {
  return [...records].sort((left, right) => {
    const byDate = left.recordDate.localeCompare(right.recordDate);
    if (byDate !== 0) {
      return byDate;
    }

    const leftTime = parseTimeValueToMinutes(left.recordTime) ?? -1;
    const rightTime = parseTimeValueToMinutes(right.recordTime) ?? -1;
    const byTime = leftTime - rightTime;
    if (byTime !== 0) {
      return byTime;
    }

    const byWeeks = left.currentGestation.weeks - right.currentGestation.weeks;
    if (byWeeks !== 0) {
      return byWeeks;
    }

    const byDays = left.currentGestation.days - right.currentGestation.days;
    if (byDays !== 0) {
      return byDays;
    }

    return left.id.localeCompare(right.id);
  });
}

function normalizeArchiveDetail(archive: DoctorNeonateArchiveDetail): DoctorNeonateArchiveDetail {
  return {
    ...archive,
    records: sortGrowthRecords(archive.records),
  };
}

function getLatestRecord(records: DoctorNeonateGrowthRecordView[]) {
  return records.length ? records[records.length - 1] : null;
}

const SEX_LABELS: Record<SexKey, string> = {
  boy: '男',
  girl: '女',
};

const METRIC_CONFIG: Record<
  MetricKey,
  {
    label: string;
    unit: string;
    color: string;
    min: number;
    max: number;
    ticks: number[];
  }
> = {
  length: {
    label: '身长',
    unit: 'cm',
    color: '#0f766e',
    min: 25,
    max: 70,
    ticks: [25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
  },
  weight: {
    label: '体重',
    unit: 'kg',
    color: '#4f46e5',
    min: 0.4,
    max: 8,
    ticks: [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8],
  },
  headCircumference: {
    label: '头围',
    unit: 'cm',
    color: '#db2777',
    min: 18,
    max: 45,
    ticks: [18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 45],
  },
};

const PERCENTILE_LINES: Array<{
  key: keyof Pick<PercentilePoint, 'p3' | 'p10' | 'p25' | 'p50' | 'p75' | 'p90' | 'p97'>;
  label: string;
  stroke: string;
  strokeWidth: number;
  dasharray?: string;
}> = [
  { key: 'p3', label: 'P3', stroke: '#cbd5e1', strokeWidth: 1.2, dasharray: '5 5' },
  { key: 'p10', label: 'P10', stroke: '#cbd5e1', strokeWidth: 1.2, dasharray: '5 5' },
  { key: 'p25', label: 'P25', stroke: '#dbe4f0', strokeWidth: 1.2, dasharray: '4 4' },
  { key: 'p50', label: 'P50', stroke: '#94a3b8', strokeWidth: 1.6 },
  { key: 'p75', label: 'P75', stroke: '#dbe4f0', strokeWidth: 1.2, dasharray: '4 4' },
  { key: 'p90', label: 'P90', stroke: '#cbd5e1', strokeWidth: 1.2, dasharray: '5 5' },
  { key: 'p97', label: 'P97', stroke: '#cbd5e1', strokeWidth: 1.2, dasharray: '5 5' },
];

function createTerminalLabelRenderer(label: string, color: string) {
  return function TerminalLabel({ x, y, payload }: TerminalLabelProps) {
    if (!payload || payload.x !== 42) {
      return null;
    }

    const xValue = typeof x === 'string' ? Number(x) : x;
    const yValue = typeof y === 'string' ? Number(y) : y;

    if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
      return null;
    }

    return (
      <text x={(xValue as number) + 8} y={(yValue as number) + 4} fill={color} fontSize={11} fontWeight={600}>
        {label}
      </text>
    );
  };
}

function formatMetricValue(value: number, metric: MetricKey) {
  return metric === 'weight'
    ? value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
    : value.toFixed(1).replace(/\.0$/, '');
}

function formatNullableMetricValue(value: number | null, metric: MetricKey) {
  return typeof value === 'number' ? `${formatMetricValue(value, metric)} ${METRIC_CONFIG[metric].unit}` : '—';
}

function umolToMg(umol: number): number {
  return umol / 17.1;
}

function mgToUmol(mg: number): number {
  return mg * 17.1;
}

function formatBilirubinDisplay(umolValue: number | null): string {
  if (umolValue == null) return '—';
  return `${umolValue.toFixed(1)} μmol/L (${umolToMg(umolValue).toFixed(1)} mg/dL)`;
}

function buildMetricAssessmentSnapshot(metric: MetricKey, sex: SexKey, lookupWeek: number, value: number | null): MetricAssessmentValue {
  if (typeof value !== 'number') {
    return null;
  }

  const percentilePoint = getReferencePoint(sex, metric, lookupWeek);
  const assessment = evaluateAgainstPercentiles(value, percentilePoint);

  return {
    value,
    bandLabel: assessment.bandLabel,
    zoneLabel: assessment.zoneLabel,
    approxPercentile: assessment.approxPercentile,
  };
}

function evaluateRecordForDisplay(
  archive: Pick<DoctorNeonateArchiveDetail, 'sex' | 'birthDate' | 'birthTime' | 'birthGestation'>,
  record: DoctorNeonateGrowthRecordView,
): EvaluatedRecordRow {
  const ageHoursContext = getRecordAgeHoursContext({
    birthDate: archive.birthDate,
    birthTime: archive.birthTime,
    recordDate: record.recordDate,
    recordTime: record.recordTime,
  });
  const totalGestationDays =
    archive.birthGestation.weeks * 7 + archive.birthGestation.days + ageHoursContext.hours / 24;
  const x = totalGestationDays / 7;
  const gestationLabel = formatGestationLabel(record.currentGestation.weeks, record.currentGestation.days);
  const lookupWeek = getReferenceLookupWeek(record.currentGestation.weeks, record.currentGestation.days);
  const lookupWeekLabel = formatReferenceLookupLabel(lookupWeek);

  return {
    record,
    x,
    gestationLabel,
    lookupWeek,
    lookupWeekLabel,
    ageHours: ageHoursContext.hours,
    ageHoursEstimated: ageHoursContext.estimated,
    metrics: {
      length: buildMetricAssessmentSnapshot('length', archive.sex, lookupWeek, record.length),
      weight: buildMetricAssessmentSnapshot('weight', archive.sex, lookupWeek, record.weight),
      headCircumference: buildMetricAssessmentSnapshot('headCircumference', archive.sex, lookupWeek, record.headCircumference),
    },
  };
}

function MetricAssessmentCell({
  metric,
  assessment,
}: {
  metric: MetricKey;
  assessment: MetricAssessmentValue;
}) {
  if (!assessment) {
    return <div className="min-w-[130px] text-sm text-slate-400">未记录</div>;
  }

  return (
    <div className="min-w-[130px]">
      <div className="text-sm font-medium text-slate-900">
        {formatMetricValue(assessment.value, metric)} {METRIC_CONFIG[metric].unit}
      </div>
      <div className="mt-1 text-xs font-medium text-slate-500">P区间：{assessment.bandLabel}</div>
      <div className="mt-1 text-xs text-slate-400">
        {typeof assessment.approxPercentile === 'number'
          ? `约 P${Math.round(assessment.approxPercentile)} · ${assessment.zoneLabel}`
          : assessment.zoneLabel}
      </div>
    </div>
  );
}

function MetricAssessmentSummaryCell({
  metric,
  assessment,
}: {
  metric: MetricKey;
  assessment: MetricAssessmentValue;
}) {
  if (!assessment) {
    return (
      <div className="min-w-[130px]">
        <div className="text-sm font-medium text-slate-400">未记录</div>
      </div>
    );
  }

  const percentileText =
    typeof assessment.approxPercentile === 'number'
      ? `约 P${Math.round(assessment.approxPercentile)} · ${assessment.zoneLabel}`
      : assessment.zoneLabel;

  return (
    <div className="min-w-[130px]">
      <div className="text-sm font-medium text-slate-900">
        {formatMetricValue(assessment.value, metric)} {METRIC_CONFIG[metric].unit}
      </div>
      <div className="mt-1 text-xs font-medium text-slate-500">P区间：{assessment.bandLabel}</div>
      <div className="mt-1 text-xs text-slate-400">{percentileText}</div>
    </div>
  );
}

function formatLatestMetricsSummary(metrics: DoctorNeonateArchiveSummary['latestMetrics']) {
  if (!metrics) {
    return ' 暂无';
  }

  const parts = [
    metrics.length != null ? `身长 ${formatMetricValue(metrics.length, 'length')}cm` : null,
    metrics.weight != null ? `体重 ${formatMetricValue(metrics.weight, 'weight')}kg` : null,
    metrics.headCircumference != null
      ? `头围 ${formatMetricValue(metrics.headCircumference, 'headCircumference')}cm`
      : null,
    metrics.bilirubinUmol != null ? `TSB ${formatBilirubinDisplay(metrics.bilirubinUmol)}` : null,
  ].filter(Boolean);

  return parts.length ? ` ${parts.join(' / ')}` : ' 暂无';
}

function interpolateJaundiceCurveValue(points: JaundiceCurvePoint[], hours: number) {
  const safeHours = Math.max(points[0]?.hours ?? 0, hours);
  const clampedHours = Math.min(points[points.length - 1]?.hours ?? safeHours, safeHours);
  const lower = [...points].reverse().find((point) => point.hours <= clampedHours) || points[0];
  const upper = points.find((point) => point.hours >= clampedHours) || points[points.length - 1];

  if (!lower || !upper) {
    return 0;
  }

  if (lower.hours === upper.hours) {
    return lower.umol;
  }

  const ratio = (clampedHours - lower.hours) / (upper.hours - lower.hours);
  return lower.umol + (upper.umol - lower.umol) * ratio;
}

function getJaundiceRiskBand(umolValue: number, hours: number): JaundiceRiskBand {
  const p40 = interpolateJaundiceCurveValue(BHUTANI_TSB_CURVES.p40, hours);
  const p75 = interpolateJaundiceCurveValue(BHUTANI_TSB_CURVES.p75, hours);
  const p95 = interpolateJaundiceCurveValue(BHUTANI_TSB_CURVES.p95, hours);

  if (umolValue < p40) {
    return '<P40';
  }

  if (umolValue < p75) {
    return 'P40-P75';
  }

  if (umolValue < p95) {
    return 'P75-P95';
  }

  return '>=P95';
}

function formatJaundiceRiskBand(riskBand: JaundiceRiskBand) {
  return riskBand;
}

function getRecordJaundiceAssessment(
  archive: Pick<DoctorNeonateArchiveDetail, 'birthDate' | 'birthTime'>,
  record: DoctorNeonateGrowthRecordView,
) {
  if (record.bilirubinUmol == null) {
    return null;
  }

  const ageHoursContext = getRecordAgeHoursContext({
    birthDate: archive.birthDate,
    birthTime: archive.birthTime,
    recordDate: record.recordDate,
    recordTime: record.recordTime,
  });

  return {
    ageHours: ageHoursContext.hours,
    ageHoursEstimated: ageHoursContext.estimated,
    riskBand: getJaundiceRiskBand(record.bilirubinUmol, ageHoursContext.hours),
  };
}

function InlineNotice({
  tone,
  message,
}: {
  tone: 'success' | 'error' | 'neutral';
  message: string;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-slate-200 bg-slate-50 text-slate-600';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>{message}</div>;
}

function BilirubinContextBadge({
  context,
  className = '',
}: {
  context: DoctorNeonateBilirubinContext | null | undefined;
  className?: string;
}) {
  const meta = context ? BILIRUBIN_CONTEXT_META[context] : null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        meta ? meta.badgeClass : 'border border-slate-200 bg-slate-50 text-slate-500'
      } ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta ? meta.dotClass : 'bg-slate-300'}`} />
      {meta ? meta.label : '未标注'}
    </span>
  );
}

function BilirubinContextSelector({
  value,
  onChange,
}: {
  value: DoctorNeonateBilirubinContext;
  onChange: (value: DoctorNeonateBilirubinContext) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(BILIRUBIN_CONTEXT_META) as DoctorNeonateBilirubinContext[]).map((context) => {
        const meta = BILIRUBIN_CONTEXT_META[context];
        const active = value === context;
        return (
          <button
            key={context}
            type="button"
            onClick={() => onChange(context)}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
              active ? meta.badgeClass : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function MobileEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function GrowthTooltip({ active, payload, metric }: GrowthTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const target = payload.find(
    (entry) => entry.dataKey === 'value' && typeof entry.value === 'number' && entry.payload?.recordId,
  );

  if (!target || typeof target.value !== 'number' || !target.payload) {
    return null;
  }

  const config = METRIC_CONFIG[metric];

  return (
    <div className="min-w-[210px] rounded-2xl border border-slate-100 bg-white/95 px-4 py-3 shadow-lg shadow-slate-200/60 backdrop-blur">
      <div className="text-xs font-semibold tracking-wide text-indigo-600">
        {target.payload.recordDateTime || formatOptionalDateTimeDisplay(target.payload.recordDate || null, target.payload.recordTime)}
      </div>
      <div className="mt-1 text-xs text-slate-500">当前胎龄：{target.payload.gestationLabel}</div>
      {target.payload.ageHoursEstimated ? <div className="mt-1 text-xs text-amber-600">时间缺失，X 轴位置按 00:00 估算</div> : null}
      <div className="mt-2 text-sm font-semibold text-slate-900">
        {config.label}：{formatMetricValue(target.value, metric)}
        {config.unit}
      </div>
      <div className="mt-2 text-xs leading-6 text-slate-600">
        <div>百分位区间：{target.payload.bandLabel}</div>
        <div>判断：{target.payload.zoneLabel}</div>
        {typeof target.payload.approxPercentile === 'number' ? (
          <div>估算百分位：约 P{Math.round(target.payload.approxPercentile)}</div>
        ) : null}
      </div>
    </div>
  );
}

function GrowthTooltipCard({ active, payload, metric }: GrowthTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const target = payload.find(
    (entry) => entry.dataKey === 'value' && typeof entry.value === 'number' && entry.payload?.recordId,
  );

  if (!target || typeof target.value !== 'number' || !target.payload) {
    return null;
  }

  const config = METRIC_CONFIG[metric];

  return (
    <div className="min-w-[210px] rounded-2xl border border-slate-100 bg-white/95 px-4 py-3 shadow-lg shadow-slate-200/60 backdrop-blur">
      <div className="text-xs font-semibold tracking-wide text-indigo-600">
        {target.payload.recordDateTime || formatOptionalDateTimeDisplay(target.payload.recordDate || null, target.payload.recordTime)}
      </div>
      <div className="mt-1 text-xs text-slate-500">当前胎龄：{target.payload.gestationLabel}</div>
      <div className="mt-1 text-xs text-slate-400">{target.payload.lookupWeekLabel}</div>
      {target.payload.ageHoursEstimated ? <div className="mt-1 text-xs text-amber-600">时间缺失，X 轴位置按 00:00 估算</div> : null}
      <div className="mt-2 text-sm font-semibold text-slate-900">
        {config.label}：{formatMetricValue(target.value, metric)}
        {config.unit}
      </div>
      <div className="mt-2 text-xs leading-6 text-slate-600">
        <div>P区间：{target.payload.bandLabel}</div>
        <div>判断：{target.payload.zoneLabel}</div>
        {typeof target.payload.approxPercentile === 'number' ? (
          <div>估算百分位：约 P{Math.round(target.payload.approxPercentile)}</div>
        ) : null}
      </div>
    </div>
  );
}

function buildTicks(maxDomain: number) {
  const roundedMax = Math.max(42, Math.ceil(maxDomain));
  const ticks: number[] = [];
  for (let week = 24; week <= roundedMax; week += 2) {
    ticks.push(week);
  }
  if (!ticks.includes(roundedMax)) {
    ticks.push(roundedMax);
  }
  return ticks;
}

function buildMetricChartRows(metric: MetricKey, sex: SexKey, evaluatedRecords: EvaluatedRecordRow[]) {
  const referenceRows = REFERENCE_CURVES[sex][metric].map((point) => ({
    x: point.week,
    p3: point.p3,
    p10: point.p10,
    p25: point.p25,
    p50: point.p50,
    p75: point.p75,
    p90: point.p90,
    p97: point.p97,
  }));

  const recordRows = evaluatedRecords
    .map(({ record, x, gestationLabel, lookupWeek, lookupWeekLabel, metrics, ageHoursEstimated }) => {
      const assessment = metrics[metric];
      if (!assessment) {
        return null;
      }

      return {
        x,
        recordId: record.id,
        recordDate: record.recordDate,
        recordTime: record.recordTime,
        recordDateTime: formatDateTimeDisplay(record.recordDate, record.recordTime),
        gestationLabel,
        lookupWeek,
        lookupWeekLabel,
        value: assessment.value,
        bandLabel: assessment.bandLabel,
        zoneLabel: assessment.zoneLabel,
        approxPercentile: assessment.approxPercentile,
        ageHoursEstimated,
      } satisfies ChartRow;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return [...referenceRows, ...recordRows].sort((left, right) => left.x - right.x);
}

function JaundiceChart({
  birthDate,
  records,
  selectedRecordId,
  onSelectRecord,
}: {
  birthDate: string;
  records: DoctorNeonateGrowthRecordView[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
}) {
  const jaundiceRecords = records.filter((r) => r.bilirubinUmol != null);
  if (!jaundiceRecords.length) return null;

  const birthMs = new Date(birthDate).getTime();
  const chartData = jaundiceRecords.map((r) => {
    const hours = Math.round((new Date(r.recordDate).getTime() - birthMs) / (1000 * 60 * 60));
    return {
      id: r.id,
      hours: Math.max(0, hours),
      umol: r.bilirubinUmol!,
      mg: umolToMg(r.bilirubinUmol!),
    };
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 40, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="hours"
            type="number"
            domain={['dataMin - 2', 'dataMax + 2']}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            label={{ value: '出生后小时数', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: '#94a3b8' }}
          />
          <YAxis
            yAxisId="umol"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            label={{ value: 'μmol/L', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }}
          />
          <YAxis
            yAxisId="mg"
            orientation="right"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            label={{ value: 'mg/dL', angle: 90, position: 'insideRight', offset: 10, fontSize: 11, fill: '#94a3b8' }}
          />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === 'umol' ? [`${value.toFixed(1)} μmol/L`, '胆红素'] : [`${value.toFixed(1)} mg/dL`, '胆红素']
            }
            labelFormatter={(hours: number) => `出生后 ${hours} 小时`}
          />
          <Line
            yAxisId="umol"
            type="monotone"
            dataKey="umol"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { id: string } };
              const active = payload.id === selectedRecordId;
              return (
                <circle
                  key={payload.id}
                  cx={cx}
                  cy={cy}
                  r={active ? 6 : 4}
                  fill={active ? '#f59e0b' : '#fbbf24'}
                  stroke={active ? '#92400e' : '#f59e0b'}
                  strokeWidth={active ? 2 : 1.5}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectRecord(payload.id)}
                />
              );
            }}
            activeDot={false}
          />
          <Line yAxisId="mg" type="monotone" dataKey="mg" stroke="transparent" dot={false} activeDot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function JaundiceTooltipCard({ active, payload }: JaundiceTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const target = payload.find(
    (entry) => entry.dataKey === 'umol' && typeof entry.value === 'number' && entry.payload?.recordId,
  );

  if (!target || typeof target.value !== 'number' || !target.payload) {
    return null;
  }

  return (
    <div className="min-w-[220px] rounded-2xl border border-amber-100 bg-white/95 px-4 py-3 shadow-lg shadow-amber-100/60 backdrop-blur">
      <div className="text-xs font-semibold tracking-wide text-amber-600">
        {target.payload.recordDateTime || formatOptionalDateTimeDisplay(target.payload.recordDate || null, target.payload.recordTime)}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        出生后 {formatHoursDisplay(target.payload.hours)} 小时
        {target.payload.hoursEstimated ? '（估算）' : ''}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900">
        TSB：{target.payload.umol?.toFixed(1)} μmol/L
      </div>
      <div className="mt-1 text-xs text-slate-500">{target.payload.mg?.toFixed(1)} mg/dL</div>
      <div className="mt-2 text-xs leading-6 text-slate-600">
        <div>风险区间：{target.payload.riskBand ? formatJaundiceRiskBand(target.payload.riskBand) : '—'}</div>
        <div>环境状态：{formatBilirubinContextLabel(target.payload.bilirubinContext)}</div>
        {target.payload.hoursEstimated ? <div>提示：出生时间或记录时间缺失，小时数按 00:00 估算。</div> : null}
      </div>
    </div>
  );
}

function JaundiceChartV2({
  birthDate,
  birthTime,
  records,
  selectedRecordId,
  onSelectRecord,
}: {
  birthDate: string;
  birthTime: string | null;
  records: DoctorNeonateGrowthRecordView[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
}) {
  const jaundiceRecords = records.filter((record) => record.bilirubinUmol != null);
  if (!jaundiceRecords.length) {
    return null;
  }

  const recordRows = jaundiceRecords.map((record) => {
    const ageHoursContext = getRecordAgeHoursContext({
      birthDate,
      birthTime,
      recordDate: record.recordDate,
      recordTime: record.recordTime,
    });
    return {
      recordId: record.id,
      recordDate: record.recordDate,
      recordTime: record.recordTime,
      recordDateTime: formatDateTimeDisplay(record.recordDate, record.recordTime),
      hours: ageHoursContext.hours,
      umol: record.bilirubinUmol!,
      mg: umolToMg(record.bilirubinUmol!),
      riskBand: getJaundiceRiskBand(record.bilirubinUmol!, ageHoursContext.hours),
      bilirubinContext: record.bilirubinContext,
      hoursEstimated: ageHoursContext.estimated,
    };
  });

  const hasEstimatedRows = recordRows.some((row) => row.hoursEstimated);
  const hasUnlabeledRows = recordRows.some((row) => !row.bilirubinContext);

  const mergedHours = Array.from(
    new Set([
      ...BHUTANI_TSB_CURVES.p40.map((point) => point.hours),
      ...BHUTANI_TSB_CURVES.p75.map((point) => point.hours),
      ...BHUTANI_TSB_CURVES.p95.map((point) => point.hours),
      ...recordRows.map((row) => row.hours),
    ]),
  ).sort((left, right) => left - right);

  const chartData = mergedHours.map((hours) => {
    const recordRow = recordRows.find((row) => Math.abs(row.hours - hours) < 0.0001) || null;
    return {
      hours,
      p40: interpolateJaundiceCurveValue(BHUTANI_TSB_CURVES.p40, hours),
      p75: interpolateJaundiceCurveValue(BHUTANI_TSB_CURVES.p75, hours),
      p95: interpolateJaundiceCurveValue(BHUTANI_TSB_CURVES.p95, hours),
      ...(recordRow ?? {}),
    } satisfies JaundiceChartRow;
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-700">
          <span className={`h-2.5 w-2.5 rounded-full ${BILIRUBIN_CONTEXT_META.AMBIENT.dotClass}`} />
          {BILIRUBIN_CONTEXT_META.AMBIENT.label}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 font-medium text-sky-700">
          <span className="h-2.5 w-2.5 rounded-sm border border-sky-500 bg-white" />
          {BILIRUBIN_CONTEXT_META.PHOTOTHERAPY.label}
        </div>
        {hasUnlabeledRows ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 font-medium text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full border border-slate-400 bg-white" />
            未标注
          </div>
        ) : null}
        {hasEstimatedRows ? <div>部分历史点缺少出生时间或记录时间，小时数按 00:00 估算。</div> : null}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 12, right: 44, bottom: 6, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="hours"
            type="number"
            domain={[0, Math.max(144, Math.ceil((chartData[chartData.length - 1]?.hours || 0) / 12) * 12)]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            label={{ value: '出生后小时数', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: '#94a3b8' }}
          />
          <YAxis
            yAxisId="umol"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            label={{ value: 'μmol/L', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#94a3b8' }}
          />
          <YAxis
            yAxisId="mg"
            orientation="right"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            label={{ value: 'mg/dL', angle: 90, position: 'insideRight', offset: 10, fontSize: 11, fill: '#94a3b8' }}
          />
          <Tooltip content={<JaundiceTooltipCard />} cursor={{ stroke: '#fde68a', strokeDasharray: '4 4' }} />
          <Line yAxisId="umol" type="monotone" dataKey="p40" stroke="#5f8f6b" strokeWidth={2} dot={false} connectNulls />
          <Line yAxisId="umol" type="monotone" dataKey="p75" stroke="#b73a4a" strokeWidth={2} dot={false} connectNulls />
          <Line yAxisId="umol" type="monotone" dataKey="p95" stroke="#1692b8" strokeWidth={2} dot={false} connectNulls />
          <Line
            yAxisId="umol"
            type="monotone"
            dataKey="umol"
            stroke={BILIRUBIN_CONTEXT_META.AMBIENT.lineStroke}
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: JaundiceChartRow };
              if (!payload.recordId) {
                return <circle cx={cx} cy={cy} r={0} fill="transparent" stroke="transparent" />;
              }

              const active = payload.recordId === selectedRecordId;
              const unlabeled = !payload.bilirubinContext;
              const contextMeta = payload.bilirubinContext ? BILIRUBIN_CONTEXT_META[payload.bilirubinContext] : null;
              const size = active ? 12 : 9;

              if (payload.bilirubinContext === 'PHOTOTHERAPY') {
                return (
                  <rect
                    key={payload.recordId}
                    x={cx - size / 2}
                    y={cy - size / 2}
                    width={size}
                    height={size}
                    rx={2}
                    fill={contextMeta?.fill}
                    stroke={contextMeta?.stroke}
                    strokeWidth={active ? 2.5 : 1.8}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectRecord(payload.recordId!)}
                  />
                );
              }

              return (
                <circle
                  key={payload.recordId}
                  cx={cx}
                  cy={cy}
                  r={active ? 6 : 4.5}
                  fill={unlabeled ? '#ffffff' : contextMeta?.fill}
                  stroke={unlabeled ? '#94a3b8' : contextMeta?.stroke}
                  strokeWidth={active ? 2.5 : 1.8}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectRecord(payload.recordId!)}
                />
              );
            }}
            activeDot={false}
          />
          <Line yAxisId="mg" type="monotone" dataKey="mg" stroke="transparent" dot={false} activeDot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricChart({
  metric,
  sex,
  evaluatedRecords,
  selectedRecordId,
  onSelectRecord,
  xDomain,
  xTicks,
  isCompactViewport,
}: MetricChartProps) {
  const config = METRIC_CONFIG[metric];
  const data = useMemo(
    () => buildMetricChartRows(metric, sex, evaluatedRecords),
    [evaluatedRecords, metric, sex],
  );

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{config.label}</div>
        <div className="text-xs text-slate-500">{config.unit}</div>
      </div>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 18, right: 46, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              domain={xDomain}
              ticks={xTicks}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={formatGestationTick}
              hide={metric !== 'headCircumference'}
            />
            <YAxis
              domain={[config.min, config.max]}
              ticks={config.ticks}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fill: '#64748b', fontSize: 11 }}
              width={48}
            />
            <Tooltip content={<GrowthTooltipCard metric={metric} />} cursor={{ stroke: '#c7d2fe', strokeDasharray: '4 4' }} />

            {PERCENTILE_LINES.map((line) => (
              <Line
                key={`${metric}-${line.key}`}
                type="monotone"
                dataKey={line.key}
                stroke={line.stroke}
                strokeWidth={line.strokeWidth}
                strokeDasharray={line.dasharray}
                dot={false}
                connectNulls
                isAnimationActive={false}
              >
                <LabelList content={createTerminalLabelRenderer(line.label, line.stroke)} />
              </Line>
            ))}

            <Line
              type="monotone"
              dataKey="value"
              stroke={isCompactViewport ? 'transparent' : config.color}
              strokeWidth={3}
              connectNulls
              activeDot={isCompactViewport ? false : { r: 7, strokeWidth: 2, stroke: '#ffffff', fill: config.color }}
              dot={(props) => {
                const payload = props.payload as ChartRow;
                const dotKey = payload.recordId
                  ? `${metric}-${payload.recordId}`
                  : `${metric}-ghost-${props.index ?? `${String(props.cx)}-${String(props.cy)}`}`;

                if (!payload.recordId) {
                  return (
                    <circle
                      key={dotKey}
                      cx={props.cx}
                      cy={props.cy}
                      r={0}
                      fill="transparent"
                      stroke="transparent"
                    />
                  );
                }

                const isActive = payload.recordId === selectedRecordId;
                const cx = typeof props.cx === 'string' ? Number(props.cx) : props.cx;
                const cy = typeof props.cy === 'string' ? Number(props.cy) : props.cy;
                if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
                  return <circle key={dotKey} cx={0} cy={0} r={0} fill="transparent" stroke="transparent" />;
                }

                const radius = isCompactViewport ? (isActive ? 4.75 : 2.5) : isActive ? 6 : 4.5;
                const fill = isCompactViewport ? (isActive ? '#f59e0b' : '#ffffff') : isActive ? '#f59e0b' : config.color;
                const stroke = isCompactViewport ? (isActive ? '#ffffff' : config.color) : '#ffffff';
                const strokeWidth = isCompactViewport ? (isActive ? 2.25 : 1.75) : isActive ? 2.5 : 2;

                return (
                  <circle
                    key={dotKey}
                    cx={cx as number}
                    cy={cy as number}
                    r={radius}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    className="cursor-pointer"
                    onClick={() => onSelectRecord(payload.recordId!)}
                  />
                );
              }}
            />
            {isCompactViewport ? (
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={3}
                connectNulls
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: 'none' }}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function defaultArchiveForm(): ArchiveFormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    babyName: '',
    sex: 'boy',
    birthGestationWeeks: '32',
    birthGestationDays: '0',
    birthDate: today,
    birthTime: '',
  };
}

function defaultRecordForm(): RecordFormState {
  return {
    recordDate: new Date().toISOString().slice(0, 10),
    recordTime: getCurrentTimeValue(),
    length: '',
    weight: '',
    headCircumference: '',
    bilirubinValue: '',
    bilirubinUnit: 'umol',
    bilirubinContext: 'AMBIENT',
  };
}

function archiveToForm(detail: DoctorNeonateArchiveDetail): ArchiveFormState {
  return {
    babyName: detail.babyName,
    sex: detail.sex,
    birthGestationWeeks: String(detail.birthGestation.weeks),
    birthGestationDays: String(detail.birthGestation.days),
    birthDate: detail.birthDate,
    birthTime: detail.birthTime ?? '',
  };
}

export default function NeonateWardManager() {
  const { authHeaders } = useAuthSession();
  const isCompactViewport = useCompactViewport();
  const [archives, setArchives] = useState<DoctorNeonateArchiveSummary[]>([]);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [selectedArchive, setSelectedArchive] = useState<DoctorNeonateArchiveDetail | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sexFilter, setSexFilter] = useState<'ALL' | SexKey>('ALL');
  const [gestationFrom, setGestationFrom] = useState('');
  const [gestationTo, setGestationTo] = useState('');
  const [archiveForm, setArchiveForm] = useState<ArchiveFormState>(defaultArchiveForm());
  const [editForm, setEditForm] = useState<ArchiveFormState>(defaultArchiveForm());
  const [recordForm, setRecordForm] = useState<RecordFormState>(defaultRecordForm());
  const [candidateMatches, setCandidateMatches] = useState<DoctorNeonateArchiveSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [listError, setListError] = useState('');
  const [formError, setFormError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [recordError, setRecordError] = useState('');
  const [status, setStatus] = useState('');
  const [accessData, setAccessData] = useState<{
    effectiveAccessRole: 'OWNER' | 'COLLABORATOR' | 'READONLY';
    ownerDoctorProfile: {
      id: string;
      realName: string;
      hospitalName: string;
      departmentName: string;
      title: string;
    } | null;
    grants: NeonateAccessGrant[];
    shareableTeams: ShareableTeam[];
  } | null>(null);
  const [shareTeamId, setShareTeamId] = useState('');
  const [shareDoctorId, setShareDoctorId] = useState('');
  const [shareRole, setShareRole] = useState<'COLLABORATOR' | 'READONLY'>('COLLABORATOR');
  const [mobileTab, setMobileTab] = useState<MobileTabKey>('ledger');
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
  const [mobileCollaborationOpen, setMobileCollaborationOpen] = useState(false);

  const loadArchives = async () => {
    setListLoading(true);
    setListError('');

    try {
      const url = new URL('/api/doctor/neonates', window.location.origin);
      if (search.trim()) {
        url.searchParams.set('q', search.trim());
      }
      if (sexFilter !== 'ALL') {
        url.searchParams.set('sex', sexFilter);
      }
      if (gestationFrom.trim()) {
        url.searchParams.set('birthGestationWeeksFrom', gestationFrom.trim());
      }
      if (gestationTo.trim()) {
        url.searchParams.set('birthGestationWeeksTo', gestationTo.trim());
      }

      const response = await fetch(url.toString(), { headers: authHeaders, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载病房宝宝列表失败');
      }

      const nextArchives = Array.isArray(data.archives) ? (data.archives as DoctorNeonateArchiveSummary[]) : [];
      setArchives(nextArchives);
      setSelectedArchiveId((current) => {
        if (current && nextArchives.some((archive) => archive.id === current)) {
          return current;
        }
        return nextArchives[0]?.id || null;
      });
    } catch (error) {
      setListError(error instanceof Error ? error.message : '加载病房宝宝列表失败');
    } finally {
      setListLoading(false);
    }
  };

  const loadArchiveDetail = async (archiveId: string) => {
    setDetailLoading(true);
    setDetailError('');

    try {
      const [detailResponse, accessResponse] = await Promise.all([
        fetch(`/api/doctor/neonates/${archiveId}`, { headers: authHeaders, cache: 'no-store' }),
        fetch(`/api/doctor/neonates/${archiveId}/access`, { headers: authHeaders, cache: 'no-store' }),
      ]);
      const detailData = await detailResponse.json().catch(() => ({}));
      const accessPayload = await accessResponse.json().catch(() => ({}));
      if (!detailResponse.ok) {
        throw new Error(detailData.error || '加载宝宝详情失败');
      }

      const archive = normalizeArchiveDetail(detailData.archive as DoctorNeonateArchiveDetail);
      setSelectedArchive(archive);
      setEditForm(archiveToForm(archive));
      setSelectedRecordId(getLatestRecord(archive.records)?.id || null);
      if (accessResponse.ok) {
        setAccessData(accessPayload);
        setShareTeamId((current) => current || accessPayload.shareableTeams?.[0]?.id || '');
      } else {
        setAccessData(null);
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : '加载宝宝详情失败');
      setSelectedArchive(null);
      setAccessData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadArchives();
  }, [authHeaders, gestationFrom, gestationTo, search, sexFilter]);

  useEffect(() => {
    if (!selectedArchiveId) {
      setSelectedArchive(null);
      return;
    }

    void loadArchiveDetail(selectedArchiveId);
  }, [authHeaders, selectedArchiveId]);

  const evaluatedRecords = useMemo(
    () => (selectedArchive ? selectedArchive.records.map((record) => evaluateRecordForDisplay(selectedArchive, record)) : []),
    [selectedArchive],
  );

  const xDomain = useMemo<[number, number]>(() => {
    const maxRecordX = evaluatedRecords.length
      ? Math.max(...evaluatedRecords.map((record) => record.x))
      : 42;
    return [24, Math.max(42, Math.ceil(maxRecordX) + 1)] as [number, number];
  }, [evaluatedRecords]);

  const xTicks = useMemo(() => buildTicks(xDomain[1]), [xDomain]);
  const effectiveAccessRole = selectedArchive?.effectiveAccessRole || accessData?.effectiveAccessRole || 'OWNER';
  const canManageArchive = effectiveAccessRole === 'OWNER';
  const canWriteRecord = effectiveAccessRole !== 'READONLY';
  const shareableTeams = accessData?.shareableTeams || [];
  const currentShareTeam = shareableTeams.find((team) => team.id === shareTeamId) || shareableTeams[0] || null;
  const currentShareDoctors = currentShareTeam?.members || [];

  const handleCreateArchive = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setArchiveSubmitting(true);
    setFormError('');
    setStatus('');

    try {
      const response = await fetch('/api/doctor/neonates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          babyName: archiveForm.babyName.trim(),
          sex: archiveForm.sex,
          birthGestationWeeks: Number(archiveForm.birthGestationWeeks),
          birthGestationDays: Number(archiveForm.birthGestationDays),
          birthDate: archiveForm.birthDate,
          birthTime: archiveForm.birthTime,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 409 && data.status === 'multiple_matches') {
        setCandidateMatches(Array.isArray(data.candidates) ? data.candidates : []);
        setStatus('匹配到多个现有档案，请先手动选择。');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || '创建或匹配档案失败');
      }

      setCandidateMatches([]);
      setSelectedArchiveId(data.archive.id);
      setArchiveForm(defaultArchiveForm());
      setMobileCreateOpen(false);
      setMobileTab('record');
      setStatus(data.status === 'matched' ? '已匹配到现有病房档案。' : '已创建新的病房宝宝档案。');
      await loadArchives();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '创建或匹配档案失败');
    } finally {
      setArchiveSubmitting(false);
    }
  };

  const handleUpdateArchive = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedArchiveId) {
      return;
    }

    setArchiveSaving(true);
    setFormError('');
    setStatus('');

    try {
      const response = await fetch(`/api/doctor/neonates/${selectedArchiveId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          babyName: editForm.babyName.trim(),
          sex: editForm.sex,
          birthGestationWeeks: Number(editForm.birthGestationWeeks),
          birthGestationDays: Number(editForm.birthGestationDays),
          birthDate: editForm.birthDate,
          ...(editForm.birthTime ? { birthTime: editForm.birthTime } : {}),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '更新病房档案失败');
      }

      const archive = normalizeArchiveDetail(data.archive as DoctorNeonateArchiveDetail);
      setSelectedArchive(archive);
      setEditForm(archiveToForm(archive));
      setSelectedRecordId(getLatestRecord(archive.records)?.id || null);
      setStatus('宝宝档案信息已更新。');
      await loadArchives();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '更新病房档案失败');
    } finally {
      setArchiveSaving(false);
    }
  };

  const handleSaveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedArchiveId) {
      return;
    }

    if (
      !recordForm.length.trim() &&
      !recordForm.weight.trim() &&
      !recordForm.headCircumference.trim() &&
      !recordForm.bilirubinValue.trim()
    ) {
      setRecordError('请至少填写一个指标后再保存。');
      return;
    }

    if (recordForm.bilirubinValue.trim() && !recordForm.bilirubinContext) {
      setRecordError('填写胆红素时请选择普通环境或蓝光中。');
      return;
    }

    setRecordSaving(true);
    setRecordError('');
    setStatus('');

    try {
      const response = await fetch(`/api/doctor/neonates/${selectedArchiveId}/records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          recordDate: recordForm.recordDate,
          recordTime: recordForm.recordTime,
          ...(recordForm.length ? { length: Number(recordForm.length) } : {}),
          ...(recordForm.weight ? { weight: Number(recordForm.weight) } : {}),
          ...(recordForm.headCircumference ? { headCircumference: Number(recordForm.headCircumference) } : {}),
          ...(recordForm.bilirubinValue
            ? {
                bilirubinUmol:
                  recordForm.bilirubinUnit === 'umol'
                    ? Number(recordForm.bilirubinValue)
                    : mgToUmol(Number(recordForm.bilirubinValue)),
                bilirubinContext: recordForm.bilirubinContext,
              }
            : {}),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '保存三围记录失败');
      }

      const archive = normalizeArchiveDetail(data.archive as DoctorNeonateArchiveDetail);
      setSelectedArchive(archive);
      setSelectedRecordId(data.record.id);
      setRecordForm((current) => ({
        ...defaultRecordForm(),
        recordDate: current.recordDate,
        bilirubinUnit: current.bilirubinUnit,
      }));
      setStatus('三围记录已保存。');
      await loadArchives();
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : '保存三围记录失败');
    } finally {
      setRecordSaving(false);
    }
  };

  const recordsDescending = useMemo(() => [...evaluatedRecords].reverse(), [evaluatedRecords]);
  const activeRecordRow = useMemo(
    () => recordsDescending.find(({ record }) => record.id === selectedRecordId) || recordsDescending[0] || null,
    [recordsDescending, selectedRecordId],
  );
  const activeRecordDate = activeRecordRow
    ? formatDateTimeDisplay(activeRecordRow.record.recordDate, activeRecordRow.record.recordTime)
    : '未选择';

  useEffect(() => {
    if (!selectedArchiveId) {
      setMobileTab('ledger');
      setMobileCollaborationOpen(false);
    }
  }, [selectedArchiveId]);

  useEffect(() => {
    setShareDoctorId((current) =>
      currentShareDoctors.some((doctor) => doctor.doctorProfileId === current)
        ? current
        : currentShareDoctors[0]?.doctorProfileId || '',
    );
  }, [shareTeamId, currentShareDoctors]);

  const submitGrant = async () => {
    if (!selectedArchiveId || !canManageArchive || !shareTeamId || !shareDoctorId) {
      return;
    }

    setStatus('');
    setFormError('');

    try {
      const response = await fetch(`/api/doctor/neonates/${selectedArchiveId}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          targetDoctorProfileId: shareDoctorId,
          sourceTeamId: shareTeamId,
          accessRole: shareRole,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '共享病房档案失败');
      }

      setStatus('病房档案共享权限已更新。');
      await loadArchiveDetail(selectedArchiveId);
      await loadArchives();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '共享病房档案失败');
    }
  };

  const updateGrantRole = async (grantId: string, accessRole: 'COLLABORATOR' | 'READONLY') => {
    if (!selectedArchiveId || !canManageArchive) {
      return;
    }

    const response = await fetch(`/api/doctor/neonates/${selectedArchiveId}/access/${grantId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ accessRole }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setFormError(data.error || '更新共享角色失败');
      return;
    }

    setStatus('病房共享角色已更新。');
    await loadArchiveDetail(selectedArchiveId);
    await loadArchives();
  };

  const revokeGrant = async (grantId: string) => {
    if (!selectedArchiveId || !canManageArchive) {
      return;
    }

    const response = await fetch(`/api/doctor/neonates/${selectedArchiveId}/access/${grantId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setFormError(data.error || '撤销共享失败');
      return;
    }

    setStatus('病房共享权限已撤销。');
    await loadArchiveDetail(selectedArchiveId);
    await loadArchives();
  };

  const handleMobileArchiveSelect = (archiveId: string) => {
    setSelectedArchiveId(archiveId);
    setCandidateMatches([]);
    setMobileCreateOpen(false);
    setMobileTab('record');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">新生儿病房</h1>
        <p className="mt-2 text-sm text-slate-500">面向病房医生管理多个宝宝档案，按出生胎龄自动计算当前胎龄，并在单页查看三围记录表与三联生长图。</p>
      </div>

      {status ? (
        <div className="hidden rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 xl:block">
          {status}
        </div>
      ) : null}

      <div className="space-y-4 xl:hidden">
        <div className="sticky top-0 z-20 -mx-4 space-y-3 bg-slate-50/95 px-4 pb-3 backdrop-blur">
          {selectedArchive && !detailLoading && mobileTab !== 'ledger' ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-600">Current Baby</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{selectedArchive.babyName}</div>
                  <div className="mt-2 text-xs leading-6 text-slate-500">
                    {SEX_LABELS[selectedArchive.sex]} · 出生胎龄 {selectedArchive.birthGestation.weeks}周{selectedArchive.birthGestation.days}天
                  </div>
                  <div className="text-xs leading-6 text-slate-500">
                    最近记录：{formatOptionalDateTimeDisplay(selectedArchive.latestRecordDate, selectedArchive.latestRecordTime)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileTab('ledger')}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  切换宝宝
                </button>
              </div>
            </section>
          ) : null}

          <div className="grid grid-cols-4 gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
            {MOBILE_TAB_LABELS.map((tab) => {
              const active = mobileTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setMobileTab(tab.key)}
                  className={`rounded-2xl px-2 py-2.5 text-sm font-semibold transition ${
                    active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {mobileTab === 'ledger' ? (
          <div className="space-y-4 pb-24">
            {status ? <InlineNotice tone="success" message={status} /> : null}

            {selectedArchive && !detailLoading ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-600">Ward Focus</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{selectedArchive.babyName}</div>
                    <div className="mt-2 text-xs leading-6 text-slate-500">
                      {SEX_LABELS[selectedArchive.sex]} · 出生胎龄 {selectedArchive.birthGestation.weeks}周{selectedArchive.birthGestation.days}天
                    </div>
                    <div className="text-xs leading-6 text-slate-500">
                      最近记录：{formatOptionalDateTimeDisplay(selectedArchive.latestRecordDate, selectedArchive.latestRecordTime)} · 共{' '}
                      {selectedArchive.recordCount} 条
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {selectedArchive.effectiveAccessRole === 'OWNER'
                      ? '主责'
                      : selectedArchive.effectiveAccessRole === 'COLLABORATOR'
                        ? '协作'
                        : '只读'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileTab('record')}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    去记录
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileTab('growth')}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    看生长
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileTab('profile')}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    查档案
                  </button>
                </div>
              </section>
            ) : null}

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">病房台账</h2>
                  <p className="mt-1 text-sm text-slate-500">先选宝宝，再进入记录、生长或档案操作。</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadArchives()}
                  className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  title="刷新列表"
                >
                  <RefreshCcw className={`h-4 w-4 ${listLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="搜索宝宝姓名"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm outline-none focus:border-indigo-300"
                  />
                </div>

                <div className="grid gap-3">
                  <select
                    value={sexFilter}
                    onChange={(event) => setSexFilter(event.target.value as 'ALL' | SexKey)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                  >
                    <option value="ALL">全部性别</option>
                    <option value="boy">男</option>
                    <option value="girl">女</option>
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min={20}
                      max={45}
                      value={gestationFrom}
                      onChange={(event) => setGestationFrom(event.target.value)}
                      placeholder="胎龄下限"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                    />

                    <input
                      type="number"
                      min={20}
                      max={45}
                      value={gestationTo}
                      onChange={(event) => setGestationTo(event.target.value)}
                      placeholder="胎龄上限"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </div>
                </div>
              </div>
            </section>

            {listError ? <InlineNotice tone="error" message={listError} /> : null}

            {archives.length ? (
              <div className="space-y-3">
                {archives.map((archive) => {
                  const active = archive.id === selectedArchiveId;
                  return (
                    <button
                      key={archive.id}
                      type="button"
                      onClick={() => handleMobileArchiveSelect(archive.id)}
                      className={`w-full rounded-3xl border px-4 py-4 text-left shadow-sm transition ${
                        active
                          ? 'border-indigo-200 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-slate-900">{archive.babyName}</div>
                          <div className="mt-2 text-xs leading-6 text-slate-500">
                            {SEX_LABELS[archive.sex]} · {archive.birthGestation.weeks}周{archive.birthGestation.days}天 ·{' '}
                            {formatBirthMoment(archive.birthDate, archive.birthTime)}
                          </div>
                          <div className="text-xs leading-6 text-slate-500">
                            最近记录：{formatOptionalDateTimeDisplay(archive.latestRecordDate, archive.latestRecordTime)} · 共{' '}
                            {archive.recordCount} 条
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            archive.effectiveAccessRole === 'OWNER'
                              ? 'bg-cyan-100 text-cyan-700'
                              : archive.effectiveAccessRole === 'COLLABORATOR'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {archive.effectiveAccessRole === 'OWNER'
                            ? '主责'
                            : archive.effectiveAccessRole === 'COLLABORATOR'
                              ? '协作'
                              : '只读'}
                        </span>
                      </div>

                      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-500">
                        最新三围：
                        {formatLatestMetricsSummary(archive.latestMetrics)}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <MobileEmptyState
                title={listLoading ? '正在加载病房台账' : '暂无宝宝档案'}
                description={listLoading ? '正在获取当前筛选条件下的病房宝宝列表。' : '当前筛选条件下没有可操作的宝宝档案。'}
              />
            )}

            <button
              type="button"
              onClick={() => {
                setFormError('');
                setCandidateMatches([]);
                setMobileCreateOpen(true);
              }}
              className="fixed bottom-5 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-indigo-600"
            >
              <Plus className="h-4 w-4" />
              <span>新建档案</span>
            </button>
          </div>
        ) : !selectedArchiveId ? (
          <MobileEmptyState
            title="先选择宝宝"
            description="请先回到台账选择一个宝宝档案，再进入当前任务。"
            actionLabel="返回台账"
            onAction={() => setMobileTab('ledger')}
          />
        ) : detailLoading || !selectedArchive ? (
          <MobileEmptyState
            title="正在加载档案"
            description={detailError || '正在获取当前宝宝详情，请稍候。'}
            actionLabel="返回台账"
            onAction={() => setMobileTab('ledger')}
          />
        ) : mobileTab === 'record' ? (
          <div className="space-y-4 pb-8">
            {status ? <InlineNotice tone="success" message={status} /> : null}

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">最近记录</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {formatOptionalDateTimeDisplay(selectedArchive.latestRecordDate, selectedArchive.latestRecordTime)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-500">总记录数</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{selectedArchive.recordCount} 条</div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">新增三围记录</h2>
                  <p className="mt-1 text-sm text-slate-500">保存后停留当前页，方便连续录入。</p>
                </div>
              </div>

              <form className="mt-5 space-y-3" onSubmit={handleSaveRecord}>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">记录日期</span>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={recordForm.recordDate}
                      onChange={(event) => setRecordForm((current) => ({ ...current, recordDate: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">记录时间</span>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="time"
                      required
                      value={recordForm.recordTime}
                      onChange={(event) => setRecordForm((current) => ({ ...current, recordTime: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">身长（cm）</span>
                  <div className="relative">
                    <Ruler className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min={25}
                      max={70}
                      step={0.1}
                      value={recordForm.length}
                      onChange={(event) => setRecordForm((current) => ({ ...current, length: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">体重（kg）</span>
                  <div className="relative">
                    <Weight className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min={0.4}
                      max={8}
                      step={0.01}
                      value={recordForm.weight}
                      onChange={(event) => setRecordForm((current) => ({ ...current, weight: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">头围（cm）</span>
                  <div className="relative">
                    <Baby className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min={18}
                      max={45}
                      step={0.1}
                      value={recordForm.headCircumference}
                      onChange={(event) =>
                        setRecordForm((current) => ({ ...current, headCircumference: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    血清总胆红素 TSB（{recordForm.bilirubinUnit === 'umol' ? 'μmol/L' : 'mg/dL'}）
                  </span>
                  <div className="relative">
                    <Droplets className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
                    <input
                      type="number"
                      min={0}
                      max={recordForm.bilirubinUnit === 'umol' ? 900 : 52.6}
                      step={0.1}
                      value={recordForm.bilirubinValue}
                      onChange={(event) => setRecordForm((current) => ({ ...current, bilirubinValue: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 pr-20 text-sm outline-none focus:border-amber-300"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setRecordForm((current) => {
                          const val = Number(current.bilirubinValue);
                          if (current.bilirubinUnit === 'umol') {
                            return {
                              ...current,
                              bilirubinUnit: 'mg',
                              bilirubinValue: val ? umolToMg(val).toFixed(1) : '',
                            };
                          }
                          return {
                            ...current,
                            bilirubinUnit: 'umol',
                            bilirubinValue: val ? mgToUmol(val).toFixed(1) : '',
                          };
                        })
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      {recordForm.bilirubinUnit === 'umol' ? '→ mg' : '→ μmol'}
                    </button>
                  </div>
                  {recordForm.bilirubinValue ? (
                    <div className="mt-1 text-xs text-slate-400">
                      ≈{' '}
                      {recordForm.bilirubinUnit === 'umol'
                        ? `${umolToMg(Number(recordForm.bilirubinValue)).toFixed(1)} mg/dL`
                        : `${mgToUmol(Number(recordForm.bilirubinValue)).toFixed(1)} μmol/L`}
                    </div>
                  ) : null}
                </label>

                {recordForm.bilirubinValue.trim() ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="mb-2 text-sm font-medium text-slate-700">黄疸环境状态</div>
                    <BilirubinContextSelector
                      value={recordForm.bilirubinContext}
                      onChange={(value) => setRecordForm((current) => ({ ...current, bilirubinContext: value }))}
                    />
                  </div>
                ) : null}

                {recordError ? <InlineNotice tone="error" message={recordError} /> : null}

                <button
                  type="submit"
                  disabled={recordSaving || !canWriteRecord}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:bg-indigo-300"
                >
                  {recordSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>{recordSaving ? '保存中...' : '保存记录'}</span>
                </button>
              </form>
            </section>
          </div>
        ) : mobileTab === 'growth' ? (
          <div className="space-y-4 pb-8">
            {status ? <InlineNotice tone="success" message={status} /> : null}

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">三联生长图</h2>
                  <p className="mt-1 text-sm text-slate-500">图和记录列表共享同一条高亮记录。</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  当前高亮：{activeRecordDate}
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                {(['length', 'weight', 'headCircumference'] as MetricKey[]).map((metric) => (
                  <MetricChart
                    key={metric}
                    metric={metric}
                    sex={selectedArchive.sex}
                    evaluatedRecords={evaluatedRecords}
                    selectedRecordId={selectedRecordId}
                    onSelectRecord={setSelectedRecordId}
                    xDomain={xDomain}
                    xTicks={xTicks}
                    isCompactViewport={isCompactViewport}
                  />
                ))}
              </div>
            </section>

            {selectedArchive.records.some((r) => r.bilirubinUmol != null) ? (
              <section className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">TSB 风险趋势图</h2>
                    <p className="mt-1 text-sm text-slate-500">X 轴按出生日期 + 出生时间与记录时刻换算；缺少时间的历史点会标记为估算。</p>
                  </div>
                </div>
                <div className="mt-4">
                  <JaundiceChartV2
                    birthDate={selectedArchive.birthDate}
                    birthTime={selectedArchive.birthTime}
                    records={selectedArchive.records}
                    selectedRecordId={selectedRecordId}
                    onSelectRecord={setSelectedRecordId}
                  />
                </div>
              </section>
            ) : null}

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">三围记录</h2>
                  <p className="mt-1 text-sm text-slate-500">手机端按卡片查看每条记录的三围与 P 区间。</p>
                </div>
              </div>

              {recordsDescending.length ? (
                <div className="mt-4 space-y-3">
                  {recordsDescending.map(({ record, gestationLabel, lookupWeekLabel, metrics }) => {
                    const active = record.id === selectedRecordId;
                    return (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() => setSelectedRecordId(record.id)}
                        className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                          active
                            ? 'border-amber-200 bg-amber-50 shadow-sm'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {formatDateTimeDisplay(record.recordDate, record.recordTime)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{gestationLabel}</div>
                            <div className="mt-1 text-xs text-slate-400">{lookupWeekLabel}</div>
                          </div>
                          {active ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">
                              高亮中
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 grid gap-2">
                          <MetricAssessmentSummaryCell metric="length" assessment={metrics.length} />
                          <MetricAssessmentSummaryCell metric="weight" assessment={metrics.weight} />
                          <MetricAssessmentSummaryCell metric="headCircumference" assessment={metrics.headCircumference} />
                          {record.bilirubinUmol != null ? (
                            <div className="min-w-[130px]">
                              <div className="text-sm font-medium text-amber-700">
                                {formatBilirubinDisplay(record.bilirubinUmol)}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                {(() => {
                                  const jaundice = getRecordJaundiceAssessment(selectedArchive, record);
                                  return jaundice ? formatJaundiceRiskBand(jaundice.riskBand) : '—';
                                })()}
                              </div>
                              <div className="mt-1">
                                <BilirubinContextBadge context={record.bilirubinContext} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4">
                  <MobileEmptyState title="暂无三围记录" description="请先到“记录”页录入至少一条三围数据。" />
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            {status ? <InlineNotice tone="success" message={status} /> : null}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">档案信息</h2>
                  <p className="mt-1 text-sm text-slate-500">低频管理项收在这一页，避免干扰临床主流程。</p>
                </div>
              </div>

              <form className="mt-5 space-y-3" onSubmit={handleUpdateArchive}>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">宝宝姓名</span>
                  <input
                    value={editForm.babyName}
                    onChange={(event) => setEditForm((current) => ({ ...current, babyName: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">性别</span>
                    <select
                      value={editForm.sex}
                      onChange={(event) => setEditForm((current) => ({ ...current, sex: event.target.value as SexKey }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                    >
                      <option value="boy">男</option>
                      <option value="girl">女</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">出生日期</span>
                    <input
                      type="date"
                      value={editForm.birthDate}
                      onChange={(event) => setEditForm((current) => ({ ...current, birthDate: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">出生时间</span>
                  <div className="relative">
                    <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="time"
                      value={editForm.birthTime}
                      onChange={(event) => setEditForm((current) => ({ ...current, birthTime: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-400">旧档案可暂时留空；补录后黄疸图会按真实出生后小时数计算。</div>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">出生胎龄（周）</span>
                    <input
                      type="number"
                      min={20}
                      max={45}
                      value={editForm.birthGestationWeeks}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, birthGestationWeeks: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">出生胎龄（天）</span>
                    <input
                      type="number"
                      min={0}
                      max={6}
                      value={editForm.birthGestationDays}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, birthGestationDays: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                    />
                  </label>
                </div>

                {formError ? <InlineNotice tone="error" message={formError} /> : null}

                <button
                  type="submit"
                  disabled={archiveSaving || !canManageArchive}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:bg-slate-400"
                >
                  {archiveSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{archiveSaving ? '保存中...' : '保存档案'}</span>
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={() => setMobileCollaborationOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">团队协作</h2>
                  <p className="mt-1 text-sm text-slate-500">默认收起，不占用手机端首屏注意力。</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {mobileCollaborationOpen ? '收起' : `展开 ${accessData?.grants.length || 0}`}
                </span>
              </button>

              {mobileCollaborationOpen ? (
                <div className="mt-5 space-y-4">
                  {canManageArchive ? (
                    <div className="grid gap-3">
                      <select
                        value={shareTeamId}
                        onChange={(event) => setShareTeamId(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                      >
                        <option value="">选择团队</option>
                        {shareableTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={shareDoctorId}
                        onChange={(event) => setShareDoctorId(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                      >
                        <option value="">选择医生</option>
                        {currentShareDoctors.map((doctor) => (
                          <option key={doctor.doctorProfileId} value={doctor.doctorProfileId}>
                            {doctor.realName} · {doctor.departmentName}
                          </option>
                        ))}
                      </select>
                      <select
                        value={shareRole}
                        onChange={(event) => setShareRole(event.target.value as 'COLLABORATOR' | 'READONLY')}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                      >
                        <option value="COLLABORATOR">协作医生</option>
                        <option value="READONLY">只读</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void submitGrant()}
                        className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
                      >
                        共享档案
                      </button>
                    </div>
                  ) : (
                    <InlineNotice tone="neutral" message="只有档案负责人可以管理共享权限。" />
                  )}

                  <div className="space-y-3">
                    {accessData?.grants.length ? (
                      accessData.grants.map((grant) => (
                        <div key={grant.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="font-semibold text-slate-900">{grant.targetDoctor.realName}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {grant.targetDoctor.departmentName} · {grant.targetDoctor.title} · {grant.sourceTeam.name}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {canManageArchive ? (
                              <select
                                value={grant.accessRole}
                                onChange={(event) =>
                                  void updateGrantRole(grant.id, event.target.value as 'COLLABORATOR' | 'READONLY')
                                }
                                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                              >
                                <option value="COLLABORATOR">协作医生</option>
                                <option value="READONLY">只读</option>
                              </select>
                            ) : (
                              <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                                {grant.accessRole === 'COLLABORATOR' ? '协作医生' : '只读'}
                              </span>
                            )}
                            {canManageArchive ? (
                              <button
                                type="button"
                                onClick={() => void revokeGrant(grant.id)}
                                className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                              >
                                撤销
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <InlineNotice tone="neutral" message="当前还没有共享给其他团队成员。" />
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        )}

        <Sheet
          open={mobileCreateOpen}
          onOpenChange={(open) => {
            setMobileCreateOpen(open);
            if (!open) {
              setCandidateMatches([]);
            }
          }}
        >
          <SheetContent side="bottom" className="h-[92vh] rounded-t-[32px] border-none bg-slate-50 p-0">
            <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-slate-300" />
            <div className="h-full overflow-y-auto px-4 pb-8 pt-4">
              <SheetHeader className="text-left">
                <SheetTitle>新建 / 匹配宝宝档案</SheetTitle>
                <SheetDescription>先完成建档或匹配，再进入记录、生长和档案操作。</SheetDescription>
              </SheetHeader>

              <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <form className="space-y-4" onSubmit={handleCreateArchive}>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">宝宝姓名</span>
                    <input
                      value={archiveForm.babyName}
                      onChange={(event) => setArchiveForm((current) => ({ ...current, babyName: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                      placeholder="例如：王小宝"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">性别</span>
                      <select
                        value={archiveForm.sex}
                        onChange={(event) =>
                          setArchiveForm((current) => ({ ...current, sex: event.target.value as SexKey }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                      >
                        <option value="boy">男</option>
                        <option value="girl">女</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">出生日期</span>
                      <input
                        type="date"
                        value={archiveForm.birthDate}
                        onChange={(event) => setArchiveForm((current) => ({ ...current, birthDate: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">出生时间</span>
                    <div className="relative">
                      <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="time"
                        required
                        value={archiveForm.birthTime}
                        onChange={(event) => setArchiveForm((current) => ({ ...current, birthTime: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                      />
                    </div>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">出生胎龄（周）</span>
                      <input
                        type="number"
                        min={20}
                        max={45}
                        value={archiveForm.birthGestationWeeks}
                        onChange={(event) =>
                          setArchiveForm((current) => ({ ...current, birthGestationWeeks: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">出生胎龄（天）</span>
                      <input
                        type="number"
                        min={0}
                        max={6}
                        value={archiveForm.birthGestationDays}
                        onChange={(event) =>
                          setArchiveForm((current) => ({ ...current, birthGestationDays: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                      />
                    </label>
                  </div>

                  {formError ? <InlineNotice tone="error" message={formError} /> : null}
                  {status && candidateMatches.length ? <InlineNotice tone="neutral" message={status} /> : null}

                  <button
                    type="submit"
                    disabled={archiveSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:bg-slate-400"
                  >
                    {archiveSubmitting ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    <span>{archiveSubmitting ? '处理中...' : '创建或匹配档案'}</span>
                  </button>
                </form>
              </section>

              {candidateMatches.length ? (
                <section className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-amber-900">匹配到多个候选档案</h3>
                  <p className="mt-2 text-sm leading-6 text-amber-800">请选择一个已有档案继续进入记录操作。</p>
                  <div className="mt-4 space-y-3">
                    {candidateMatches.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => {
                          setStatus('已切换到匹配到的现有档案。');
                          handleMobileArchiveSelect(candidate.id);
                        }}
                        className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-amber-300 hover:bg-amber-100/40"
                      >
                        <div className="font-semibold text-slate-900">{candidate.babyName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {SEX_LABELS[candidate.sex]} · {candidate.birthGestation.weeks}周{candidate.birthGestation.days}天 ·{' '}
                          {formatBirthMoment(candidate.birthDate, candidate.birthTime)}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden gap-6 xl:grid xl:grid-cols-[380px,minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
                <Baby className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">新建 / 匹配宝宝档案</h2>
                <p className="mt-1 text-sm text-slate-500">系统会按姓名、出生胎龄、性别优先匹配当前医生名下已有档案。</p>
              </div>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleCreateArchive}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">宝宝姓名</span>
                <input
                  value={archiveForm.babyName}
                  onChange={(event) => setArchiveForm((current) => ({ ...current, babyName: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                  placeholder="例如：王小宝"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">性别</span>
                  <select
                    value={archiveForm.sex}
                    onChange={(event) =>
                      setArchiveForm((current) => ({ ...current, sex: event.target.value as SexKey }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                  >
                    <option value="boy">男</option>
                    <option value="girl">女</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">出生日期</span>
                  <input
                    type="date"
                    value={archiveForm.birthDate}
                    onChange={(event) => setArchiveForm((current) => ({ ...current, birthDate: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">出生时间</span>
                <div className="relative">
                  <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="time"
                    required
                    value={archiveForm.birthTime}
                    onChange={(event) => setArchiveForm((current) => ({ ...current, birthTime: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                  />
                </div>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">出生胎龄（周）</span>
                  <input
                    type="number"
                    min={20}
                    max={45}
                    value={archiveForm.birthGestationWeeks}
                    onChange={(event) =>
                      setArchiveForm((current) => ({ ...current, birthGestationWeeks: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">出生胎龄（天）</span>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={archiveForm.birthGestationDays}
                    onChange={(event) =>
                      setArchiveForm((current) => ({ ...current, birthGestationDays: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                  />
                </label>
              </div>

              {formError ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={archiveSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:bg-slate-400"
              >
                {archiveSubmitting ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span>{archiveSubmitting ? '处理中...' : '创建或匹配档案'}</span>
              </button>
            </form>
          </section>

          {candidateMatches.length ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <h3 className="text-base font-semibold text-amber-900">匹配到多个候选档案</h3>
              <p className="mt-2 text-sm leading-6 text-amber-800">系统发现多个完全一致的病房档案，请先手动选择一个继续查看。</p>
              <div className="mt-4 space-y-3">
                {candidateMatches.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      setSelectedArchiveId(candidate.id);
                      setCandidateMatches([]);
                      setStatus('已切换到匹配到的现有档案。');
                    }}
                    className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-amber-300 hover:bg-amber-100/40"
                  >
                    <div className="font-semibold text-slate-900">{candidate.babyName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {SEX_LABELS[candidate.sex]} · {candidate.birthGestation.weeks}周{candidate.birthGestation.days}天 ·{' '}
                      {formatBirthMoment(candidate.birthDate, candidate.birthTime)}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">病房台账</h2>
                <p className="mt-1 text-sm text-slate-500">筛选并切换当前医生名下的宝宝档案。</p>
              </div>
              <button
                type="button"
                onClick={() => void loadArchives()}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                title="刷新列表"
              >
                <RefreshCcw className={`h-4 w-4 ${listLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索姓名"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm outline-none focus:border-indigo-300"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <select
                  value={sexFilter}
                  onChange={(event) => setSexFilter(event.target.value as 'ALL' | SexKey)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                >
                  <option value="ALL">全部性别</option>
                  <option value="boy">男</option>
                  <option value="girl">女</option>
                </select>

                <input
                  type="number"
                  min={20}
                  max={45}
                  value={gestationFrom}
                  onChange={(event) => setGestationFrom(event.target.value)}
                  placeholder="胎龄下限（周）"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                />

                <input
                  type="number"
                  min={20}
                  max={45}
                  value={gestationTo}
                  onChange={(event) => setGestationTo(event.target.value)}
                  placeholder="胎龄上限（周）"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                />
              </div>
            </div>

            {listError ? (
              <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {listError}
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {archives.length ? (
                archives.map((archive) => {
                  const active = archive.id === selectedArchiveId;
                  return (
                    <button
                      key={archive.id}
                      type="button"
                      onClick={() => setSelectedArchiveId(archive.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        active
                          ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-900">{archive.babyName}</div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              archive.effectiveAccessRole === 'OWNER'
                                ? 'bg-cyan-100 text-cyan-700'
                                : archive.effectiveAccessRole === 'COLLABORATOR'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {archive.effectiveAccessRole === 'OWNER' ? '主责' : archive.effectiveAccessRole === 'COLLABORATOR' ? '协作' : '只读'}
                          </span>
                          <div className="text-xs text-slate-500">{archive.recordCount} 条记录</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs leading-6 text-slate-500">
                        <div>
                          {SEX_LABELS[archive.sex]} · {archive.birthGestation.weeks}周{archive.birthGestation.days}天 ·{' '}
                          {formatBirthMoment(archive.birthDate, archive.birthTime)}
                        </div>
                        <div>最近记录：{formatOptionalDateTimeDisplay(archive.latestRecordDate, archive.latestRecordTime)}</div>
                        <div>
                          最新三围：
                          {formatLatestMetricsSummary(archive.latestMetrics)}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  {listLoading ? '正在加载病房台账...' : '当前筛选条件下暂无宝宝档案。'}
                </div>
              )}
            </div>
          </section>
        </aside>

        <section className="space-y-5">
          {!selectedArchiveId ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
              请先在左侧创建或选择一个宝宝档案。
            </div>
          ) : detailLoading || !selectedArchive ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
              {detailError || '正在加载宝宝详情...'}
            </div>
          ) : (
            <>
              <div className="grid gap-5 xl:grid-cols-[360px,minmax(0,1fr)]">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">档案信息</h2>
                      <p className="mt-1 text-sm text-slate-500">修改后会重新计算匹配键与已有记录的当前胎龄快照。</p>
                    </div>
                  </div>

                  <form className="mt-5 space-y-4" onSubmit={handleUpdateArchive}>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">宝宝姓名</span>
                      <input
                        value={editForm.babyName}
                        onChange={(event) => setEditForm((current) => ({ ...current, babyName: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">性别</span>
                        <select
                          value={editForm.sex}
                          onChange={(event) => setEditForm((current) => ({ ...current, sex: event.target.value as SexKey }))}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                        >
                          <option value="boy">男</option>
                          <option value="girl">女</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">出生日期</span>
                        <input
                          type="date"
                          value={editForm.birthDate}
                          onChange={(event) => setEditForm((current) => ({ ...current, birthDate: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">出生时间</span>
                      <div className="relative">
                        <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="time"
                          value={editForm.birthTime}
                          onChange={(event) => setEditForm((current) => ({ ...current, birthTime: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                        />
                      </div>
                      <div className="mt-1 text-xs text-slate-400">旧档案可暂时留空；补录后黄疸图会按真实出生后小时数计算。</div>
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">出生胎龄（周）</span>
                        <input
                          type="number"
                          min={20}
                          max={45}
                          value={editForm.birthGestationWeeks}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, birthGestationWeeks: event.target.value }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">出生胎龄（天）</span>
                        <input
                          type="number"
                          min={0}
                          max={6}
                          value={editForm.birthGestationDays}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, birthGestationDays: event.target.value }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-300"
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={archiveSaving || !canManageArchive}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:bg-cyan-300"
                    >
                      {archiveSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      <span>{archiveSaving ? '保存中...' : '保存档案信息'}</span>
                    </button>

                    {formError ? (
                      <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {formError}
                      </div>
                    ) : null}
                  </form>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Ward Record</div>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{selectedArchive.babyName}</h2>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        {SEX_LABELS[selectedArchive.sex]} · 出生胎龄 {selectedArchive.birthGestation.weeks}周{selectedArchive.birthGestation.days}天 · 出生时刻{' '}
                        {formatBirthMoment(selectedArchive.birthDate, selectedArchive.birthTime)}
                      </p>
                      {selectedArchive.ownerDoctorProfile && selectedArchive.effectiveAccessRole !== 'OWNER' ? (
                        <p className="mt-1 text-sm text-slate-500">
                          负责人医生：{selectedArchive.ownerDoctorProfile.realName} · {selectedArchive.ownerDoctorProfile.departmentName}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="text-xs text-slate-500">最近记录</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {formatOptionalDateTimeDisplay(selectedArchive.latestRecordDate, selectedArchive.latestRecordTime)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="text-xs text-slate-500">总记录数</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{selectedArchive.recordCount} 条</div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="text-xs text-slate-500">当前权限</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {selectedArchive.effectiveAccessRole === 'OWNER'
                            ? '主责'
                            : selectedArchive.effectiveAccessRole === 'COLLABORATOR'
                              ? '协作'
                              : '只读'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white p-3 text-cyan-700 shadow-sm">
                        <Share2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">团队协作</h3>
                        <p className="mt-1 text-sm text-slate-500">负责人可把病房档案共享给团队成员；协作医生可录入三围，只读仅可查看。</p>
                      </div>
                    </div>

                    {canManageArchive ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-[220px,1fr,160px,140px]">
                        <select
                          value={shareTeamId}
                          onChange={(event) => setShareTeamId(event.target.value)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                        >
                          <option value="">选择团队</option>
                          {shareableTeams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={shareDoctorId}
                          onChange={(event) => setShareDoctorId(event.target.value)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                        >
                          <option value="">选择医生</option>
                          {currentShareDoctors.map((doctor) => (
                            <option key={doctor.doctorProfileId} value={doctor.doctorProfileId}>
                              {doctor.realName} · {doctor.departmentName}
                            </option>
                          ))}
                        </select>
                        <select
                          value={shareRole}
                          onChange={(event) => setShareRole(event.target.value as 'COLLABORATOR' | 'READONLY')}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                        >
                          <option value="COLLABORATOR">协作医生</option>
                          <option value="READONLY">只读</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void submitGrant()}
                          className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
                        >
                          共享
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500">
                        只有档案负责人可以管理共享权限。
                      </div>
                    )}

                    <div className="mt-4 space-y-3">
                      {accessData?.grants.length ? (
                        accessData.grants.map((grant) => (
                          <div key={grant.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <div className="font-semibold text-slate-900">{grant.targetDoctor.realName}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                  {grant.targetDoctor.departmentName} · {grant.targetDoctor.title} · {grant.sourceTeam.name}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {canManageArchive ? (
                                  <select
                                    value={grant.accessRole}
                                    onChange={(event) => void updateGrantRole(grant.id, event.target.value as 'COLLABORATOR' | 'READONLY')}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                                  >
                                    <option value="COLLABORATOR">协作医生</option>
                                    <option value="READONLY">只读</option>
                                  </select>
                                ) : (
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${grant.accessRole === 'COLLABORATOR' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {grant.accessRole === 'COLLABORATOR' ? '协作医生' : '只读'}
                                  </span>
                                )}
                                {canManageArchive ? (
                                  <button
                                    type="button"
                                    onClick={() => void revokeGrant(grant.id)}
                                    className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                                  >
                                    撤销
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-400">当前还没有共享给其他团队成员。</div>
                      )}
                    </div>
                  </div>

                  <form className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-5" onSubmit={handleSaveRecord}>
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white p-3 text-indigo-600 shadow-sm">
                        <Plus className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">新增三围记录</h3>
                        <p className="mt-1 text-sm text-slate-500">记录日期和时间确定后，系统会自动换算当前胎龄，并支持同一天多次复测。</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                      <label className="block xl:col-span-1">
                        <span className="mb-2 block text-sm font-medium text-slate-700">记录日期</span>
                        <div className="relative">
                          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="date"
                            value={recordForm.recordDate}
                            onChange={(event) => setRecordForm((current) => ({ ...current, recordDate: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                          />
                        </div>
                      </label>

                      <label className="block xl:col-span-1">
                        <span className="mb-2 block text-sm font-medium text-slate-700">记录时间</span>
                        <div className="relative">
                          <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="time"
                            required
                            value={recordForm.recordTime}
                            onChange={(event) => setRecordForm((current) => ({ ...current, recordTime: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                          />
                        </div>
                      </label>

                      <label className="block xl:col-span-1">
                        <span className="mb-2 block text-sm font-medium text-slate-700">身长（cm）</span>
                        <div className="relative">
                          <Ruler className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number"
                            min={25}
                            max={70}
                            step={0.1}
                            value={recordForm.length}
                            onChange={(event) => setRecordForm((current) => ({ ...current, length: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                          />
                        </div>
                      </label>

                      <label className="block xl:col-span-1">
                        <span className="mb-2 block text-sm font-medium text-slate-700">体重（kg）</span>
                        <div className="relative">
                          <Weight className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number"
                            min={0.4}
                            max={8}
                            step={0.01}
                            value={recordForm.weight}
                            onChange={(event) => setRecordForm((current) => ({ ...current, weight: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                          />
                        </div>
                      </label>

                      <label className="block xl:col-span-1">
                        <span className="mb-2 block text-sm font-medium text-slate-700">头围（cm）</span>
                        <div className="relative">
                          <Baby className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number"
                            min={18}
                            max={45}
                            step={0.1}
                            value={recordForm.headCircumference}
                            onChange={(event) =>
                              setRecordForm((current) => ({ ...current, headCircumference: event.target.value }))
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none focus:border-indigo-300"
                          />
                        </div>
                      </label>

                      <label className="block xl:col-span-1">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          血清总胆红素 TSB（{recordForm.bilirubinUnit === 'umol' ? 'μmol/L' : 'mg/dL'}）
                        </span>
                        <div className="relative">
                          <Droplets className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
                          <input
                            type="number"
                            min={0}
                            max={recordForm.bilirubinUnit === 'umol' ? 900 : 52.6}
                            step={0.1}
                            value={recordForm.bilirubinValue}
                            onChange={(event) =>
                              setRecordForm((current) => ({ ...current, bilirubinValue: event.target.value }))
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 pr-20 text-sm outline-none focus:border-amber-300"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setRecordForm((current) => {
                                const val = Number(current.bilirubinValue);
                                if (current.bilirubinUnit === 'umol') {
                                  return {
                                    ...current,
                                    bilirubinUnit: 'mg',
                                    bilirubinValue: val ? umolToMg(val).toFixed(1) : '',
                                  };
                                }
                                return {
                                  ...current,
                                  bilirubinUnit: 'umol',
                                  bilirubinValue: val ? mgToUmol(val).toFixed(1) : '',
                                };
                              })
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                          >
                            {recordForm.bilirubinUnit === 'umol' ? '→ mg' : '→ μmol'}
                          </button>
                        </div>
                        {recordForm.bilirubinValue ? (
                          <div className="mt-1 text-xs text-slate-400">
                            ≈{' '}
                            {recordForm.bilirubinUnit === 'umol'
                              ? `${umolToMg(Number(recordForm.bilirubinValue)).toFixed(1)} mg/dL`
                              : `${mgToUmol(Number(recordForm.bilirubinValue)).toFixed(1)} μmol/L`}
                          </div>
                        ) : null}
                      </label>

                      {recordForm.bilirubinValue.trim() ? (
                        <div className="block xl:col-span-2">
                          <span className="mb-2 block text-sm font-medium text-slate-700">黄疸环境状态</span>
                          <BilirubinContextSelector
                            value={recordForm.bilirubinContext}
                            onChange={(value) => setRecordForm((current) => ({ ...current, bilirubinContext: value }))}
                          />
                        </div>
                      ) : null}

                      <div className="flex items-end xl:col-span-1">
                        <button
                          type="submit"
                          disabled={recordSaving || !canWriteRecord}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:bg-indigo-300"
                        >
                          {recordSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          <span>{recordSaving ? '保存中...' : '保存记录'}</span>
                        </button>
                      </div>
                    </div>

                    {recordError ? (
                      <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {recordError}
                      </div>
                    ) : null}
                  </form>
                </section>
              </div>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">三联生长图</h2>
                    <p className="mt-1 text-sm text-slate-500">三个子图共享当前胎龄 X 轴，点击表格行或图中点位可高亮对应记录。</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
                    当前高亮：{activeRecordDate}
                  </div>
                </div>

                <div className="grid gap-4">
                  {(['length', 'weight', 'headCircumference'] as MetricKey[]).map((metric) => (
                    <MetricChart
                      key={metric}
                      metric={metric}
                      sex={selectedArchive.sex}
                      evaluatedRecords={evaluatedRecords}
                      selectedRecordId={selectedRecordId}
                      onSelectRecord={setSelectedRecordId}
                      xDomain={xDomain}
                      xTicks={xTicks}
                      isCompactViewport={isCompactViewport}
                    />
                  ))}
                </div>
              </section>

              {selectedArchive.records.some((r) => r.bilirubinUmol != null) ? (
                <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">TSB 风险趋势图</h2>
                      <p className="mt-1 text-sm text-slate-500">X 轴按出生日期 + 出生时间与记录时刻换算；缺少时间的历史点会标记为估算。</p>
                    </div>
                  </div>
                  <JaundiceChartV2
                    birthDate={selectedArchive.birthDate}
                    birthTime={selectedArchive.birthTime}
                    records={selectedArchive.records}
                    selectedRecordId={selectedRecordId}
                    onSelectRecord={setSelectedRecordId}
                  />
                </section>
              ) : null}

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">三围记录表</h2>
                    <p className="mt-1 text-sm text-slate-500">单表同时展示记录时刻、自动换算后的当前胎龄与三围数值，并标出黄疸环境状态。</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        <th className="px-3 py-3">记录时刻</th>
                        <th className="px-3 py-3">当前胎龄</th>
                        <th className="px-3 py-3">身长</th>
                        <th className="px-3 py-3">体重</th>
                        <th className="px-3 py-3">头围</th>
                        <th className="px-3 py-3">TSB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recordsDescending.length ? (
                        recordsDescending.map(({ record, gestationLabel, lookupWeekLabel, metrics }) => {
                          const active = record.id === selectedRecordId;
                          return (
                            <tr
                              key={record.id}
                              onClick={() => setSelectedRecordId(record.id)}
                              className={`cursor-pointer transition ${
                                active ? 'bg-amber-50/80' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="px-3 py-3 text-sm font-medium text-slate-900">
                                <div>{formatDateTimeDisplay(record.recordDate, record.recordTime)}</div>
                                {record.recordTime ? null : <div className="mt-1 text-xs text-amber-600">时间未补录</div>}
                              </td>
                              <td className="px-3 py-3 text-sm text-slate-600">
                                <div>{gestationLabel}</div>
                                <div className="mt-1 text-xs text-slate-400">{lookupWeekLabel}</div>
                              </td>
                              <td className="px-3 py-3 text-sm text-slate-600">
                                <MetricAssessmentSummaryCell metric="length" assessment={metrics.length} />
                              </td>
                              <td className="px-3 py-3 text-sm text-slate-600">
                                <MetricAssessmentSummaryCell metric="weight" assessment={metrics.weight} />
                              </td>
                              <td className="px-3 py-3 text-sm text-slate-600">
                                <MetricAssessmentSummaryCell metric="headCircumference" assessment={metrics.headCircumference} />
                              </td>
                              <td className="px-3 py-3 text-sm text-slate-600">
                                <div className="text-sm text-amber-700">{formatBilirubinDisplay(record.bilirubinUmol)}</div>
                                {record.bilirubinUmol != null ? (
                                  <>
                                    <div className="mt-1 text-xs text-slate-400">
                                      {(() => {
                                        const jaundice = getRecordJaundiceAssessment(selectedArchive, record);
                                        return jaundice ? formatJaundiceRiskBand(jaundice.riskBand) : '—';
                                      })()}
                                    </div>
                                    <div className="mt-1">
                                      <BilirubinContextBadge context={record.bilirubinContext} />
                                    </div>
                                  </>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">
                            暂无三围记录，请先录入一条数据。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
