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
import { useProfile } from '@/contexts/ProfileContext';
import Avatar from './Avatar';

interface AssessmentResultProps {
  result: {
    totalScore: number;
    conclusion: string;
    details?: {
      description?: string;
      [key: string]: unknown;
    };
  };
  scale: {
    id: string;
    name: string;
    questions: Array<{
      text: string;
      options: Array<{ label: string; score: number }>;
    }>;
  };
  answers: number[];
  deviceId: string;
}

export default function AssessmentResult({ result, scale, answers, deviceId }: AssessmentResultProps) {
  const { profile } = useProfile();
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState<string>('');
  const [exportStatus, setExportStatus] = useState<string>('');

  const completedAt = new Date().toISOString();

  // 自动生成 AI 建议
  useEffect(() => {
    generateAdvice();
  }, []);

  const generateAdvice = async () => {
    setIsGeneratingAdvice(true);
    setAdviceError('');
    
    try {
      const response = await fetch('/api/assessment/generate-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          result: {
            scaleId: scale.id,
            scaleName: scale.name,
            totalScore: result.totalScore,
            conclusion: result.conclusion,
            details: result.details,
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
    totalScore: result.totalScore,
    conclusion: result.conclusion,
    details: result.details,
    answers,
    childProfile: {
      nickname: profile.nickname,
      gender: profile.gender,
      ageMonths: profile.ageMonths,
    },
    completedAt: formatDateTime(new Date()),
    advice: aiAdvice,
  }), [scale, result, answers, profile, aiAdvice]);

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
          text: `${scale.name}评估结果：${result.conclusion}`,
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 relative">
      {/* 左上角小人 */}
      <div className="fixed top-4 left-4 z-10">
        <Avatar 
          state={profile.avatarState}
          gender={profile.gender}
          className="w-20 h-20 drop-shadow-lg"
        />
        <div className="text-center mt-1 text-xs font-medium text-gray-600">
          {profile.nickname}
        </div>
      </div>

      {/* 导出操作栏 */}
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

      {/* 评估结果卡片 - 用于导出 */}
      <div id="assessment-result" className="space-y-4">
        {/* 完成提示 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">评估完成</h2>
          <p className="text-gray-600 mb-6">🎉 恭喜！{profile.nickname}完成了评估，结果已保存！</p>
          
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 mb-6">
            <div className="text-5xl font-bold text-indigo-600 mb-2">
              {result.totalScore} 分
            </div>
            <div className="text-lg font-semibold text-gray-700 mb-4">
              {result.conclusion}
            </div>
            {result.details?.description && (
              <p className="text-sm text-gray-600 text-left">
                {result.details.description}
              </p>
            )}
          </div>

          {/* 基本信息 */}
          <div className="bg-gray-50 rounded-lg p-4 text-left text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="font-medium text-gray-700">量表：</span>{scale.name}</div>
              <div><span className="font-medium text-gray-700">评估人：</span>{profile.nickname}</div>
              <div><span className="font-medium text-gray-700">性别：</span>{profile.gender === 'boy' ? '男孩' : '女孩'}</div>
              {profile.ageMonths && (
                <div><span className="font-medium text-gray-700">月龄：</span>{profile.ageMonths}个月</div>
              )}
              <div className="col-span-2"><span className="font-medium text-gray-700">评估时间：</span>{formatDateTime(new Date())}</div>
            </div>
          </div>
        </div>

        {/* 答题明细 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">答题明细</h3>
          <div className="space-y-2">
            {answers.map((answer, index) => {
              const question = scale.questions[index];
              const selectedOption = question?.options.find(opt => opt.score === answer);
              return (
                <div key={index} className="flex items-start gap-2 text-sm border-b border-gray-100 pb-2">
                  <div className="font-medium text-gray-600 min-w-[60px]">题目 {index + 1}</div>
                  <div className="flex-1">
                    <div className="text-gray-700">{question?.text}</div>
                    <div className="text-indigo-600 font-medium mt-1">
                      答案：{selectedOption?.label || answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI 个性化建议 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
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
              <span className="text-gray-600">AI 正在生成个性化建议...</span>
            </div>
          )}

          {adviceError && (
            <div className="bg-red-50 rounded-lg p-4 text-red-700">
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
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 text-gray-700 whitespace-pre-wrap">
                {aiAdvice}
              </div>
            </div>
          )}

          {!isGeneratingAdvice && !aiAdvice && !adviceError && (
            <div className="text-center py-8 text-gray-500">
              正在生成建议...
            </div>
          )}
        </div>

        {/* 注意事项 */}
        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">⚠️ 注意事项</p>
          <ul className="list-disc list-inside space-y-1">
            <li>本评估结果仅供参考，不能替代专业医疗诊断</li>
            <li>如有疑虑，请咨询专业医生或心理评估师</li>
            <li>建议定期进行评估，跟踪儿童发展情况</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
