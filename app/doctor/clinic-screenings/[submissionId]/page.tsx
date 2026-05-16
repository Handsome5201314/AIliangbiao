'use client';

import { useEffect, useState } from 'react';
import { FileJson, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import {
  type DoctorAssessmentExportData,
  downloadDoctorAssessmentCsv,
  downloadDoctorAssessmentJson,
  downloadDoctorAssessmentPdf,
  downloadDoctorAssessmentWord,
} from '@/lib/utils/doctorAssessmentExport';
import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DoctorClinicScreeningDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { authHeaders } = useAuthSession();
  const [submissionId, setSubmissionId] = useState('');
  const [screening, setScreening] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setSubmissionId(resolved.submissionId));
  }, [params]);

  useEffect(() => {
    if (!submissionId) return;
    fetch(`/api/doctor/clinic-screenings/${submissionId}`, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setScreening(data.screening))
      .catch(console.error);
  }, [authHeaders, submissionId]);

  const exportReport = async (format: 'pdf' | 'json' | 'word' | 'csv') => {
    setExportingKey(format);
    setStatus('');
    try {
      const response = await fetch(`/api/doctor/clinic-screenings/${submissionId}/report`, {
        headers: authHeaders,
      });
      const data = (await response.json()) as DoctorAssessmentExportData | { error?: string };
      if (!response.ok) {
        throw new Error('error' in data ? data.error || '导出失败' : '导出失败');
      }
      const report = data as DoctorAssessmentExportData;
      if (format === 'json') {
        downloadDoctorAssessmentJson(report);
      } else if (format === 'csv') {
        downloadDoctorAssessmentCsv(report);
      } else if (format === 'word') {
        downloadDoctorAssessmentWord(report);
      } else {
        await downloadDoctorAssessmentPdf(report);
      }
      setStatus(`已导出 ${report.scale.name} 报告（${format.toUpperCase()}）`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExportingKey(null);
    }
  };

  if (!screening) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  const answers = Array.isArray(screening.answers) ? screening.answers : [];
  const result = screening.resultSummary || {};
  const rawTotalScore = typeof result.totalScore === 'number' ? result.totalScore : undefined;
  const scoreLabel = typeof result.details?.scoreLabel === 'string' ? result.details.scoreLabel : '总分';
  const scoreDisplay =
    typeof result.details?.scoreDisplay === 'string'
      ? result.details.scoreDisplay
      : rawTotalScore !== undefined
        ? String(rawTotalScore)
        : '-';
  const totalScoreLabel =
    typeof result.details?.totalScoreLabel === 'string' ? result.details.totalScoreLabel : '总分';
  const totalScoreHint =
    typeof result.details?.totalScoreHint === 'string' ? result.details.totalScoreHint : '';
  const dimensions =
    typeof result.details?.dimensions === 'object' && result.details.dimensions !== null
      ? (result.details.dimensions as Record<string, { label?: string; score?: number; maxScore?: number }>)
      : null;
  const dimensionEntries = dimensions
    ? Object.entries(dimensions)
        .filter(([key, value]) => key !== 'functional_impact' && value && typeof value === 'object')
        .map(([key, value]) => ({
          key,
          label: typeof value.label === 'string' ? value.label : key,
          score: typeof value.score === 'number' ? value.score : undefined,
          maxScore: typeof value.maxScore === 'number' ? value.maxScore : undefined,
        }))
        .filter((item) => item.score !== undefined)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="门诊筛查详情" description="查看单次门诊二维码筛查结果、答案明细和导出报告。" />

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm text-slate-500">筛查编号</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{screening.screeningCode}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">状态</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{screening.status}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">受测对象</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{screening.respondentName}</div>
            <div className="mt-1 text-sm text-slate-500">{screening.respondentGender} · {screening.respondentAgeMonths} 月</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">点位 / 量表</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{screening.point.name}</div>
            <div className="mt-1 text-sm text-slate-500">{screening.scale.id} · {screening.scale.title}</div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">量表结果</h2>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'pdf' as const, label: 'PDF', icon: <FileText className="h-4 w-4" /> },
              { key: 'json' as const, label: 'JSON', icon: <FileJson className="h-4 w-4" /> },
              { key: 'word' as const, label: 'Word', icon: <FileText className="h-4 w-4" /> },
              { key: 'csv' as const, label: 'CSV', icon: <FileSpreadsheet className="h-4 w-4" /> },
            ]).map((item) => (
              <Button
                key={item.key}
                variant="outline"
                size="sm"
                onClick={() => void exportReport(item.key)}
                disabled={Boolean(exportingKey)}
              >
                {exportingKey === item.key ? <Loader2 className="h-4 w-4 animate-spin" /> : item.icon}
                <span>{item.label}</span>
              </Button>
            ))}
          </div>
        </div>
        {status && <div className="mt-3 text-sm text-slate-500">{status}</div>}
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <div className="text-sm text-slate-500">{scoreLabel}</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{scoreDisplay}</div>
          <div className="mt-2 text-lg font-semibold text-slate-700">{result.conclusion}</div>
          {scoreLabel !== '总分' ? (
            <div className="mt-3 text-sm text-slate-500">
              {totalScoreLabel}：{rawTotalScore !== undefined ? rawTotalScore : '-'}
            </div>
          ) : null}
          {totalScoreHint ? <div className="mt-2 text-sm text-slate-500">{totalScoreHint}</div> : null}
          {dimensionEntries.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dimensionEntries.map((dimension) => (
                <div key={dimension.key} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-xs font-medium text-slate-500">{dimension.label}</div>
                  <div className="mt-1 text-base font-semibold text-slate-900">
                    {dimension.score}
                    {dimension.maxScore !== undefined ? ` / ${dimension.maxScore}` : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {typeof result.details?.description === 'string' ? (
            <div className="mt-4 text-sm leading-7 text-slate-600">{result.details.description}</div>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">答案明细</h2>
        <div className="mt-4 space-y-3">
          {screening.scale.questions.map((question: any, index: number) => {
            const answerScore = answers[index];
            const answerLabel = question.options.find((option: any) => option.score === answerScore)?.label || '-';
            const answerDisplay =
              screening.scale.id === 'SRS' && typeof answerScore === 'number'
                ? `${answerLabel}（${answerScore}分）`
                : answerLabel;
            return (
              <div key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">第 {index + 1} 题</div>
                <div className="mt-2 text-sm text-slate-700">{question.text}</div>
                <div className="mt-2 text-sm text-cyan-700">答案：{answerDisplay}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
