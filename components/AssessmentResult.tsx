/**
 * 评估结果展示组件
 * 支持数据保存、导出、AI建议生成
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, Download, FileText, Image, FileSpreadsheet, 
  Sparkles, Loader2, Share2, Printer
} from 'lucide-react';
import { exportToCSV, exportToImage, exportToPDF, formatDateTime, AssessmentExportData } from '@/lib/utils/exportUtils';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useSkillSession } from '@/contexts/SkillSessionContext';
import type { LanguageCode, ScaleResultDeliveryMode } from '@/lib/schemas/core/types';
import Avatar from './Avatar';
import ExportDNAButton from './ExportDNAButton';

interface AssessmentResultProps {
  result: {
    totalScore: number;
    conclusion: string;
    details?: {
      description?: string;
      [key: string]: unknown;
    };
  } | null;
  scale: {
    id: string;
    name: string;
    resultDeliveryMode?: ScaleResultDeliveryMode;
    questions: Array<{
      id: number;
      text: string;
      options: Array<{ label: string; score: number }>;
    }>;
  };
  answers: number[];
  deviceId: string;
  language?: LanguageCode;
  resultDeliveryMode?: ScaleResultDeliveryMode;
  resultVisibleToRespondent?: boolean;
}

const FUNCTIONAL_IMPACT_LABELS: Record<number, string> = {
  1: '没有',
  2: '轻度',
  3: '中度',
  4: '重度',
};

export default function AssessmentResult({
  result,
  scale,
  answers,
  deviceId,
  language = 'zh',
  resultDeliveryMode,
  resultVisibleToRespondent = true,
}: AssessmentResultProps) {
  const { profile, isGuest } = useProfile();
  const { isAuthenticated, isPatient } = useAuthSession();
  const { token: skillToken, memberId: skillMemberId } = useSkillSession();
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState<string>('');
  const [exportStatus, setExportStatus] = useState<string>('');
  const effectiveDeliveryMode = resultDeliveryMode || scale.resultDeliveryMode || 'immediate';
  const isPhysicianReview =
    effectiveDeliveryMode === 'physician_review' || resultVisibleToRespondent === false;
  const resolvedResult = result || {
    totalScore: 0,
    conclusion: '',
    details: {},
  };
  const scoreLabel = typeof resolvedResult.details?.scoreLabel === 'string' ? resolvedResult.details.scoreLabel : '总分';
  const scoreDisplay = typeof resolvedResult.details?.scoreDisplay === 'string'
    ? resolvedResult.details.scoreDisplay
    : `${resolvedResult.totalScore} 分`;
  const totalScoreLabel = typeof resolvedResult.details?.totalScoreLabel === 'string'
    ? resolvedResult.details.totalScoreLabel
    : '总分';
  const totalScoreHint = typeof resolvedResult.details?.totalScoreHint === 'string'
    ? resolvedResult.details.totalScoreHint
    : '';
  const dimensions =
    typeof resolvedResult.details?.dimensions === 'object' && resolvedResult.details.dimensions !== null
      ? (resolvedResult.details.dimensions as Record<string, unknown>)
      : undefined;
  const functionalImpact =
    dimensions &&
    typeof dimensions.functional_impact === 'object' &&
    dimensions.functional_impact !== null
      ? (dimensions.functional_impact as { label?: unknown; score?: unknown })
      : undefined;
  const functionalImpactLabel =
    typeof functionalImpact?.label === 'string' ? functionalImpact.label : '社会功能影响';
  const functionalImpactScore =
    typeof functionalImpact?.score === 'number' ? functionalImpact.score : undefined;
  const functionalImpactOptionLabel =
    functionalImpactScore !== undefined
      ? FUNCTIONAL_IMPACT_LABELS[functionalImpactScore]
      : undefined;
  const dimensionEntries = Object.entries(dimensions || {})
    .filter(([key, value]) => {
      if (key === 'functional_impact') {
        return false;
      }

      return typeof value === 'object' && value !== null;
    })
    .map(([key, value]) => {
      const entry = value as {
        label?: unknown;
        score?: unknown;
        maxScore?: unknown;
      };

      return {
        key,
        label: typeof entry.label === 'string' ? entry.label : key,
        score: typeof entry.score === 'number' ? entry.score : undefined,
        maxScore: typeof entry.maxScore === 'number' ? entry.maxScore : undefined,
      };
    })
    .filter((entry) => entry.score !== undefined);
  const answerDetailsMap =
    typeof resolvedResult.details?.answerDetails === 'object' && resolvedResult.details.answerDetails !== null
      ? (resolvedResult.details.answerDetails as Record<string, { selectedSymptoms?: Array<{ id?: string; label?: string }>; primarySymptomLabel?: string }>)
      : undefined;
  const showAnswerScoreInDetails = scale.id === 'SRS';

  const completedAt = new Date().toISOString();

  // 自动生成 AI 建议
  useEffect(() => {
    if (!isPhysicianReview && result) {
      generateAdvice();
    }
  }, [isPhysicianReview, result]);

  const generateAdvice = async () => {
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
          language,
          result: {
            scaleId: scale.id,
            scaleName: scale.name,
            totalScore: resolvedResult.totalScore,
            conclusion: resolvedResult.conclusion,
            details: resolvedResult.details,
          }
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
  };

  // 准备导出数据
  const getExportData = useCallback((): AssessmentExportData => ({
    scaleId: scale.id,
    scaleName: scale.name,
    totalScore: resolvedResult.totalScore,
    conclusion: resolvedResult.conclusion,
    details: resolvedResult.details,
    answers,
    childProfile: {
      nickname: profile.nickname,
      gender: profile.gender,
      ageMonths: profile.ageMonths,
    },
    completedAt: formatDateTime(new Date()),
    advice: aiAdvice,
  }), [scale, resolvedResult, answers, profile, aiAdvice]);

  // 导出为 CSV
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

  // 导出为图片
  const handleExportImage = async () => {
    try {
      setExportStatus('正在生成图片...');
      const filename = `评估报告_${scale.name}_${profile.nickname}_${formatDate(new Date())}`;
      await exportToImage('assessment-result', filename);
      setExportStatus('图片导出成功！');
      setTimeout(() => setExportStatus(''), 2000);
    } catch (error) {
      console.error('导出图片失败:', error);
      setExportStatus('导出失败，请重试');
    }
  };

  // 导出为 PDF
  const handleExportPDF = async () => {
    try {
      setExportStatus('正在生成PDF...');
      const filename = `评估报告_${scale.name}_${profile.nickname}_${formatDate(new Date())}`;
      await exportToPDF('assessment-result', filename);
      setExportStatus('PDF导出成功！');
      setTimeout(() => setExportStatus(''), 2000);
    } catch (error) {
      console.error('导出PDF失败:', error);
      setExportStatus('导出失败，请重试');
    }
  };

  // 打印
  const handlePrint = () => {
    window.print();
  };

  // 分享
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.nickname}的评估报告`,
          text: `${scale.name}评估结果：${resolvedResult.conclusion}`,
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

  if (isPhysicianReview) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 relative">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:hidden">
          <Avatar nickname={profile.nickname} className="w-14 h-14" />
          <div>
            <div className="text-sm font-semibold text-slate-900">{profile.nickname}</div>
            <div className="text-xs text-slate-500">当前受测对象</div>
          </div>
        </div>

        <div className="fixed top-4 left-4 z-10 hidden md:block">
          <Avatar nickname={profile.nickname} className="w-20 h-20 drop-shadow-lg" />
          <div className="text-center mt-1 text-xs font-medium text-slate-600">
            {profile.nickname}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">提交成功</h2>
            <p className="text-slate-600 mb-6">量表已提交，等待医师审核评估结果。</p>

            <div className="bg-gradient-to-br from-cyan-50 to-indigo-50 rounded-xl p-6 text-left">
              <div className="text-sm font-medium text-slate-500 mb-2">说明</div>
              <div className="space-y-2 text-sm leading-7 text-slate-700">
                <p>当前量表结果仅向医师和后台审核端展示。</p>
                <p>如为门诊筛查，请留意医师后续反馈。</p>
                <p>提交时间：{formatDateTime(new Date(completedAt))}</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">注意事项</p>
            <ul className="list-disc list-inside space-y-1">
              <li>本次提交已经保存到系统，医师端仍可查看完整分数和答案明细。</li>
              <li>当前页面不展示总分、结论、导出和分享。</li>
              <li>如需进一步解读，请等待医师审核反馈。</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 relative">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:hidden">
        <Avatar nickname={profile.nickname} className="w-14 h-14" />
        <div>
          <div className="text-sm font-semibold text-slate-900">{profile.nickname}</div>
          <div className="text-xs text-slate-500">当前受测对象</div>
        </div>
      </div>
      {/* 左上角小人 */}
      <div className="fixed top-4 left-4 z-10 hidden md:block">
        <Avatar nickname={profile.nickname} className="w-20 h-20 drop-shadow-lg" />
        <div className="text-center mt-1 text-xs font-medium text-slate-600">
          {profile.nickname}
        </div>
      </div>

      {/* 导出操作栏 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-slate-600" />
          <span className="font-medium text-slate-700">导出报告</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
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
          {isAuthenticated && isPatient && (
            <ExportDNAButton
              profileId={skillMemberId || profile.id}
              idleLabel="导出 Arena DNA"
              exportingLabel="正在提取 Arena DNA..."
            />
          )}
        </div>
        {exportStatus && (
          <div className="w-full text-center text-sm text-indigo-600 mt-2">
            {exportStatus}
          </div>
        )}
      </div>

      {/* 评估结果卡片 - 用于导出 */}
      <div id="assessment-result" className="space-y-4">
        {/* 完成提示 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">评估完成</h2>
          <p className="text-slate-600 mb-6">🎉 恭喜！{profile.nickname}完成了评估，结果已保存！</p>
          
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 mb-6">
            <div className="text-5xl font-bold text-indigo-600 mb-2">
              {scoreDisplay}
            </div>
            <div className="text-sm font-medium text-indigo-500 mb-2">
              {scoreLabel}
            </div>
            <div className="text-lg font-semibold text-slate-700 mb-4">
              {resolvedResult.conclusion}
            </div>
            {scoreLabel !== '总分' && (
              <p className="text-sm text-slate-600 text-left mb-3">
                {totalScoreLabel}：{resolvedResult.totalScore}
                {totalScoreHint ? `。${totalScoreHint}` : ''}
              </p>
            )}
            {functionalImpactScore !== undefined && (
              <div className="mb-3 rounded-lg bg-white/70 px-4 py-3 text-left">
                <div className="text-xs font-medium text-slate-500 mb-1">
                  {functionalImpactLabel}
                </div>
                <div className="text-sm text-slate-700">
                  {functionalImpactOptionLabel || `${functionalImpactScore} 分`}
                  {functionalImpactOptionLabel ? `（${functionalImpactScore}分）` : ''}
                </div>
              </div>
            )}
            {dimensionEntries.length > 0 && (
              <div className="mb-4 grid gap-3 text-left sm:grid-cols-2 xl:grid-cols-3">
                {dimensionEntries.map((dimension) => (
                  <div key={dimension.key} className="rounded-lg bg-white/80 px-4 py-3">
                    <div className="text-xs font-medium text-slate-500">
                      {dimension.label}
                    </div>
                    <div className="mt-1 text-base font-semibold text-slate-800">
                      {dimension.score}
                      {dimension.maxScore !== undefined ? ` / ${dimension.maxScore}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {resolvedResult.details?.description && (
              <p className="text-sm text-slate-600 text-left">
                {resolvedResult.details.description}
              </p>
            )}
          </div>

          {/* 基本信息 */}
          <div className="bg-slate-50 rounded-lg p-4 text-left text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="font-medium text-slate-700">量表：</span>{scale.name}</div>
              <div><span className="font-medium text-slate-700">评估人：</span>{profile.nickname}</div>
              <div><span className="font-medium text-slate-700">性别：</span>{profile.gender === 'boy' ? '男孩' : '女孩'}</div>
              {profile.ageMonths && (
                <div><span className="font-medium text-slate-700">月龄：</span>{profile.ageMonths}个月</div>
              )}
              <div className="col-span-2"><span className="font-medium text-slate-700">评估时间：</span>{formatDateTime(new Date())}</div>
            </div>
          </div>
        </div>

        {/* 答题明细 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">答题明细</h3>
          <div className="space-y-2">
            {answers.map((answer, index) => {
              const question = scale.questions[index];
              const selectedOption = question?.options.find(opt => opt.score === answer);
              const answerDisplay = selectedOption
                ? showAnswerScoreInDetails
                  ? `${selectedOption.label}（${selectedOption.score}分）`
                  : selectedOption.label
                : answer;
              const answerDetail = answerDetailsMap?.[String(question?.id ?? index + 1)];
              return (
                <div key={index} className="flex items-start gap-2 text-sm border-b border-slate-100 pb-2">
                  <div className="font-medium text-slate-600 min-w-[60px]">题目 {index + 1}</div>
                  <div className="flex-1">
                    <div className="text-slate-700">{question?.text}</div>
                    <div className="text-indigo-600 font-medium mt-1">
                      答案：{answerDisplay}
                    </div>
                    {answerDetail?.selectedSymptoms?.length ? (
                      <div className="mt-2 text-xs text-slate-500">
                        <div>相关症状：{answerDetail.selectedSymptoms.map((item) => item.label || item.id).join('、')}</div>
                        {answerDetail.primarySymptomLabel ? <div className="mt-1">主症状：{answerDetail.primarySymptomLabel}</div> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI 个性化建议 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              AI 个性化建议
            </h3>
            {aiAdvice && (
              <button
                onClick={generateAdvice}
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
              <span className="text-slate-600">AI 正在生成个性化建议...</span>
            </div>
          )}

          {adviceError && (
            <div className="bg-rose-50 rounded-lg p-4 text-rose-700">
              {adviceError}
              <button
                onClick={generateAdvice}
                className="ml-2 underline hover:no-underline"
              >
                重试
              </button>
            </div>
          )}

          {aiAdvice && (
            <div className="prose prose-sm max-w-none">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 text-slate-700 whitespace-pre-wrap">
                {aiAdvice}
              </div>
            </div>
          )}

          {!isGeneratingAdvice && !aiAdvice && !adviceError && (
            <div className="text-center py-8 text-slate-500">
              正在生成建议...
            </div>
          )}
        </div>

        {/* 注意事项 */}
        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">⚠️ 注意事项</p>
          <ul className="list-disc list-inside space-y-1">
            <li>{isGuest ? '游客自测量表结果仅供参考，不具有医疗法律效应。' : '本评估结果仅供参考，不能替代专业医疗诊断。'}</li>
            <li>如有疑虑，请咨询专业医生或心理评估师</li>
            <li>建议定期进行评估，跟踪儿童发展情况</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
