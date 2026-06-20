import React, { useState } from 'react';
import {
  ChevronLeft,
  AlertTriangle,
  Check,
  Baby,
  Calendar,
  Clock,
  FileQuestion,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Child, Scale } from '@/types';

interface AssessmentIntroScreenProps {
  child: Child;
  scale: Scale;
  onStart: () => void;
  onBack: () => void;
  onSwitchChild: () => void;
}

const genderSymbols = {
  male: <span className="text-xs text-sky-400">&#9794;</span>,
  female: <span className="text-xs text-pink-400">&#9792;</span>,
  unknown: <span className="text-xs text-muted">未填写</span>,
} satisfies Record<Child['gender'], React.ReactNode>;

const AssessmentIntroScreen: React.FC<AssessmentIntroScreenProps> = ({
  child,
  scale,
  onStart,
  onBack,
  onSwitchChild,
}) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <section data-component="assessment-intro-screen" className="px-5 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="w-11 h-11 rounded-full -ml-2 min-h-touch"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">测评说明</h1>
      </div>

      {/* Child confirmation card */}
      <div className="mt-4 bg-white rounded-card p-4">
        <p className="text-xs text-muted mb-3">当前测评对象</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sage-50 flex items-center justify-center flex-shrink-0">
            {child.avatar && child.avatar.startsWith('http') ? (
              <img
                src={child.avatar}
                alt={child.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <Baby className="w-5 h-5 text-sage-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-foreground truncate">
                {child.name}
              </span>
              {genderSymbols[child.gender]}
            </div>
            <p className="text-sm text-muted">{child.ageLabel}</p>
          </div>
          <Button
            variant="ghost"
            onClick={onSwitchChild}
            className="text-sm text-sage-500 font-medium min-h-touch px-2"
          >
            切换
          </Button>
        </div>
      </div>

      {/* Scale info card */}
      <div className="mt-4 bg-white rounded-card p-4">
        <h2 className="text-lg font-semibold text-foreground">{scale.name}</h2>

        <div className="flex flex-col gap-3 mt-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted flex-shrink-0" />
            <span className="text-sm text-muted flex-shrink-0">适用范围</span>
            <span className="text-sm font-medium text-foreground ml-auto">
              {scale.ageRange}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-muted flex-shrink-0" />
            <span className="text-sm text-muted flex-shrink-0">预计耗时</span>
            <span className="text-sm font-medium text-foreground ml-auto">
              {scale.duration}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <FileQuestion className="w-4 h-4 text-muted flex-shrink-0" />
            <span className="text-sm text-muted flex-shrink-0">题目数量</span>
            <span className="text-sm font-medium text-foreground ml-auto">
              {scale.questionCount}题
            </span>
          </div>
        </div>
      </div>

      {/* Disclaimer card */}
      <div className="mt-4 bg-warm-50 rounded-card p-4 border border-warm-200">
        <AlertTriangle className="w-5 h-5 text-warm-500" />
        <p className="text-sm font-medium text-foreground mt-2">
          隐私与免责说明
        </p>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          本测评用于儿童发育、行为和心理筛查辅助，不作为医学诊断依据。如结果提示风险，请结合专业医生评估。
        </p>
      </div>

      {/* Agreement checkbox */}
      <div className="mt-4 flex items-start gap-3">
        <Button
          onClick={() => setAgreed((v) => !v)}
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors min-h-[20px]',
            agreed
              ? 'bg-sage-400 border-sage-400'
              : 'bg-white border-cream-300'
          )}
        >
          {agreed && <Check className="w-3.5 h-3.5 text-white" />}
        </Button>
        <span
          className="text-sm text-foreground leading-relaxed cursor-pointer"
          onClick={() => setAgreed((v) => !v)}
        >
          我已阅读并同意上述说明和免责声明
        </span>
      </div>

      {/* Start button */}
      <Button
        onClick={onStart}
        disabled={!agreed}
        className={cn(
          'mt-6 w-full h-button rounded-button text-base font-medium transition-colors min-h-touch',
          agreed
            ? 'bg-sage-400 text-white'
            : 'bg-cream-200 text-muted cursor-not-allowed'
        )}
      >
        开始测评
      </Button>
    </section>
  );
};

export default AssessmentIntroScreen;
