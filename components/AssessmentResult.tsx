/**
 * 评估结果展示组件
 * 支持数据保存、导出、AI建议生成
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  Image,
  FileSpreadsheet,
  Sparkles,
  Loader2,
  Share2,
  Printer,
} from 'lucide-react';

import type {
  LanguageCode,
  ScaleDefinition,
  ScaleDimensionResult,
  ScaleScoreResult,
} from '@/lib/schemas/core/types';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';
import {
  exportToCSV,
  exportToImage,
  exportToPDF,
  formatDateTime,
  type AssessmentExportData,
  type AssessmentSubjectInfo,
} from '@/lib/utils/exportUtils';
import { useProfile } from '@/contexts/ProfileContext';
import { useSkillSession } from '@/contexts/SkillSessionContext';
import Avatar from './Avatar';

interface AssessmentResultProps {
  result: ScaleScoreResult;
  scale: ScaleDefinition;
  answers: number[];
  deviceId: string;
  language?: LanguageCode;
  formData?: Record<string, string | number | null>;
}

function formatFieldValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '未填写';
  }

  return String(value);
}

function buildSubjectInfo(
  scale: ScaleDefinition,
  formData: Record<string, string | number | null> | undefined
): AssessmentSubjectInfo | undefined {
  if (!scale.patientInfoFields?.length || !formData) {
    return undefined;
  }

  const rows = scale.patientInfoFields.map((field) => ({
    label: field.label,
    value: formatFieldValue(formData[field.id]),
  }));

  const nameField = scale.patientInfoFields.find((field) => field.id === 'name');
  const name = nameField ? formatFieldValue(formData[nameField.id]) : undefined;

  return {
    title: '受测者信息',
    name,
    rows,
  };
}

function resolveDimensionResults(result: ScaleScoreResult): ScaleDimensionResult[] {
  const dimensionResults = result.details?.dimensionResults;
  if (Array.isArray(dimensionResults)) {
    return dimensionResults as ScaleDimensionResult[];
  }

  return [];
}

export default function AssessmentResult({
  result,
  scale,
  answers,
  deviceId,
  language = 'zh',
  formData,
}: AssessmentResultProps) {
  const { profile } = useProfile();
  const { token: skillToken, memberId: skillMemberId } = useSkillSession();
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState<string>('');
  const [exportStatus, setExportStatus] = useState<string>('');

  const scaleName = resolveLocalizedText(scale.title, language);
  const subjectInfo = buildSubjectInfo(scale, formData);
  const dimensionResults = resolveDimensionResults(result);
  const scoreLabel = typeof result.details?.scoreLabel === 'string' ? result.details.scoreLabel : '总分';
  const scoreDisplay =
    typeof result.details?.scoreDisplay === 'string' ? result.details.scoreDisplay : `${result.totalScore} 分`;
  const totalScoreLabel =
    typeof result.details?.totalScoreLabel === 'string' ? result.details.totalScoreLabel : '总分';
  const totalScoreHint =
    typeof result.details?.totalScoreHint === 'string' ? result.details.totalScoreHint : '';

  const generateAdvice = useCallback(async () => {
    setIsGeneratingAdvice(true);
    setAdviceError('');

    try {
      if (!skillToken) {
        throw new Error('Skill session is not ready yet.');
      }

      const adviceEndpoint = `/api/skill/v1/me/members/${encodeURIComponent(skillMemberId || profile.id)}/advice`;
      const response = await fetch(adviceEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${skillToken}`,
        },
        body: JSON.stringify({
          deviceId,
          result: {
            scaleId: scale.id,
            scaleName,
            totalScore: result.totalScore,
            conclusion: result.conclusion,
            details: result.details,
            patientInfo: formData,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('生成建议失败');
      }

      const data = await response.json();
      setAiAdvice(data.advice);
    } catch (error) {
      console.error('生成 AI 建议失败:', error);
      setAdviceError('生成建议失败，请稍后重试');
    } finally {
      setIsGeneratingAdvice(false);
    }
  }, [deviceId, formData, profile.id, result, scale.id, scaleName, skillMemberId, skillToken]);

  useEffect(() => {
    void generateAdvice();
  }, [generateAdvice]);

  const getExportData = useCallback((): AssessmentExportData => ({
    scaleId: scale.id,
    scaleName,
    totalScore: result.totalScore,
    conclusion: result.conclusion,
    details: result.details,
    answers,
    childProfile: subjectInfo
      ? undefined
      : {
          nickname: profile.nickname,
          gender: profile.gender,
          ageMonths: profile.ageMonths,
        },
    subjectInfo,
    dimensionResults,
    importantNotice:
      typeof scale.importantNotice === 'string' ? scale.importantNotice : scale.importantNotice?.zh,
    instructions: typeof scale.instructions === 'string' ? scale.instructions : scale.instructions?.zh,
    reference: typeof scale.reference === 'string' ? scale.reference : scale.reference?.zh,
    completedAt: formatDateTime(new Date()),
    advice: aiAdvice,
  }), [aiAdvice, answers, dimensionResults, profile.ageMonths, profile.gender, profile.nickname, result, scale, scaleName, subjectInfo]);

  const handleExportCSV = () => {
    try {
      setExportStatus('正在导出表格...');
      exportToCSV(getExportData());
      setExportStatus('表格导出成功！');
      setTimeout(() => setExportStatus(''), 2000);
    } catch (error) {
      console.error('导出表格失败:', error);
      setExportStatus('导出失败，请重试');
    }
  };

  const handleExportImage = async () => {
    try {
      setExportStatus('正在生成图片...');
      const filename = `评估报告_${scaleName}_${subjectInfo?.name || profile.nickname}_${formatDate(new Date())}`;
      await exportToImage('assessment-result', filename);
      setExportStatus('图片导出成功！');
      setTimeout(() => setExportStatus(''), 2000);
    } catch (error) {
      console.error('导出图片失败:', error);
      setExportStatus('导出失败，请重试');
    }
  };

  const handleExportPDF = async () => {
    try {
      setExportStatus('正在生成PDF...');
      const filename = `评估报告_${scaleName}_${subjectInfo?.name || profile.nickname}_${formatDate(new Date())}`;
      await exportToPDF('assessment-result', filename);
      setExportStatus('PDF导出成功！');
      setTimeout(() => setExportStatus(''), 2000);
    } catch (error) {
      console.error('导出PDF失败:', error);
      setExportStatus('导出失败，请重试');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${scaleName}评估报告`,
          text: `${scaleName}评估结果：${result.conclusion}`,
        });
      } catch (error) {
        console.log('分享取消或失败');
      }
    } else {
      alert('您的浏览器不支持分享功能');
    }
  };

  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  const cautionItems =
    scale.category === 'Child Development'
      ? [
          '本评估结果仅供参考，不能替代专业医疗诊断',
          '如有疑虑，请咨询专业医生或心理评估师',
          '建议定期进行评估，跟踪儿童发展情况',
        ]
      : [
          '本评估结果仅供参考，不能替代专业医疗诊断',
          '如有疑虑，请咨询专业医生或心理评估师',
          '建议结合门诊随访或复测结果，持续跟踪症状变化',
        ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 relative">
      <div className="fixed top-4 left-4 z-10">
        <Avatar
          state={profile.avatarState}
          gender={profile.gender}
          className="w-20 h-20 drop-shadow-lg"
        />
        <div className="text-center mt-1 text-xs font-medium text-gray-600">
          {subjectInfo?.name || profile.nickname}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-700">导出报告</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
          >
            <FileSpreadsheet className="w-4 h-4" />
            表格
          </button>
          <button
            onClick={handleExportImage}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <Image className="w-4 h-4" />
            图片
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            打印
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
          >
            <Share2 className="w-4 h-4" />
            分享
          </button>
        </div>
        {exportStatus && (
          <div className="w-full text-center text-sm text-indigo-600 mt-2">
            {exportStatus}
          </div>
        )}
      </div>

      <div id="assessment-result" className="space-y-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">评估完成</h2>
          <p className="text-gray-600 mb-6">本次评估结果已生成，可用于后续复测和就诊对比。</p>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 mb-6">
            <div className="text-5xl font-bold text-indigo-600 mb-2">{scoreDisplay}</div>
            <div className="text-sm font-medium text-indigo-500 mb-2">{scoreLabel}</div>
            <div className="text-lg font-semibold text-gray-700 mb-4">{result.conclusion}</div>
            {scoreLabel !== totalScoreLabel && (
              <p className="text-sm text-gray-600 text-left mb-3">
                {totalScoreLabel}：{result.totalScore}
                {totalScoreHint ? `。${totalScoreHint}` : ''}
              </p>
            )}
            {result.details?.description && (
              <p className="text-sm text-gray-600 text-left whitespace-pre-wrap">{result.details.description}</p>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-left text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="font-medium text-gray-700">量表：</span>
                {scaleName}
              </div>
              <div>
                <span className="font-medium text-gray-700">评估对象：</span>
                {subjectInfo?.name || profile.nickname}
              </div>
              {scale.shortName && (
                <div>
                  <span className="font-medium text-gray-700">简称：</span>
                  {scale.shortName}
                </div>
              )}
              <div>
                <span className="font-medium text-gray-700">评估时间：</span>
                {formatDateTime(new Date())}
              </div>
            </div>
          </div>
        </div>

        {subjectInfo?.rows.length ? (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{subjectInfo.title || '受测者信息'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {subjectInfo.rows.map((row) => (
                <div key={row.label} className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="text-slate-500">{row.label}</div>
                  <div className="mt-1 font-medium text-slate-800">{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {dimensionResults.length ? (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">维度结果</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dimensionResults.map((dimension) => (
                <div key={dimension.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <div className="text-sm font-semibold text-slate-800">{dimension.label}</div>
                  <div className="mt-2 text-2xl font-bold text-indigo-600">
                    {dimension.displayValue || `${dimension.score}分`}
                  </div>
                  {dimension.maxScore ? (
                    <div className="mt-1 text-xs text-slate-500">范围：0 - {dimension.maxScore}</div>
                  ) : null}
                  {dimension.description ? (
                    <p className="mt-2 text-sm text-slate-600">{dimension.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {(scale.importantNotice || scale.instructions || scale.reference) && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">量表说明</h3>
            <div className="space-y-4 text-sm text-slate-700">
              {scale.importantNotice && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <p className="font-semibold mb-1">重要提示</p>
                  <p className="whitespace-pre-wrap">{resolveLocalizedText(scale.importantNotice, language)}</p>
                </div>
              )}
              {scale.instructions && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold mb-1 text-slate-900">说明</p>
                  <p className="whitespace-pre-wrap">{resolveLocalizedText(scale.instructions, language)}</p>
                </div>
              )}
              {scale.reference && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold mb-1 text-slate-900">参考文献</p>
                  <p className="whitespace-pre-wrap">{resolveLocalizedText(scale.reference, language)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">答题明细</h3>
          <div className="space-y-2">
            {answers.map((answer, index) => {
              const question = scale.questions[index];
              const selectedOption = question?.options.find((option) => option.score === answer);
              return (
                <div key={question?.externalId || index} className="flex items-start gap-2 text-sm border-b border-gray-100 pb-2">
                  <div className="font-medium text-gray-600 min-w-[60px]">题目 {index + 1}</div>
                  <div className="flex-1">
                    <div className="text-gray-700">{resolveLocalizedText(question?.text || '', language)}</div>
                    <div className="text-indigo-600 font-medium mt-1">答案：{selectedOption?.label || answer}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              AI 个性化建议
            </h3>
            {aiAdvice && (
              <button
                onClick={() => void generateAdvice()}
                disabled={isGeneratingAdvice}
                className="text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
              >
                {isGeneratingAdvice ? '重新生成中...' : '重新生成'}
              </button>
            )}
          </div>

          {isGeneratingAdvice && !aiAdvice && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mr-2" />
              <span className="text-gray-600">AI 正在生成个性化建议...</span>
            </div>
          )}

          {adviceError && (
            <div className="bg-red-50 rounded-lg p-4 text-red-700">
              {adviceError}
              <button onClick={() => void generateAdvice()} className="ml-2 underline hover:no-underline">
                重试
              </button>
            </div>
          )}

          {aiAdvice && (
            <div className="prose prose-sm max-w-none">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 text-gray-700 whitespace-pre-wrap">
                {aiAdvice}
              </div>
            </div>
          )}

          {!isGeneratingAdvice && !aiAdvice && !adviceError && (
            <div className="text-center py-8 text-gray-500">正在生成建议...</div>
          )}
        </div>

        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">⚠️ 注意事项</p>
          <ul className="list-disc list-inside space-y-1">
            {cautionItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
