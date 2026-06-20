import React from 'react';
import {
  ChevronLeft,
  Plus,
  Check,
  Baby,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Child } from '@/types';

interface ChildrenScreenProps {
  children: Child[];
  selectedChildId: string | null;
  onSelectChild: (id: string) => void;
  onBack: () => void;
}

const riskLevelStyles: Record<string, string> = {
  low: 'bg-sage-50 text-sage-600',
  moderate: 'bg-warm-50 text-warm-500',
  high: 'bg-red-100 text-red-600',
};

const riskLevelLabels: Record<string, string> = {
  low: '低风险',
  moderate: '中等风险',
  high: '高风险',
};

const ChildrenScreen: React.FC<ChildrenScreenProps> = ({
  children: childList,
  selectedChildId,
  onSelectChild,
  onBack,
}) => {
  return (
    <section data-component="children-screen" className="px-5 py-4">
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
        <h1 className="text-xl font-semibold text-foreground">我的孩子</h1>
      </div>

      {/* Child list */}
      {childList.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {childList.map((child) => {
            const isSelected = child.id === selectedChildId;
            return (
              <Button
                key={child.id}
                onClick={() => onSelectChild(child.id)}
                className={cn(
                  'bg-white rounded-card p-4 flex items-center gap-4 text-left w-full min-h-touch transition-colors',
                  isSelected && 'border-2 border-sage-400'
                )}
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-sage-50 flex items-center justify-center flex-shrink-0">
                  {child.avatar && child.avatar.startsWith('http') ? (
                    <img
                      src={child.avatar}
                      alt={child.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">
                      <Baby className="w-6 h-6 text-sage-400" />
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-foreground truncate">
                      {child.name}
                    </span>
                    {child.gender === 'male' ? (
                      <span className="text-xs text-sky-400">&#9794;</span>
                    ) : (
                      <span className="text-xs text-pink-400">&#9792;</span>
                    )}
                  </div>
                  <p className="text-sm text-muted mt-0.5">{child.ageLabel}</p>
                  {child.latestAssessment && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <FileText className="w-3.5 h-3.5 text-muted" />
                      <span className="text-xs text-muted">
                        {child.latestAssessment.scaleName}
                      </span>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-pill',
                          riskLevelStyles[child.latestAssessment.riskLevel]
                        )}
                      >
                        {riskLevelLabels[child.latestAssessment.riskLevel]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-sage-400 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </Button>
            );
          })}

          {/* Add child card */}
          <Button variant="outline" className="border-2 border-dashed border-cream-300 rounded-card p-4 flex items-center justify-center gap-2 min-h-touch">
            <Plus className="w-5 h-5 text-muted" />
            <span className="text-sm text-muted">添加孩子</span>
          </Button>
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center mt-20">
          <div className="w-16 h-16 rounded-full bg-cream-100 flex items-center justify-center mb-4">
            <Baby className="w-8 h-8 text-muted" />
          </div>
          <p className="text-base font-medium text-foreground">
            暂无孩子档案
          </p>
          <p className="text-sm text-muted mt-2 text-center">
            添加孩子信息后，即可开始发育筛查测评
          </p>
          <Button className="mt-6 bg-sage-400 text-white text-sm font-medium px-6 py-2.5 rounded-button min-h-touch flex items-center gap-2">
            <Plus className="w-4 h-4" />
            添加孩子
          </Button>
        </div>
      )}
    </section>
  );
};

export default ChildrenScreen;
