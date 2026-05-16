'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Brain,
  BriefcaseBusiness,
  ExternalLink,
  FlaskConical,
  Heart,
  LayoutDashboard,
  LogOut,
  Mic,
  Sparkles,
  UserPlus,
  Users,
  Eye,
} from 'lucide-react';

import type { LanguageCode, ScaleCategory, ScaleDefinition } from '@/lib/schemas/core/types';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';
import { EXPLORE_TESTS } from '@/lib/explore-tests/catalog';
import Questionnaire from '@/components/Questionnaire';
import WebHandoffLauncher from '@/components/WebHandoffLauncher';
import Avatar from '@/components/Avatar';
import AccountOnboardingModal from '@/components/AccountOnboardingModal';
import PatientDoctorPanel from '@/components/PatientDoctorPanel';
import PatientAgentEntryCard from '@/components/PatientAgentEntryCard';
import dynamic from 'next/dynamic';

const NewbornGrowthTracker = dynamic(
  () => import('@/components/NewbornGrowthTracker'),
  { ssr: false }
);
import { useAssessment, useAuthSession, useProfile, useSkillSession } from '@/contexts';

const SCALE_CARDS = [
  { id: 'SRS', icon: <Users className="h-6 w-6 text-blue-500" />, bgColor: 'bg-blue-50', gradient: 'from-blue-500 to-blue-600', tag: '最全面' },
  { id: 'ABC', icon: <Heart className="h-6 w-6 text-rose-500" />, bgColor: 'bg-rose-50', gradient: 'from-rose-500 to-rose-600', tag: null },
  { id: 'CARS', icon: <Brain className="h-6 w-6 text-purple-500" />, bgColor: 'bg-purple-50', gradient: 'from-purple-500 to-purple-600', tag: '较快捷' },
  { id: 'SNAP-IV', icon: <Eye className="h-6 w-6 text-amber-500" />, bgColor: 'bg-amber-50', gradient: 'from-amber-500 to-amber-600', tag: '多动专测' },
  { id: 'HOLLAND', icon: <BriefcaseBusiness className="h-6 w-6 text-emerald-600" />, bgColor: 'bg-emerald-50', gradient: 'from-emerald-500 to-emerald-600', tag: '职业测评' },
];

const CATEGORY_TABS: Array<{ key: 'all' | ScaleCategory; labels: Record<LanguageCode, string> }> = [
  { key: 'all', labels: { zh: '全部', en: 'All' } },
  { key: 'Child Development', labels: { zh: '儿童发育', en: 'Child Development' } },
  { key: 'Mental Health', labels: { zh: '成人心理', en: 'Mental Health' } },
  { key: 'Personality', labels: { zh: '人格测试', en: 'Personality' } },
  { key: 'Career Assessment', labels: { zh: '职业测评', en: 'Career Assessment' } },
];

function getScaleCardConfig(scaleId: string) {
  return SCALE_CARDS.find((item) => item.id === scaleId);
}

function getEstimatedTime(questionCount: number, estimatedMinutes?: number) {
  if (estimatedMinutes && estimatedMinutes > 0) {
    return `约 ${estimatedMinutes} 分钟`;
  }
  if (questionCount <= 20) return '约 5 分钟';
  if (questionCount <= 40) return '约 8 分钟';
  if (questionCount <= 60) return '约 12 分钟';
  return '约 15 分钟';
}

function SettingsButton() {
  return (
    <Link
      href="/admin"
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/50 hover:text-slate-800"
      title="管理后台"
    >
      <LayoutDashboard className="h-5 w-5" />
    </Link>
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
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          language === 'zh' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        中
      </button>
      <button
        type="button"
        onClick={() => onChange('en')}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          language === 'en' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        EN
      </button>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentScale, setCurrentScale, resetAssessment } = useAssessment();
  const { user, loading: authLoading, isAuthenticated, isDoctor, logout } = useAuthSession();
  const { profile, profiles, selectProfile, isGuest } = useProfile();
  const { token: skillToken, loading: skillSessionLoading } = useSkillSession();

  const [language, setLanguage] = useState<LanguageCode>('zh');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ScaleCategory>('all');
  const [homeSection, setHomeSection] = useState<'clinical' | 'growth' | 'explore'>('clinical');
  const [scales, setScales] = useState<ScaleDefinition[]>([]);
  const [scalesLoading, setScalesLoading] = useState(true);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const loadScaleLibrary = useCallback(async () => {
    if (skillToken) {
      try {
        const response = await fetch('/api/skill/v1/scales', {
          headers: { Authorization: `Bearer ${skillToken}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(payload.scales)) {
          return payload.scales as ScaleDefinition[];
        }
      } catch {
        // fall through to public scales
      }
    }

    const response = await fetch('/api/scales');
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.scales) ? (payload.scales as ScaleDefinition[]) : [];
  }, [skillToken]);

  useEffect(() => {
    let cancelled = false;
    setScalesLoading(true);

    loadScaleLibrary()
      .then((loadedScales) => {
        if (!cancelled) {
          setScales(loadedScales);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScales([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setScalesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadScaleLibrary, skillSessionLoading]);

  useEffect(() => {
    const scaleId = searchParams.get('scaleId');
    if (!scaleId || currentScale || !scales.length) {
      return;
    }

    const matched = scales.find((item) => item.id.toUpperCase() === scaleId.toUpperCase());
    if (matched) {
      setCurrentScale(matched);
    }
  }, [currentScale, scales, searchParams, setCurrentScale]);

  const filteredScales = useMemo(() => {
    return scales.filter((scale) => {
      if (selectedCategory !== 'all' && scale.category !== selectedCategory) {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        return true;
      }

      const title = resolveLocalizedText(scale.title, language);
      const description = resolveLocalizedText(scale.description, language);
      const tags = scale.tags ?? [];
      const haystack = [scale.id, title, description, ...tags].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [language, scales, searchQuery, selectedCategory]);

  const identityLabel = isDoctor
    ? user?.doctorProfile?.realName || user?.email || '医生账号'
    : profile.nickname;

  const goToLogin = useCallback((target: 'PATIENT' | 'DOCTOR') => {
    const href = target === 'DOCTOR' ? '/doctor/login' : '/auth/login';
    if (isAuthenticated) {
      logout();
    }
    router.push(href);
  }, [isAuthenticated, logout, router]);

  if (currentScale) {
    const cardConfig = getScaleCardConfig(currentScale.id);
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="sticky top-0 z-10 flex items-center border-b border-slate-100 bg-white px-6 py-4">
          <button onClick={resetAssessment} className="group flex items-center text-slate-500 transition-colors hover:text-slate-900">
            <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-medium">返回量表大厅</span>
          </button>
          <div className="ml-8 h-4 w-px bg-slate-200" />
          <div className="ml-4 flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cardConfig?.bgColor || 'bg-slate-100'}`}>
              {cardConfig?.icon || <Sparkles className="h-4 w-4 text-slate-500" />}
            </div>
            <span className="font-semibold text-slate-800">{resolveLocalizedText(currentScale.title, language)}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher language={language} onChange={setLanguage} />
            <SettingsButton />
          </div>
        </nav>

        <main className="py-8">
          {currentScale.interactionMode === 'web_handoff' ? (
            <WebHandoffLauncher scaleId={currentScale.id} language={language} />
          ) : (
            <Questionnaire scale={currentScale} language={language} />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-100/40 via-cyan-50/20 to-transparent" />

      <header className="relative z-50 mx-auto flex w-full max-w-[1400px] flex-col justify-between gap-4 px-6 py-5 md:flex-row md:items-center md:py-6">
        <div>
          <div className="mb-1.5 inline-flex items-center text-xs font-bold tracking-wider text-indigo-600">
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            AI 临床辅助评估系统 · BYOK 模式
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
            {isDoctor ? '医生工作入口' : profile.relation === 'self' ? '我的健康筛查空间' : `${profile.nickname} 的健康档案`}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {isDoctor
              ? '当前登录的是医生账号，患者侧模块已自动切换为医生视角。'
              : isGuest
                ? '游客模式可先体验筛查；注册后解锁多成员与更多能力。'
                : '正式账号可管理多成员档案、绑定医生和智能体入口。'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 self-end md:self-auto">
          {!authLoading && isAuthenticated && isDoctor ? (
            <Link
              href="/doctor"
              className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-700"
            >
              进入医生后台
            </Link>
          ) : null}
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => goToLogin('PATIENT')}
              className="rounded-full px-3 py-1 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              患者登录
            </button>
            <button
              type="button"
              onClick={() => goToLogin('DOCTOR')}
              className="rounded-full px-3 py-1 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              医生登录
            </button>
          </div>
          {!authLoading && isAuthenticated ? (
            <>
              <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-emerald-700">
                  {isDoctor ? '医生已登录' : '患者已登录'}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <Avatar state={profile.avatarState} gender={profile.gender} className="h-6 w-6" />
                <span className="hidden text-sm font-medium text-slate-700 sm:inline">{identityLabel}</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                <span>退出登录</span>
              </button>
            </>
          ) : null}
          <LanguageSwitcher language={language} onChange={setLanguage} />
          <SettingsButton />
        </div>
      </header>

      {!isDoctor ? (
        <>
          <div className="relative z-10 mx-auto mb-6 w-full max-w-[1400px] px-4 md:px-6">
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-cyan-50 p-1.5">
                      <Avatar state={profile.avatarState} gender={profile.gender} className="h-16 w-16 shrink-0 rounded-xl" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-slate-900">{profile.nickname}</h2>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
                        {isGuest ? '游客' : '已认证'}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-500">
                      默认从量表大厅开始，按需绑定医生、进入医生智能体，或继续使用自助智能体。
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                    <span className="text-xs font-medium text-slate-500">家庭成员</span>
                    <select
                      value={profile.id}
                      onChange={(event) => selectProfile(event.target.value)}
                      className="min-w-[120px] rounded-lg border-0 bg-transparent py-0 text-sm font-semibold text-slate-800 outline-none"
                    >
                      {profiles.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.nickname}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOnboardingOpen(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>新增成员</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div id="user-center" className="relative z-10 mx-auto mb-6 w-full max-w-[1400px] px-4 md:px-6">
            <PatientDoctorPanel />
          </div>
          <div className="relative z-10 mx-auto mb-6 w-full max-w-[1400px] px-4 md:px-6">
            <PatientAgentEntryCard />
          </div>
        </>
      ) : (
        <div className="relative z-10 mx-auto mb-6 w-full max-w-[1400px] px-4 md:px-6">
          <div className="rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">Doctor Mode</div>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">{user?.doctorProfile?.realName || user?.email || '医生账号'}</h2>
                <p className="mt-2 text-sm text-slate-600">患者大厅模块已折叠，请从医生工作台进入患者管理、AI 分身和邀请功能。</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/doctor" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600">
                  进入医生工作台
                </Link>
                <Link href="/doctor/invites" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  打开医生邀请
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-4 pb-16 md:px-6 md:pb-24">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setHomeSection('clinical')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                homeSection === 'clinical' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              临床量表
            </button>
            <button
              type="button"
              onClick={() => setHomeSection('explore')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                homeSection === 'explore' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              探索测试
            </button>
            <button
              type="button"
              onClick={() => setHomeSection('growth')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                homeSection === 'growth' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              生长曲线
            </button>
          </div>
        </div>

        {homeSection === 'clinical' ? (
          <>
            {isGuest ? (
              <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50/90 p-4 text-sm leading-7 text-amber-900 shadow-sm">
                游客自测结果仅供参考，不具有医疗法律效应；如涉及临床判断，请由医生或专业评估人员进一步确认。
              </div>
            ) : null}

            <div className="mb-6 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm md:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索量表名称、标签或关键字"
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
                        selectedCategory === tab.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.labels[language]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-5">
              {filteredScales.map((scale) => {
                const cardConfig = getScaleCardConfig(scale.id);
                const estimatedTime = getEstimatedTime(scale.questions.length, scale.estimatedMinutes);
                const localizedTitle = resolveLocalizedText(scale.title, language);
                const localizedDescription = resolveLocalizedText(scale.description, language);

                return (
                  <div
                    key={scale.id}
                    onClick={() => setCurrentScale(scale)}
                    className="group relative flex h-full cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl"
                  >
                    {cardConfig?.tag ? (
                      <span className="absolute right-4 top-4 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-600 md:text-xs">
                        {cardConfig.tag}
                      </span>
                    ) : null}

                    <div className="mb-4 flex items-center gap-3 pr-12">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cardConfig?.bgColor || 'bg-slate-50'} shadow-sm transition-all duration-300 group-hover:bg-gradient-to-br ${cardConfig?.gradient || 'from-slate-400 to-slate-500'} group-hover:text-white`}>
                        {cardConfig?.icon || <Sparkles className="h-6 w-6 text-slate-500" />}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold leading-tight text-slate-900 transition-colors group-hover:text-indigo-600 md:text-xl">
                          {scale.id}
                        </h3>
                        <p className="mt-0.5 w-32 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:text-xs">
                          {localizedTitle}
                        </p>
                      </div>
                    </div>

                    <p className="mb-6 flex-1 line-clamp-3 text-sm leading-relaxed text-slate-600">{localizedDescription}</p>

                    <div className="mt-auto flex flex-col gap-3">
                      <div className="flex items-center justify-between px-1 text-xs font-medium text-slate-500">
                        <span>{scale.questions.length} 题</span>
                        <span>{estimatedTime}</span>
                      </div>
                      <button className="flex w-full items-center justify-center space-x-2 rounded-xl bg-slate-900 py-2.5 text-white transition-all hover:bg-indigo-600 hover:shadow-md group-hover:bg-indigo-600 active:scale-95 md:py-3">
                        <span className="text-sm font-bold md:text-base">开始评估</span>
                        <Mic className="h-4 w-4 md:h-5 md:w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {!scalesLoading && !skillSessionLoading && filteredScales.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-center text-sm text-slate-500">
                暂时没有符合条件的量表，请调整搜索或筛选条件。
              </div>
            ) : null}
          </>
        ) : homeSection === 'growth' ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-indigo-100 bg-white/90 p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Growth Tracking</div>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">新生儿生长曲线追踪</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                    在同一视图中查看胎龄 24-42 周的体重、身长、头围常模百分位，并叠加宝宝自己的历史轨迹与最新记录。
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                  支持男 / 女切换、三围切换、动态录入与即时摘要
                </div>
              </div>
            </div>

            <NewbornGrowthTracker />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <FlaskConical className="mt-0.5 h-5 w-5 text-emerald-700" />
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-slate-900">探索测试</h2>
                  <p className="text-sm leading-7 text-slate-600">这些测试用于自我探索体验，不替代正式临床量表与心理评估。</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {EXPLORE_TESTS.map((test) => (
                <div key={test.id} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                        <span>{test.tags.join(' · ')}</span>
                      </div>
                      <h3 className="mt-4 text-2xl font-bold text-slate-900">{test.title}</h3>
                      <p className="mt-2 text-sm font-medium text-slate-500">{test.subtitle}</p>
                    </div>
                    <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                      <Brain className="h-6 w-6" />
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-slate-600">{test.description}</p>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">{test.questionCountLabel}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">{test.dimensionCountLabel}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">{test.resultCountLabel}</span>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-800">来源</p>
                    <p className="mt-1">{test.source.author}</p>
                    <p className="mt-1 break-all">{test.source.siteUrl}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-500">{test.source.disclaimer}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href={test.routePath} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600">
                      <span>进入测试</span>
                      <Sparkles className="h-4 w-4" />
                    </Link>
                    <a href={test.source.siteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                      <ExternalLink className="h-4 w-4" />
                      <span>查看原站</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <AccountOnboardingModal
        open={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        reason="manual"
      />
    </div>
  );
}
