'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Activity, Baby, Database, Info, Plus } from 'lucide-react';
import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useAuthSession, useProfile } from '@/contexts';
import type { MemberRelation } from '@/contexts/ProfileContext';
import {
  REFERENCE_CURVES as SHARED_REFERENCE_CURVES,
  evaluateAgainstPercentiles as evaluateReferencePercentiles,
  formatReferenceLookupLabel,
  type PercentileAssessment as SharedPercentileAssessment,
} from '@/lib/neonates/reference-curves';
import { useCompactViewport } from '@/lib/useCompactViewport';

type SexKey = 'boy' | 'girl';
type MetricKey = 'weight' | 'length' | 'headCircumference';
type PercentileKey = 'p3' | 'p10' | 'p25' | 'p50' | 'p75' | 'p90' | 'p97';
type SummaryTone = 'low' | 'watch-low' | 'normal' | 'watch-high' | 'high' | 'empty';

type GrowthRecord = {
  week: number;
  weight?: number;
  length?: number;
  headCircumference?: number;
};

type GrowthProfile = {
  id: string;
  name: string;
  subtitle: string;
  sex: SexKey;
  records: GrowthRecord[];
};

type PersistedGrowthRecord = GrowthRecord & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PercentilePoint = {
  week: number;
  p3: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p97: number;
};

type PercentileAssessment = SharedPercentileAssessment & {
  conclusion: string;
  approxPercentile: number | null;
  tone: SummaryTone;
};

type ChartRow = PercentilePoint & {
  value?: number;
  lookupWeekLabel?: string;
  bandLabel?: string;
  zoneLabel?: string;
  summaryLabel?: string;
  conclusion?: string;
  approxPercentile?: number | null;
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
};

type MemberOption = {
  id: string;
  name: string;
  subtitle: string;
  sex: SexKey;
};

const METRIC_CONFIG: Record<
  MetricKey,
  {
    label: string;
    shortLabel: string;
    unit: string;
    min: number;
    max: number;
    inputStep: number;
    ticks: number[];
    accent: string;
  }
> = {
  weight: {
    label: '体重',
    shortLabel: '体重',
    unit: 'kg',
    min: 0.5,
    max: 5.0,
    inputStep: 0.01,
    ticks: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
    accent: '#4f46e5',
  },
  length: {
    label: '身长',
    shortLabel: '身长',
    unit: 'cm',
    min: 25,
    max: 60,
    inputStep: 0.1,
    ticks: [25, 30, 35, 40, 45, 50, 55, 60],
    accent: '#4f46e5',
  },
  headCircumference: {
    label: '头围',
    shortLabel: '头围',
    unit: 'cm',
    min: 20,
    max: 40,
    inputStep: 0.1,
    ticks: [20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40],
    accent: '#4f46e5',
  },
};

const SEX_LABELS: Record<SexKey, string> = {
  boy: '男宝宝',
  girl: '女宝宝',
};

const RELATION_LABELS: Record<MemberRelation, string> = {
  self: '本人',
  child: '孩子',
  parent: '父母',
  spouse: '配偶',
  sibling: '手足',
  other: '其他',
};

const SUMMARY_TONE_CLASSES: Record<SummaryTone, string> = {
  low: 'border-rose-100 bg-rose-50 text-rose-900',
  'watch-low': 'border-amber-100 bg-amber-50 text-amber-900',
  normal: 'border-emerald-100 bg-emerald-50 text-emerald-900',
  'watch-high': 'border-sky-100 bg-sky-50 text-sky-900',
  high: 'border-indigo-100 bg-indigo-50 text-indigo-900',
  empty: 'border-slate-100 bg-slate-50 text-slate-700',
};

const PERCENTILE_LINES: Array<{
  key: PercentileKey;
  label: string;
  stroke: string;
  strokeWidth: number;
  dasharray?: string;
}> = [
  { key: 'p3', label: 'P3', stroke: '#cbd5e1', strokeWidth: 1.3, dasharray: '6 6' },
  { key: 'p10', label: 'P10', stroke: '#cbd5e1', strokeWidth: 1.3, dasharray: '6 6' },
  { key: 'p25', label: 'P25', stroke: '#dbe4f0', strokeWidth: 1.2, dasharray: '4 4' },
  { key: 'p50', label: 'P50', stroke: '#94a3b8', strokeWidth: 1.7 },
  { key: 'p75', label: 'P75', stroke: '#dbe4f0', strokeWidth: 1.2, dasharray: '4 4' },
  { key: 'p90', label: 'P90', stroke: '#cbd5e1', strokeWidth: 1.3, dasharray: '6 6' },
  { key: 'p97', label: 'P97', stroke: '#cbd5e1', strokeWidth: 1.3, dasharray: '6 6' },
];

const REFERENCE_CURVES: Record<SexKey, Record<MetricKey, PercentilePoint[]>> = SHARED_REFERENCE_CURVES;

const INITIAL_PROFILES: GrowthProfile[] = [
  {
    id: 'baby-a',
    name: '宝宝A',
    subtitle: '足月稳步增长',
    sex: 'boy',
    records: [
      { week: 37, weight: 2.9, length: 46.8, headCircumference: 33.8 },
      { week: 38, weight: 3.1, length: 48.0, headCircumference: 34.4 },
      { week: 39, weight: 3.3, length: 49.2, headCircumference: 35.0 },
    ],
  },
  {
    id: 'baby-b',
    name: '宝宝B',
    subtitle: '早产追赶生长',
    sex: 'boy',
    records: [
      { week: 28, weight: 1.1, length: 35.9, headCircumference: 25.2 },
      { week: 30, weight: 1.4, length: 38.1, headCircumference: 27.0 },
      { week: 32, weight: 1.8, length: 40.4, headCircumference: 29.1 },
      { week: 34, weight: 2.3, length: 43.0, headCircumference: 31.3 },
    ],
  },
];

function toNumericCoordinate(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatMetricValue(value: number, metric: MetricKey) {
  const digits = metric === 'weight' ? 2 : 1;
  return value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function interpolatePercentile(value: number, lowerValue: number, upperValue: number, lowerPercentile: number, upperPercentile: number) {
  if (upperValue === lowerValue) {
    return upperPercentile;
  }

  return lowerPercentile + ((value - lowerValue) / (upperValue - lowerValue)) * (upperPercentile - lowerPercentile);
}

function evaluateAgainstPercentiles(value: number, point: PercentilePoint): PercentileAssessment {
  if (value < point.p3) {
    return {
      bandLabel: '低于 P3',
      zoneLabel: '偏低需关注',
      summaryLabel: '低于 P3 偏低区间',
      conclusion: '建议尽快结合喂养情况与临床评估进一步随访。',
      approxPercentile: null,
      tone: 'low',
    };
  }

  if (value <= point.p10) {
    return {
      bandLabel: 'P3 - P10',
      zoneLabel: '偏低关注区间',
      summaryLabel: 'P3 - P10 偏低关注区间',
      conclusion: '建议持续观察增长速度，并结合喂养情况复核。',
      approxPercentile: interpolatePercentile(value, point.p3, point.p10, 3, 10),
      tone: 'watch-low',
    };
  }

  if (value <= point.p50) {
    return {
      bandLabel: 'P10 - P50',
      zoneLabel: '正常区间',
      summaryLabel: 'P10 - P50 正常区间',
      conclusion: '发育达标。',
      approxPercentile: interpolatePercentile(value, point.p10, point.p50, 10, 50),
      tone: 'normal',
    };
  }

  if (value <= point.p90) {
    return {
      bandLabel: 'P50 - P90',
      zoneLabel: '正常区间',
      summaryLabel: 'P50 - P90 正常区间',
      conclusion: '发育达标。',
      approxPercentile: interpolatePercentile(value, point.p50, point.p90, 50, 90),
      tone: 'normal',
    };
  }

  if (value <= point.p97) {
    return {
      bandLabel: 'P90 - P97',
      zoneLabel: '偏高关注区间',
      summaryLabel: 'P90 - P97 偏高关注区间',
      conclusion: '建议结合整体生长趋势继续观察。',
      approxPercentile: interpolatePercentile(value, point.p90, point.p97, 90, 97),
      tone: 'watch-high',
    };
  }

  return {
    bandLabel: '高于 P97',
    zoneLabel: '偏高需评估',
    summaryLabel: '高于 P97 偏高区间',
    conclusion: '建议结合临床情况进一步判断。',
    approxPercentile: null,
    tone: 'high',
  };
}

function evaluateGrowthAssessment(value: number, point: PercentilePoint): PercentileAssessment {
  const assessment = evaluateReferencePercentiles(value, point);

  if (assessment.bandLabel === '低于 P3') {
    return {
      ...assessment,
      conclusion: '建议尽快结合喂养情况与临床评估进一步随访。',
      tone: 'low',
    };
  }

  if (assessment.bandLabel === 'P3 - P10') {
    return {
      ...assessment,
      conclusion: '建议持续观察生长速度，并结合喂养情况复核。',
      tone: 'watch-low',
    };
  }

  if (assessment.bandLabel === 'P90 - P97') {
    return {
      ...assessment,
      conclusion: '建议结合整体生长趋势继续观察。',
      tone: 'watch-high',
    };
  }

  if (assessment.bandLabel === '高于 P97') {
    return {
      ...assessment,
      conclusion: '建议结合临床情况进一步判断。',
      tone: 'high',
    };
  }

  return {
    ...assessment,
    conclusion: '发育达标。',
    tone: 'normal',
  };
}

function createTerminalLabelRenderer(label: string, color: string, total: number) {
  return function TerminalLabel({ index, x, y }: TerminalLabelProps) {
    if (index !== total - 1) {
      return null;
    }

    const xValue = toNumericCoordinate(x);
    const yValue = toNumericCoordinate(y);

    if (xValue === null || yValue === null) {
      return null;
    }

    return (
      <text x={xValue + 10} y={yValue + 4} fill={color} fontSize={11} fontWeight={600}>
        {label}
      </text>
    );
  };
}

function GrowthTooltip({ active, payload, metric }: GrowthTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const metricConfig = METRIC_CONFIG[metric];
  const target = payload.find((entry) => entry.dataKey === 'value' && typeof entry.value === 'number' && entry.payload);

  if (!target || typeof target.value !== 'number' || !target.payload) {
    return null;
  }

  const row = target.payload;

  return (
    <div className="min-w-[200px] rounded-2xl border border-slate-100 bg-white/95 px-4 py-3 shadow-lg shadow-slate-200/60 backdrop-blur">
      <div className="text-xs font-semibold tracking-wide text-indigo-600">胎龄 {row.week} 周</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">
        {metricConfig.label}
        {formatMetricValue(target.value, metric)}
        {metricConfig.unit}
      </div>
      <div className="mt-2 text-xs leading-6 text-slate-600">
        <div>所处区间：{row.bandLabel}</div>
        <div>判断：{row.zoneLabel}</div>
        {typeof row.approxPercentile === 'number' ? <div>估算百分位：约 P{Math.round(row.approxPercentile)}</div> : null}
      </div>
    </div>
  );
}

function GrowthTooltipCard({ active, payload, metric }: GrowthTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const metricConfig = METRIC_CONFIG[metric];
  const target = payload.find((entry) => entry.dataKey === 'value' && typeof entry.value === 'number' && entry.payload);

  if (!target || typeof target.value !== 'number' || !target.payload) {
    return null;
  }

  const row = target.payload;

  return (
    <div className="min-w-[200px] rounded-2xl border border-slate-100 bg-white/95 px-4 py-3 shadow-lg shadow-slate-200/60 backdrop-blur">
      <div className="text-xs font-semibold tracking-wide text-indigo-600">胎龄 {row.week} 周</div>
      <div className="mt-1 text-xs text-slate-400">{row.lookupWeekLabel}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">
        {metricConfig.label}
        {formatMetricValue(target.value, metric)}
        {metricConfig.unit}
      </div>
      <div className="mt-2 text-xs leading-6 text-slate-600">
        <div>P区间：{row.bandLabel}</div>
        <div>判断：{row.zoneLabel}</div>
        {typeof row.approxPercentile === 'number' ? <div>估算百分位：约 P{Math.round(row.approxPercentile)}</div> : null}
      </div>
    </div>
  );
}

function mergeRecordList(records: GrowthRecord[], nextRecord: GrowthRecord) {
  const existing = records.find((record) => record.week === nextRecord.week);

  const nextRecords = existing
    ? records.map((record) => (record.week === nextRecord.week ? { ...record, ...nextRecord } : record))
    : [...records, nextRecord];

  return [...nextRecords].sort((left, right) => left.week - right.week);
}

function mapPersistedRecord(record: {
  week: number | null;
  weight?: number | null;
  length?: number | null;
  headCircumference?: number | null;
}) {
  if (typeof record.week !== 'number') {
    return null;
  }

  return {
    week: record.week,
    weight: typeof record.weight === 'number' ? record.weight : undefined,
    length: typeof record.length === 'number' ? record.length : undefined,
    headCircumference: typeof record.headCircumference === 'number' ? record.headCircumference : undefined,
  } satisfies GrowthRecord;
}

function getPatientProfileSubtitle(relation: MemberRelation, sex: SexKey) {
  return `${RELATION_LABELS[relation]} · ${SEX_LABELS[sex]}`;
}

export default function NewbornGrowthTracker() {
  const { authHeaders, isAuthenticated, isPatient } = useAuthSession();
  const { profile, profiles, selectProfile, updateProfile } = useProfile();
  const isCompactViewport = useCompactViewport();

  const [mockProfiles, setMockProfiles] = useState<GrowthProfile[]>(INITIAL_PROFILES);
  const [selectedMockProfileId, setSelectedMockProfileId] = useState<string>(INITIAL_PROFILES[0].id);
  const [persistedRecords, setPersistedRecords] = useState<Record<string, GrowthRecord[]>>({});
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [currentMetric, setCurrentMetric] = useState<MetricKey>('weight');
  const [formWeek, setFormWeek] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isPatientMode = isAuthenticated && isPatient;
  const metricConfig = METRIC_CONFIG[currentMetric];

  const currentMockProfile = useMemo(
    () => mockProfiles.find((item) => item.id === selectedMockProfileId) ?? mockProfiles[0],
    [mockProfiles, selectedMockProfileId],
  );

  const currentProfileId = isPatientMode ? profile.id : currentMockProfile.id;
  const currentSex = isPatientMode ? profile.gender : currentMockProfile.sex;
  const currentRecords = isPatientMode ? persistedRecords[currentProfileId] ?? [] : currentMockProfile.records;

  const profileOptions = useMemo<MemberOption[]>(() => {
    if (isPatientMode) {
      return profiles.map((item) => ({
        id: item.id,
        name: item.nickname,
        subtitle: getPatientProfileSubtitle(item.relation, item.gender),
        sex: item.gender,
      }));
    }

    return mockProfiles.map((item) => ({
      id: item.id,
      name: item.name,
      subtitle: item.subtitle,
      sex: item.sex,
    }));
  }, [isPatientMode, mockProfiles, profiles]);

  const currentOption = useMemo(
    () => profileOptions.find((item) => item.id === currentProfileId) ?? profileOptions[0],
    [currentProfileId, profileOptions],
  );

  useEffect(() => {
    if (!isPatientMode || !currentProfileId) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setLoadError('');
    setLoadingProfileId(currentProfileId);

    fetch(`/api/me/members/${currentProfileId}/growth`, {
      headers: authHeaders,
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || '加载生长记录失败');
        }

        if (cancelled) {
          return;
        }

        const nextRecords = Array.isArray(data.records)
          ? data.records
              .map(mapPersistedRecord)
              .filter((item: GrowthRecord | null): item is GrowthRecord => Boolean(item))
          : [];

        setPersistedRecords((current) => ({
          ...current,
          [currentProfileId]: nextRecords,
        }));
      })
      .catch((error: Error & { name?: string }) => {
        if (cancelled || error.name === 'AbortError') {
          return;
        }
        setLoadError(error.message || '加载生长记录失败');
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProfileId((current) => (current === currentProfileId ? null : current));
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authHeaders, currentProfileId, isPatientMode]);

  const referenceData = REFERENCE_CURVES[currentSex][currentMetric];
  const isCurrentProfileLoading = isPatientMode && loadingProfileId === currentProfileId;

  const chartData = useMemo<ChartRow[]>(() => {
    const recordMap = new Map<number, GrowthRecord>();
    currentRecords.forEach((record) => {
      recordMap.set(record.week, record);
    });

    return referenceData.map((point) => {
      const record = recordMap.get(point.week);
      const metricValue = record?.[currentMetric];
      const assessment = typeof metricValue === 'number' ? evaluateGrowthAssessment(metricValue, point) : null;

      return {
        ...point,
        value: metricValue,
        lookupWeekLabel: formatReferenceLookupLabel(point.week),
        bandLabel: assessment?.bandLabel,
        zoneLabel: assessment?.zoneLabel,
        summaryLabel: assessment?.summaryLabel,
        conclusion: assessment?.conclusion,
        approxPercentile: assessment?.approxPercentile ?? null,
      };
    });
  }, [currentMetric, currentRecords, referenceData]);

  const latestMetricPoint = useMemo(() => [...chartData].reverse().find((point) => typeof point.value === 'number'), [chartData]);
  const latestAssessment = useMemo(() => {
    if (!latestMetricPoint || typeof latestMetricPoint.value !== 'number') {
      return null;
    }
    return evaluateGrowthAssessment(latestMetricPoint.value, latestMetricPoint);
  }, [latestMetricPoint]);
  const latestMetricWeek = latestMetricPoint?.week ?? null;

  const summaryTone = latestAssessment?.tone ?? 'empty';
  const summaryDescription =
    latestMetricPoint && typeof latestMetricPoint.value === 'number' && latestAssessment
      ? `最新记录：${latestMetricPoint.week}周，按 ${latestMetricPoint.week} 周查表，${metricConfig.shortLabel}${formatMetricValue(latestMetricPoint.value, currentMetric)}${metricConfig.unit}。当前处于 ${latestAssessment.summaryLabel}，${latestAssessment.conclusion}`
      : `当前档案暂未录入${metricConfig.shortLabel}数据，请先新增记录。`;
  const summaryText =
    latestMetricPoint && typeof latestMetricPoint.value === 'number' && latestAssessment
      ? `最新记录：${latestMetricPoint.week}周，${metricConfig.shortLabel}${formatMetricValue(latestMetricPoint.value, currentMetric)}${metricConfig.unit}。当前处于 ${latestAssessment.summaryLabel}，${latestAssessment.conclusion}`
      : `当前档案暂未录入${metricConfig.shortLabel}数据，请先新增记录。`;

  void summaryText;
  const metricPointCount = chartData.filter((point) => typeof point.value === 'number').length;
  const dataSourceHint = isPatientMode
    ? '已连接当前成员档案与数据库记录，新增后会立即持久化。'
    : '当前为演示模式，数据保存在本地组件状态中，刷新页面后会重置。';

  const handleProfileChange = (profileId: string) => {
    if (isPatientMode) {
      selectProfile(profileId);
    } else {
      setSelectedMockProfileId(profileId);
    }

    setFormWeek('');
    setFormValue('');
    setFormError('');
    setLoadError('');
  };

  const handleMetricChange = (metric: MetricKey) => {
    setCurrentMetric(metric);
    setFormValue('');
    setFormError('');
  };

  const handleSexChange = (sex: SexKey) => {
    if (isPatientMode) {
      if (profile.gender !== sex) {
        updateProfile({ gender: sex });
      }
      setFormError('');
      return;
    }

    setMockProfiles((current) =>
      current.map((item) => (item.id === selectedMockProfileId ? { ...item, sex } : item)),
    );
    setFormError('');
  };

  const handleLocalRecordSave = (week: number, value: number) => {
    setMockProfiles((currentProfiles) =>
      currentProfiles.map((item) => {
        if (item.id !== selectedMockProfileId) {
          return item;
        }

        return {
          ...item,
          records: mergeRecordList(item.records, { week, [currentMetric]: value }),
        };
      }),
    );
  };

  const handlePersistedRecordSave = async (week: number, value: number) => {
    const payload: {
      week: number;
      weight?: number;
      length?: number;
      headCircumference?: number;
    } = { week };

    if (currentMetric === 'weight') {
      payload.weight = value;
    } else if (currentMetric === 'length') {
      payload.length = value;
    } else {
      payload.headCircumference = value;
    }

    const response = await fetch(`/api/me/members/${currentProfileId}/growth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || '保存生长记录失败');
    }

    const nextRecord = mapPersistedRecord(data.record);
    if (!nextRecord) {
      throw new Error('服务端返回的记录格式不正确');
    }

    setPersistedRecords((current) => ({
      ...current,
      [currentProfileId]: mergeRecordList(current[currentProfileId] ?? [], nextRecord),
    }));
  };

  const handleAddRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedWeek = Number(formWeek);
    const parsedValue = Number(formValue);

    if (!formWeek.trim() || !formValue.trim()) {
      setFormError('请先填写完整的胎龄和测量值。');
      return;
    }

    if (!Number.isInteger(parsedWeek)) {
      setFormError('当前胎龄请填写 24 到 42 之间的整数周数。');
      return;
    }

    if (parsedWeek < 24 || parsedWeek > 42) {
      setFormError('当前胎龄超出范围，请输入 24 到 42 周。');
      return;
    }

    if (!Number.isFinite(parsedValue)) {
      setFormError('请输入有效的测量数值。');
      return;
    }

    if (parsedValue < metricConfig.min || parsedValue > metricConfig.max) {
      setFormError(`当前${metricConfig.label}超出范围，请输入 ${metricConfig.min} 到 ${metricConfig.max}${metricConfig.unit}。`);
      return;
    }

    try {
      setIsSaving(true);
      setFormError('');

      if (isPatientMode) {
        await handlePersistedRecordSave(parsedWeek, parsedValue);
      } else {
        handleLocalRecordSave(parsedWeek, parsedValue);
      }

      setFormWeek(String(Math.min(parsedWeek + 1, 42)));
      setFormValue('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '保存生长记录失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-[30px] bg-slate-50/80 p-4 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[360px,minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                <Activity className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Growth Dashboard</div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">新生儿生长曲线追踪</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">围绕胎龄 24-42 周，叠加常模百分位与个体三围轨迹，快速观察近期发育趋势。</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">控制面板</div>
                <div className="mt-1 text-xs text-slate-500">切换档案、性别与观察指标</div>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                当前档案：{currentOption?.name || currentProfileId}
              </div>
            </div>

            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
                <div className="inline-flex items-center gap-2 font-semibold text-slate-700">
                  <Database className="h-3.5 w-3.5" />
                  数据源
                </div>
                <p className="mt-2">{dataSourceHint}</p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">选择档案</span>
                <select
                  value={currentProfileId}
                  onChange={(event) => handleProfileChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                >
                  {profileOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}（{item.subtitle}）
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">宝宝性别</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['boy', 'girl'] as SexKey[]).map((sex) => {
                    const active = currentSex === sex;
                    return (
                      <button
                        key={sex}
                        type="button"
                        onClick={() => handleSexChange(sex)}
                        className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                          active
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                        }`}
                      >
                        {SEX_LABELS[sex]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">观察指标</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['weight', 'length', 'headCircumference'] as MetricKey[]).map((metric) => {
                    const active = currentMetric === metric;
                    return (
                      <button
                        key={metric}
                        type="button"
                        onClick={() => handleMetricChange(metric)}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                          active
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                        }`}
                      >
                        {METRIC_CONFIG[metric].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <form className="rounded-2xl border border-slate-100 bg-slate-50 p-4" onSubmit={handleAddRecord}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">新增记录</div>
                    <div className="mt-1 text-xs text-slate-500">同一周重复录入时，会自动合并到当前周的 {metricConfig.label} 字段。</div>
                  </div>
                  <div className="rounded-xl bg-white p-2 text-indigo-600 shadow-sm">
                    <Plus className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">当前胎龄（周）</span>
                    <input
                      type="number"
                      min={24}
                      max={42}
                      step={1}
                      value={formWeek}
                      onChange={(event) => {
                        setFormWeek(event.target.value);
                        setFormError('');
                      }}
                      placeholder="例如 39"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      当前{metricConfig.label}（{metricConfig.unit}）
                    </span>
                    <input
                      type="number"
                      min={metricConfig.min}
                      max={metricConfig.max}
                      step={metricConfig.inputStep}
                      value={formValue}
                      onChange={(event) => {
                        setFormValue(event.target.value);
                        setFormError('');
                      }}
                      placeholder={`请输入 ${metricConfig.min} - ${metricConfig.max}${metricConfig.unit}`}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                    />
                  </label>
                </div>

                {formError ? <div className="mt-3 text-sm text-rose-600">{formError}</div> : null}

                <button
                  type="submit"
                  disabled={isSaving || isCurrentProfileLoading}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  <Plus className="h-4 w-4" />
                  {isSaving ? '保存中...' : '添加记录'}
                </button>
              </form>

              <div className={`rounded-2xl border px-4 py-4 ${SUMMARY_TONE_CLASSES[summaryTone]}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Baby className="h-4 w-4" />
                  诊断摘要
                </div>
                <p className="mt-3 text-sm leading-7">{summaryDescription}</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
                <div className="inline-flex items-center gap-2 font-semibold text-slate-700">
                  <Info className="h-3.5 w-3.5" />
                  演示说明
                </div>
                <p className="mt-2">参考曲线仍为演示用近似常模，仅用于界面展示与交互验证，不替代正式医学评估或临床诊断。</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">数据可视化图表</div>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                {currentOption?.name || '当前档案'} · {metricConfig.label}生长轨迹
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                背景为 {SEX_LABELS[currentSex]} 常模百分位曲线，前景为当前档案的历史记录与最新轨迹。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">档案</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{currentOption?.name || '当前档案'}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">性别</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{SEX_LABELS[currentSex]}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">指标</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{metricConfig.label}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">轨迹点数</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{metricPointCount} 个</div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
              当前宝宝轨迹
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
              <span className="h-px w-5 bg-slate-400" />
              P50 中位线
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
              <span className="h-px w-5 border-t border-dashed border-slate-300" />
              P3 / P10 / P90 / P97
            </span>
          </div>

          {loadError ? (
            <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {loadError}
            </div>
          ) : null}

          <div className="relative mt-6 h-[420px] w-full md:h-[520px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 54, left: 4, bottom: 18 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="week"
                  domain={[24, 42]}
                  ticks={[24, 26, 28, 30, 32, 34, 36, 38, 40, 42]}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  label={{ value: '胎龄 / 周', position: 'insideBottom', offset: -8, fill: '#64748b', fontSize: 12 }}
                />
                <YAxis
                  domain={[metricConfig.min, metricConfig.max]}
                  ticks={metricConfig.ticks}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  width={52}
                  label={{
                    value: `${metricConfig.label} / ${metricConfig.unit}`,
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: '#64748b', fontSize: 12, textAnchor: 'middle' },
                  }}
                />
                <Tooltip content={<GrowthTooltipCard metric={currentMetric} />} cursor={{ stroke: '#c7d2fe', strokeDasharray: '4 4' }} />

                {PERCENTILE_LINES.map((line) => (
                  <Line
                    key={line.key}
                    type="monotone"
                    dataKey={line.key}
                    stroke={line.stroke}
                    strokeWidth={line.strokeWidth}
                    strokeDasharray={line.dasharray}
                    dot={false}
                    isAnimationActive={false}
                    name={line.label}
                  >
                    <LabelList content={createTerminalLabelRenderer(line.label, line.stroke, chartData.length)} />
                  </Line>
                ))}

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={isCompactViewport ? 'transparent' : metricConfig.accent}
                  strokeWidth={3.5}
                  dot={
                    isCompactViewport
                      ? (props) => {
                          const payload = props.payload as ChartRow;
                          if (typeof payload.value !== 'number') {
                            return <circle cx={0} cy={0} r={0} fill="transparent" stroke="transparent" />;
                          }

                          const xValue = toNumericCoordinate(props.cx);
                          const yValue = toNumericCoordinate(props.cy);
                          if (xValue === null || yValue === null) {
                            return <circle cx={0} cy={0} r={0} fill="transparent" stroke="transparent" />;
                          }

                          const isLatest = payload.week === latestMetricWeek;
                          return (
                            <circle
                              key={`compact-point-${payload.week}`}
                              cx={xValue}
                              cy={yValue}
                              r={isLatest ? 5 : 2.5}
                              fill={isLatest ? metricConfig.accent : '#ffffff'}
                              stroke={metricConfig.accent}
                              strokeWidth={isLatest ? 2.25 : 1.6}
                            />
                          );
                        }
                      : { r: 5, strokeWidth: 3, stroke: metricConfig.accent, fill: '#ffffff' }
                  }
                  activeDot={isCompactViewport ? false : { r: 7, strokeWidth: 2, stroke: '#c7d2fe', fill: metricConfig.accent }}
                  connectNulls={false}
                  isAnimationActive={!isCompactViewport}
                  animationDuration={450}
                  name="当前宝宝轨迹"
                />
                {isCompactViewport ? (
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={metricConfig.accent}
                    strokeWidth={3.5}
                    dot={false}
                    activeDot={false}
                    connectNulls={false}
                    isAnimationActive
                    animationDuration={450}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pointerEvents: 'none' }}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>

            {isCurrentProfileLoading ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
                <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 text-center shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">正在加载生长记录</div>
                  <div className="mt-1 text-xs text-slate-500">系统正在同步当前成员的历史轨迹，请稍候。</div>
                </div>
              </div>
            ) : null}

            {!isCurrentProfileLoading && metricPointCount === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-2xl border border-slate-100 bg-white/90 px-5 py-4 text-center shadow-sm backdrop-blur">
                  <div className="text-sm font-semibold text-slate-900">暂无 {metricConfig.label} 轨迹</div>
                  <div className="mt-1 text-xs text-slate-500">先在左侧新增一条记录，图表会立即生成对应轨迹。</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
