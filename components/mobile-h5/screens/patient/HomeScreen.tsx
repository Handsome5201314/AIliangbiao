import React from 'react';
import {
  ClipboardList,
  Users,
  Clock,
  MessageCircle,
  UserPlus,
  Shield,
  Baby,
} from 'lucide-react';
import { cn } from '@/components/mobile-h5/lib/utils';
import type { Child } from '@/components/mobile-h5/types';

interface HomeScreenProps {
  currentChild: Child | null;
  onSelectChild: () => void;
  onStartAssessment: () => void;
  onViewHistory: () => void;
  onOpenAi: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return '早上好';
  if (hour >= 12 && hour < 18) return '下午好';
  return '晚上好';
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

const genderSymbols = {
  male: <span className="text-xs text-sky-400">&#9794;</span>,
  female: <span className="text-xs text-pink-400">&#9792;</span>,
  unknown: <span className="text-xs text-muted">未填写</span>,
} satisfies Record<Child['gender'], React.ReactNode>;

const quickActions = [
  {
    key: 'assessment',
    icon: ClipboardList,
    label: '开始测评',
    desc: '选择量表进行发育筛查',
    handler: 'onStartAssessment' as const,
  },
  {
    key: 'children',
    icon: Users,
    label: '我的孩子',
    desc: '管理孩子档案信息',
    handler: 'onSelectChild' as const,
  },
  {
    key: 'history',
    icon: Clock,
    label: '测评历史',
    desc: '查看过往测评结果',
    handler: 'onViewHistory' as const,
  },
  {
    key: 'ai',
    icon: MessageCircle,
    label: '问问AI',
    desc: '获取专业育儿指导',
    handler: 'onOpenAi' as const,
  },
];

const HomeScreen: React.FC<HomeScreenProps> = ({
  currentChild,
  onSelectChild,
  onStartAssessment,
  onViewHistory,
  onOpenAi,
}) => {
  const handlerMap = {
    onStartAssessment,
    onSelectChild,
    onViewHistory,
    onOpenAi,
  };

  return (
    <section data-component="home-screen" className="px-5 py-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {getGreeting()}
        </h1>
        <p className="text-sm text-muted mt-1">
          智伴童行 · 儿童发育筛查
        </p>
      </div>

      {/* Current child card */}
      <div className="bg-white rounded-card shadow-sm p-5 mt-6">
        {currentChild ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sage-50 flex items-center justify-center flex-shrink-0">
              {currentChild.avatar && currentChild.avatar.startsWith('http') ? (
                <img
                  src={currentChild.avatar}
                  alt={currentChild.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <Baby className="w-5 h-5 text-sage-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-foreground truncate">
                  {currentChild.name}
                </span>
                {genderSymbols[currentChild.gender]}
              </div>
              <p className="text-sm text-muted">{currentChild.ageLabel}</p>
            </div>
            {currentChild.latestAssessment && (
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-pill flex-shrink-0',
                  riskLevelStyles[currentChild.latestAssessment.riskLevel]
                )}
              >
                {riskLevelLabels[currentChild.latestAssessment.riskLevel]}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
            <div className="w-12 h-12 rounded-full bg-cream-100 flex items-center justify-center mb-3">
              <UserPlus className="w-6 h-6 text-muted" />
            </div>
            <p className="text-sm text-muted mb-3">请先添加孩子</p>
            <button
              onClick={onSelectChild}
              className="bg-sage-400 text-white text-sm font-medium px-5 py-2 rounded-button min-h-touch"
            >
              添加孩子
            </button>
          </div>
        )}
      </div>

      {/* Quick action grid */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        {quickActions.map((action) => (
          <button
            key={action.key}
            onClick={handlerMap[action.handler]}
            className="bg-white rounded-card p-4 flex flex-col items-start text-left min-h-touch"
          >
            <action.icon className="w-6 h-6 text-sage-400" />
            <span className="text-sm font-medium text-foreground mt-2">
              {action.label}
            </span>
            <span className="text-xs text-muted mt-0.5">{action.desc}</span>
          </button>
        ))}
      </div>

      {/* Platform description card */}
      <div className="mt-6 bg-sage-50 rounded-card p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-sage-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">
            专业儿童发育筛查平台
          </p>
          <p className="text-xs text-muted mt-1">
            基于国际标准化量表，覆盖孤独症、注意力、发育适应等核心领域，为家长提供科学可靠的筛查参考。
          </p>
        </div>
      </div>
    </section>
  );
};

export default HomeScreen;
