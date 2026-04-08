'use client';

import { useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { LanguageCode, ScaleCategory, ScaleDefinition } from '@/lib/schemas/core/types';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';
import Questionnaire from '@/components/Questionnaire';
import TriageVoiceRecorder from '@/components/TriageVoiceRecorder';
import CallModePanel from '@/components/CallModePanel';
import { useAssessment, useProfile, useSkillSession } from '@/contexts';
import Avatar from '@/components/Avatar';
import AccountOnboardingModal from '@/components/AccountOnboardingModal';
import { Mic, Heart, Users, Brain, Eye, ArrowLeft, Sparkles, LayoutDashboard, History, UserPlus, BriefcaseBusiness, PhoneCall, Bot } from 'lucide-react';

// 量表卡片配置 (匹配底层 registry 中的大写 ID)
const SCALE_CARDS = [
  {
    id: 'SRS',
    icon: <Users className="w-6 h-6 text-blue-500" />,
    bgColor: 'bg-blue-50',
    gradient: 'from-blue-500 to-blue-600',
    tag: '最全面'
  },
  {
    id: 'ABC',
    icon: <Heart className="w-6 h-6 text-rose-500" />,
    bgColor: 'bg-rose-50',
    gradient: 'from-rose-500 to-rose-600',
    tag: null
  },
  {
    id: 'CARS',
    icon: <Brain className="w-6 h-6 text-purple-500" />,
    bgColor: 'bg-purple-50',
    gradient: 'from-purple-500 to-purple-600',
    tag: '较快捷'
  },
  {
    id: 'SNAP-IV',
    icon: <Eye className="w-6 h-6 text-amber-500" />,
    bgColor: 'bg-amber-50',
    gradient: 'from-amber-500 to-amber-600',
    tag: '多动症专病'
  },
  {
    id: 'HOLLAND',
    icon: <BriefcaseBusiness className="w-6 h-6 text-emerald-600" />,
    bgColor: 'bg-emerald-50',
    gradient: 'from-emerald-500 to-emerald-600',
    tag: '职业测评'
  }
];

const CATEGORY_TABS: Array<{ key: 'all' | ScaleCategory; labels: Record<LanguageCode, string> }> = [
  { key: 'all', labels: { zh: '全部', en: 'All' } },
  { key: 'Child Development', labels: { zh: '儿童发育', en: 'Child Development' } },
  { key: 'Mental Health', labels: { zh: '成人心理', en: 'Mental Health' } },
  { key: 'Personality', labels: { zh: '人格测试', en: 'Personality' } },
  { key: 'Career Assessment', labels: { zh: '职业测评', en: 'Career Assessment' } },
];

const UI_COPY = {
  heroBadge: {
    zh: 'AI 临床辅助评估系统 · BYOK 模式',
    en: 'AI Clinical Assessment Platform · BYOK',
  },
  backToHall: {
    zh: '返回量表大厅',
    en: 'Back To Library',
  },
  remainingQuota: {
    zh: '今日剩余',
    en: 'Remaining Today',
  },
  searchPlaceholder: {
    zh: '搜索量表名称、标签或关键词',
    en: 'Search scales, tags, or keywords',
  },
  openAssessment: {
    zh: '开启评估',
    en: 'Start Assessment',
  },
  history: {
    zh: '历史记录',
    en: 'History',
  },
  members: {
    zh: '家庭成员',
    en: 'Members',
  },
  addMember: {
    zh: '新增成员',
    en: 'Add Member',
  },
  genericHeadline: {
    zh: '全人群心理与健康评测平台',
    en: 'Assessment Platform For Every Family Member',
  },
  selfHeadline: {
    zh: '我的健康评测空间',
    en: 'My Personal Assessment Space',
  },
  registeredHint: {
    zh: '已升级为正式账号，可管理多成员档案与历史记录入口。',
    en: 'Registered account unlocked for multi-member profiles and history access.',
  },
  guestHint: {
    zh: '游客模式可先体验评测；注册后解锁多成员管理与更多免费额度。',
    en: 'Guest mode is great for trying assessments; register to unlock more features.',
  },
  emptyState: {
    zh: '暂时没有符合条件的量表，请调整搜索或筛选条件。',
    en: 'No scales matched your current filters.',
  },
  voiceAssistantTitle: {
    zh: '智能语音辅诊助手',
    en: 'Voice Intake Assistant',
  },
  voiceAssistantDesc: {
    zh: '直接点击右侧话筒，向 AI 描述需要评估的家庭成员情况',
    en: 'Tap the mic and describe the family member you want to assess.',
  },
  callMode: {
    zh: '进入通话模式',
    en: 'Enter Call Mode',
  },
  callModeTitle: {
    zh: 'AI 语音通话评测助手',
    en: 'AI Call-Style Assessment Assistant',
  },
  callModeSubtitle: {
    zh: '更适合需要一步步引导、希望像打电话一样完成分诊和量表测试的场景。',
    en: 'Best for guided, phone-like conversations that walk the user through triage and assessments.',
  },
  agentEntry: {
    zh: '进入 Agent',
    en: 'Open Agent',
  },
  privacyHint: {
    zh: '评估结果仅供参考 · 纯本地引擎严格保护您的隐私信息',
    en: 'For reference only · Local-first engine protects your privacy.',
  },
  language: {
    zh: '中 / En',
    en: 'Zh / EN',
  },
} satisfies Record<string, Record<LanguageCode, string>>;

function getScaleCardConfig(scaleId: string) {
  return SCALE_CARDS.find(card => card.id === scaleId);
}

function getEstimatedTime(questionCount: number, estimatedMinutes?: number): string {
  if (estimatedMinutes && estimatedMinutes > 0) {
    return `约 ${estimatedMinutes} 分钟`;
  }
  if (questionCount <= 20) return '约 5 分钟';
  if (questionCount <= 40) return '约 8 分钟';
  if (questionCount <= 60) return '约 12 分钟';
  return '约 15 分钟';
}

/** 设置按钮组件 - 跳转到管理后台 */
function SettingsButton() {
  return (
    <a
      href="/admin"
      className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-200/50 transition-colors text-slate-500 hover:text-slate-800"
      title="管理后台"
    >
      <LayoutDashboard className="w-5 h-5" />
    </a>
  );
}

function LanguageSwitcher({
  language,
  onChange,
}: {
  language: LanguageCode;
  onChange: (language: LanguageCode) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
      <button
        type="button"
        onClick={() => onChange('zh')}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
          language === 'zh' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        中
      </button>
      <button
        type="button"
        onClick={() => onChange('en')}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
          language === 'en' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        EN
      </button>
    </div>
  );
}

export default function Home() {
  const searchParams = useSearchParams();
  const { currentScale, setCurrentScale, resetAssessment } = useAssessment();
  const { profile, profiles, selectProfile, isGuest, accountRole } = useProfile();
  const { token: skillToken, loading: skillSessionLoading } = useSkillSession();
  const [quota, setQuota] = useState<{ remaining: number; dailyLimit: number; isGuest: boolean; role: string } | null>(null);
  const [scales, setScales] = useState<ScaleDefinition[]>([]);
  const [scalesLoading, setScalesLoading] = useState(true);
  const [language, setLanguage] = useState<LanguageCode>('zh');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ScaleCategory>('all');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingReason, setOnboardingReason] = useState<'quota' | 'history' | 'member' | 'manual'>('manual');
  const [isCallModeOpen, setIsCallModeOpen] = useState(false);

  const loadQuota = useCallback(() => {
    if (!skillToken) {
      return Promise.resolve();
    }

    return fetch('/api/skill/v1/me/quota', {
      headers: {
        Authorization: `Bearer ${skillToken}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        if (data.remaining !== undefined) {
          setQuota({
            remaining: data.remaining,
            dailyLimit: data.dailyLimit,
            isGuest: data.isGuest ?? true,
            role: data.role ?? 'GUEST',
          });
        }
      })
      .catch(err => console.error('Failed to check skill quota:', err));
  }, [skillToken]);

  // 页面加载时检查额度
  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

  useEffect(() => {
    void loadQuota();
  }, [accountRole, isGuest, loadQuota]);

  useEffect(() => {
    let active = true;

    if (!skillToken) {
      if (!skillSessionLoading) {
        setScalesLoading(false);
      }
      return () => {
        active = false;
      };
    }

    setScalesLoading(true);

    fetch('/api/skill/v1/scales', {
      headers: {
        Authorization: `Bearer ${skillToken}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        setScales(Array.isArray(data.scales) ? data.scales : []);
      })
      .catch(err => {
        console.error('Failed to load scales:', err);
        if (active) {
          setScales([]);
        }
      })
      .finally(() => {
        if (active) {
          setScalesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [skillSessionLoading, skillToken]);

  const handleBackToHall = useCallback(() => {
    resetAssessment();
  }, [resetAssessment]);

  const openOnboarding = useCallback((reason: 'quota' | 'history' | 'member' | 'manual') => {
    setOnboardingReason(reason);
    setIsOnboardingOpen(true);
  }, []);

  const handleScaleSelect = useCallback((scale: ScaleDefinition) => {
    if (quota?.remaining === 0 && (quota.isGuest || isGuest)) {
      openOnboarding('quota');
      return;
    }

    setCurrentScale(scale);
  }, [isGuest, openOnboarding, quota, setCurrentScale]);

  const handleAgentScaleSelect = useCallback((scaleId: string) => {
    if (quota?.remaining === 0 && (quota.isGuest || isGuest)) {
      openOnboarding('quota');
      return;
    }

    const normalizedScaleId = scaleId.toUpperCase();
    const localScale = scales.find(scale => scale.id.toUpperCase() === normalizedScaleId);

    if (localScale) {
      setCurrentScale(localScale);
      return;
    }

    fetch(`/api/skill/v1/scales/${encodeURIComponent(scaleId)}`, {
      headers: skillToken
        ? {
            Authorization: `Bearer ${skillToken}`,
          }
        : undefined,
    })
      .then(res => res.json())
      .then(data => {
        if (data.scale) {
          setCurrentScale(data.scale);
        }
      })
      .catch(err => console.error('Failed to load recommended scale:', err));
  }, [isGuest, openOnboarding, quota, scales, setCurrentScale, skillToken]);

  const handleCallModeScaleSelect = useCallback((scaleId: string) => {
    setIsCallModeOpen(false);
    handleAgentScaleSelect(scaleId);
  }, [handleAgentScaleSelect]);

  useEffect(() => {
    const scaleId = searchParams.get('scaleId');
    if (!scaleId || currentScale || !scales.length) {
      return;
    }

    const matchedScale = scales.find((item) => item.id.toUpperCase() === scaleId.toUpperCase());
    if (matchedScale) {
      handleScaleSelect(matchedScale);
    }
  }, [currentScale, handleScaleSelect, scales, searchParams]);

  const filteredScales = scales.filter((scale) => {
    const title = resolveLocalizedText(scale.title, language);
    const description = resolveLocalizedText(scale.description, language);
    const tags = scale.tags ?? [];
    const categoryMatches = selectedCategory === 'all' || scale.category === selectedCategory;

    if (!categoryMatches) {
      return false;
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return true;
    }

    const haystack = [scale.id, title, description, ...tags].join(' ').toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const headline = profile.relation === 'self'
    ? UI_COPY.selfHeadline[language]
    : `${profile.nickname}${language === 'zh' ? '的健康档案' : '\'s Assessment Space'}`;

  const subtitle = isGuest
    ? UI_COPY.guestHint[language]
    : UI_COPY.registeredHint[language];

  // ========= 答题状态布局 =========
  if (currentScale) {
    const cardConfig = getScaleCardConfig(currentScale.id);
    
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <nav className="bg-white border-b border-slate-100 px-6 py-4 flex items-center sticky top-0 z-10">
          <button 
            onClick={handleBackToHall}
            className="group flex items-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">{UI_COPY.backToHall[language]}</span>
          </button>
          <div className="ml-8 h-4 w-[1px] bg-slate-200"></div>
          <div className="ml-4 flex items-center gap-2">
            <div className={`w-8 h-8 ${cardConfig?.bgColor || 'bg-slate-100'} rounded-lg flex items-center justify-center`}>
              {cardConfig?.icon || <Sparkles className="w-4 h-4 text-slate-500" />}
            </div>
            <span className="text-slate-800 font-semibold">{resolveLocalizedText(currentScale.title, language)}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher language={language} onChange={setLanguage} />
            <SettingsButton />
          </div>
        </nav>

        <main className="py-8">
          {/* 确保您的项目中已存在 Questionnaire 组件 */}
          <Questionnaire scale={currentScale} language={language} /> 
        </main>
      </div>
    );
  }

  // ========= 首页：自适应 & 防遮挡 & Dock修复 =========
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] relative overflow-hidden">
      {/* 背景光晕 */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-blue-100/50 to-transparent pointer-events-none" />

      {/* 头部导航 */}
      <header className="px-6 py-5 md:py-6 flex flex-col md:flex-row md:items-center justify-between shrink-0 relative z-50 max-w-[1400px] mx-auto w-full gap-4">
        <div>
          <div className="inline-flex items-center text-indigo-600 text-xs font-bold mb-1.5 tracking-wider">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {UI_COPY.heroBadge[language]}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {headline}
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            {subtitle}
          </p>
        </div>
        
        <div className="flex items-center gap-4 self-end md:self-auto">
          {/* 额度显示 */}
          {quota && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              <span className="text-sm font-medium text-slate-700">
                {UI_COPY.remainingQuota[language]}：{quota.remaining}/{quota.dailyLimit}
              </span>
            </div>
          )}
          
          {/* 宝宝头像展示 */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200">
            <Avatar 
              state={profile.avatarState}
              gender={profile.gender}
              className="w-6 h-6"
            />
            <span className="text-sm font-medium text-slate-700 hidden sm:inline">{profile.nickname}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isGuest) {
                openOnboarding('history');
                return;
              }
              alert('历史记录与趋势图入口将在下一步接入。');
            }}
            className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <History className="w-4 h-4" />
            <span>{UI_COPY.history[language]}</span>
          </button>
          <LanguageSwitcher language={language} onChange={setLanguage} />
          <SettingsButton />
        </div>
      </header>

      <div className="px-4 md:px-6 mb-6 max-w-[1400px] mx-auto w-full relative z-0">
        <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-400 rounded-2xl p-4 md:p-5 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
          
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                <Avatar 
                  state={profile.avatarState}
                  gender={profile.gender}
                  className="w-16 h-16 md:w-20 md:h-20 drop-shadow-lg"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg md:text-xl font-bold mb-1">
                  {profile.nickname}
                  {language === 'zh' ? ' · 当前评测对象' : ' · Active Member'}
                </h2>
                <p className="text-sm md:text-base text-white/90">
                  {profile.relation === 'self' ? (language === 'zh' ? '本人档案' : 'Self profile') : `${profile.relation}`}
                  {profile.interests.length > 0 && ` · ${language === 'zh' ? '偏好' : 'Likes'} ${profile.interests.slice(0, 2).join('、')}`}
                </p>
                <p className="text-xs text-white/75 mt-1">
                  {language === 'zh' ? '已完成' : 'Completed'} {profile.completedScales.length} {language === 'zh' ? '次评测' : 'assessments'}
                  {` · ${language === 'zh' ? '账户角色' : 'Role'} ${accountRole}`}
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                  {UI_COPY.members[language]}
                </span>
                <select
                  value={profile.id}
                  onChange={(event) => selectProfile(event.target.value)}
                  className="min-w-[180px] rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white outline-none backdrop-blur"
                >
                  {profiles.map((member) => (
                    <option key={member.id} value={member.id} className="text-slate-900">
                      {member.nickname}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openOnboarding('member')}
                  className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{UI_COPY.addMember[language]}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主体卡片区域 */}
      <main className="flex-1 px-4 md:px-6 pb-44 md:pb-48 w-full max-w-[1400px] mx-auto flex flex-col justify-center relative z-10">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white/90 p-4 md:p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={UI_COPY.searchPlaceholder[language]}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-400 focus:bg-white"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selectedCategory === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.labels[language]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 w-full">
          {filteredScales.map((scale) => {
            const cardConfig = getScaleCardConfig(scale.id);
            const estimatedTime = getEstimatedTime(scale.questions.length, scale.estimatedMinutes);
            const localizedTitle = resolveLocalizedText(scale.title, language);
            const localizedDescription = resolveLocalizedText(scale.description, language);
            
            return (
              <div 
                key={scale.id}
                onClick={() => handleScaleSelect(scale)}
                className="group bg-white rounded-2xl p-5 border border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative flex flex-col cursor-pointer h-full"
              >
                {cardConfig?.tag && (
                  <span className="absolute top-4 right-4 bg-indigo-50 text-indigo-600 text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full">
                    {cardConfig.tag}
                  </span>
                )}
                
                <div className="flex items-center gap-3 mb-4 pr-12">
                  <div className={`w-12 h-12 ${cardConfig?.bgColor || 'bg-slate-50'} rounded-xl flex items-center justify-center group-hover:bg-gradient-to-br ${cardConfig?.gradient || 'from-slate-400 to-slate-500'} group-hover:text-white transition-all duration-300 shrink-0 shadow-sm`}>
                    {cardConfig?.icon || <Sparkles className="w-6 h-6 text-slate-500" />}
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                      {scale.id} {/* 使用量表ID作为简写，例如 ABC */}
                    </h3>
                    <p className="text-[10px] md:text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wide truncate w-32">
                      {localizedTitle}
                    </p>
                  </div>
                </div>
                
                <p className="text-slate-600 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">
                  {localizedDescription}
                </p>

                <div className="mt-auto flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-1">
                    <span className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full mr-1.5"></span>
                      {scale.questions.length} 题
                    </span>
                    <span className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full mr-1.5"></span>
                      {estimatedTime}
                    </span>
                  </div>
                  <button className="w-full flex items-center justify-center space-x-2 bg-slate-900 text-white py-2.5 md:py-3 rounded-xl hover:bg-indigo-600 hover:shadow-md transition-all group-hover:bg-indigo-600 active:scale-95">
                    <span className="text-sm md:text-base font-bold">{UI_COPY.openAssessment[language]}</span>
                    <Mic className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {!scalesLoading && !skillSessionLoading && filteredScales.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-center text-sm text-slate-500">
            {UI_COPY.emptyState[language]}
          </div>
        )}
      </main>

      {/* 底部悬浮语音组件（Dock修复版） */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none w-full px-4 max-w-[95%] md:max-w-3xl">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] border border-slate-200/80 rounded-[2rem] p-3 md:py-3 md:px-5 flex flex-col md:flex-row items-center gap-2 md:gap-5 transition-all">
          
          <div className="hidden md:flex flex-col items-start gap-0.5 pl-2">
            <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>{UI_COPY.voiceAssistantTitle[language]}</span>
            </div>
            <p className="text-slate-500 text-xs whitespace-nowrap">{UI_COPY.voiceAssistantDesc[language]}</p>
          </div>
          
          <div className="hidden md:block h-10 w-[1px] bg-slate-200"></div>
          
          <div className="shrink-0 relative flex flex-col items-center justify-center min-w-[80px]
            [&>div]:!bg-transparent 
            [&>div]:!shadow-none 
            [&>div]:!border-none 
            [&>div]:!p-0 
            [&>div]:!m-0
            [&_p]:!mt-1 [&_p]:!text-[11px]
          ">
             {/* 确保您的项目中已存在 TriageVoiceRecorder 组件 */}
             <TriageVoiceRecorder onStartScale={handleAgentScaleSelect} language={language} mode="dock" />
          </div>

          <button
            type="button"
            onClick={() => setIsCallModeOpen(true)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <PhoneCall className="h-4 w-4" />
            <span>{UI_COPY.callMode[language]}</span>
          </button>

          <a
            href="/agent"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Bot className="h-4 w-4" />
            <span>{UI_COPY.agentEntry[language]}</span>
          </a>

        </div>
        
      <div className="mt-3 text-center pointer-events-auto hidden sm:block">
          <p className="text-slate-400 text-[10px] md:text-xs font-medium drop-shadow-sm">
            {UI_COPY.privacyHint[language]}
          </p>
        </div>
      </div>

      <CallModePanel
        open={isCallModeOpen}
        onClose={() => setIsCallModeOpen(false)}
        title={UI_COPY.callModeTitle[language]}
        subtitle={UI_COPY.callModeSubtitle[language]}
      >
        <TriageVoiceRecorder
          onStartScale={handleCallModeScaleSelect}
          language={language}
          mode="call"
        />
      </CallModePanel>

      <AccountOnboardingModal
        open={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        reason={onboardingReason}
      />

    </div>
  );
}
