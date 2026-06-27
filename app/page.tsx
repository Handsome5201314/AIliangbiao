'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Brain,
  ClipboardList,
  FileText,
  Heart,
  History,
  LayoutDashboard,
  LogOut,
  Mic,
  Monitor,
  Sparkles,
  Smartphone,
  Stethoscope,
  UserPlus,
  UserRound,
  Users,
  Eye,
} from 'lucide-react';

import type { LanguageCode, ScaleDefinition } from '@/lib/schemas/core/types';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';
import Questionnaire from '@/components/Questionnaire';
import WebHandoffLauncher from '@/components/WebHandoffLauncher';
import Avatar from '@/components/Avatar';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import AccountOnboardingModal from '@/components/AccountOnboardingModal';
import PatientDoctorPanel from '@/components/PatientDoctorPanel';
import PatientAgentEntryCard from '@/components/PatientAgentEntryCard';
import dynamic from 'next/dynamic';

const NewbornGrowthTracker = dynamic(
  () => import('@/components/NewbornGrowthTracker'),
  { ssr: false }
);
import { useAssessment, useAuthSession, useProfile, useSkillSession } from '@/contexts';
import {
  ROOT_HOME_VIEW_STORAGE_KEY,
  normalizeRootHomeViewMode,
  resolveRootHomeView,
  type ResolvedRootHomeView,
} from '@/lib/root-home-view';

type ChildScaleCategoryKey = 'all_child' | 'child_development' | 'child_clinical';

const SCALE_CARDS = [
  { id: 'SRS', icon: <Users className="h-6 w-6 text-blue-500" />, bgColor: 'bg-blue-50', gradient: 'from-blue-500 to-blue-600', tag: '最全面' },
  { id: 'ABC', icon: <Heart className="h-6 w-6 text-rose-500" />, bgColor: 'bg-rose-50', gradient: 'from-rose-500 to-rose-600', tag: null },
  { id: 'CARS', icon: <Brain className="h-6 w-6 text-purple-500" />, bgColor: 'bg-purple-50', gradient: 'from-purple-500 to-purple-600', tag: '较快捷' },
  { id: 'SNAP-IV', icon: <Eye className="h-6 w-6 text-amber-500" />, bgColor: 'bg-amber-50', gradient: 'from-amber-500 to-amber-600', tag: '多动专测' },
  { id: 'M_CHAT_R', icon: <Sparkles className="h-6 w-6 text-cyan-500" />, bgColor: 'bg-cyan-50', gradient: 'from-cyan-500 to-cyan-600', tag: '早筛入口' },
  { id: 'ATEC', icon: <Brain className="h-6 w-6 text-sky-500" />, bgColor: 'bg-sky-50', gradient: 'from-sky-500 to-sky-600', tag: null },
  { id: 'VINELAND_3', icon: <Heart className="h-6 w-6 text-fuchsia-500" />, bgColor: 'bg-fuchsia-50', gradient: 'from-fuchsia-500 to-fuchsia-600', tag: '适应行为' },
  { id: 'CBCL_113', icon: <Eye className="h-6 w-6 text-teal-500" />, bgColor: 'bg-teal-50', gradient: 'from-teal-500 to-teal-600', tag: '行为筛查' },
  { id: 'TAS_37', icon: <Heart className="h-6 w-6 text-orange-500" />, bgColor: 'bg-orange-50', gradient: 'from-orange-500 to-orange-600', tag: '情绪观察' },
];

const CATEGORY_TABS: Array<{ key: ChildScaleCategoryKey; labels: Record<LanguageCode, string> }> = [
  { key: 'all_child', labels: { zh: '全部儿童', en: 'All Child' } },
  { key: 'child_development', labels: { zh: '儿童发育', en: 'Child Development' } },
  { key: 'child_clinical', labels: { zh: '儿童临床', en: 'Child Clinical' } },
];

const ROOT_HOME_MOBILE_MEDIA_QUERY = '(max-width: 767px)';
const PARENT_SELF_BLOCKED_SCALE_IDS = new Set(['CARS', 'VINELAND_3']);

async function fetchChildScaleLibrary(skillToken?: string | null) {
  const params = new URLSearchParams();
  params.set('category', 'all_child');
  const query = `?${params.toString()}`;

  if (skillToken) {
    try {
      const response = await fetch(`/api/skill/v1/scales${query}`, {
        headers: { Authorization: `Bearer ${skillToken}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(payload.scales)) {
        return payload.scales as ScaleDefinition[];
      }
    } catch {
      // Keep the existing public catalog path available when the skill session is not reachable.
    }
  }

  const response = await fetch(`/api/scales${query}`);
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload.scales) ? (payload.scales as ScaleDefinition[]) : [];
}

function isParentSelfScale(scale: ScaleDefinition) {
  if (PARENT_SELF_BLOCKED_SCALE_IDS.has(scale.id.toUpperCase())) {
    return false;
  }

  if (scale.interactionMode === 'web_handoff') {
    return false;
  }

  return scale.isPediatric || scale.productGroup === 'clinical_child' || scale.category === 'Child Development';
}

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
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
      <button
        type="button"
        onClick={() => onChange('zh')}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          language === 'zh' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        中
      </button>
      <button
        type="button"
        onClick={() => onChange('en')}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          language === 'en' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        EN
      </button>
    </div>
  );
}

export default function RootHomeRouter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [resolvedView, setResolvedView] = useState<ResolvedRootHomeView | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(ROOT_HOME_MOBILE_MEDIA_QUERY);

    const updateResolvedView = () => {
      const queryView = searchParams.get('view');
      const queryMode = normalizeRootHomeViewMode(queryView);

      try {
        if (queryView !== null && queryMode !== 'auto') {
          window.localStorage.setItem(ROOT_HOME_VIEW_STORAGE_KEY, queryMode);
        } else if (queryView === 'auto') {
          window.localStorage.setItem(ROOT_HOME_VIEW_STORAGE_KEY, 'auto');
        }
      } catch {
        // localStorage can be blocked in private or embedded browser modes.
      }

      let storedView: string | null = null;
      try {
        storedView = window.localStorage.getItem(ROOT_HOME_VIEW_STORAGE_KEY);
      } catch {
        storedView = null;
      }

      setResolvedView(
        resolveRootHomeView({
          queryView,
          storedView,
          isMobileViewport: mediaQuery.matches,
        })
      );
    };

    updateResolvedView();
    mediaQuery.addEventListener('change', updateResolvedView);
    return () => mediaQuery.removeEventListener('change', updateResolvedView);
  }, [searchParams]);

  const setRootView = useCallback(
    (view: ResolvedRootHomeView) => {
      try {
        window.localStorage.setItem(ROOT_HOME_VIEW_STORAGE_KEY, view);
      } catch {
        // localStorage can be blocked in private or embedded browser modes.
      }

      setResolvedView(view);
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('view', view);
      const query = nextParams.toString();
      router.replace(query ? `/?${query}` : '/', { scroll: false });
    },
    [router, searchParams]
  );

  if (!resolvedView) {
    return <div className="min-h-screen bg-background" aria-hidden="true" />;
  }

  return resolvedView === 'mobile' ? (
    <MobileHome onSwitchToDesktop={() => setRootView('desktop')} />
  ) : (
    <DesktopHome onSwitchToMobile={() => setRootView('mobile')} />
  );
}

type MobileHomeTab = 'home' | 'scales' | 'history';

type MobileHistoryItem = {
  id: string;
  scaleId: string;
  scaleName: string;
  childName: string;
  completedAt: string;
  riskLabel?: string;
};

function MobileHome({ onSwitchToDesktop }: { onSwitchToDesktop: () => void }) {
  const router = useRouter();
  const { currentScale, setCurrentScale, resetAssessment } = useAssessment();
  const { user, loading: authLoading, isAuthenticated, isDoctor, logout } = useAuthSession();
  const { profile, profiles, selectProfile, isGuest } = useProfile();
  const { token: skillToken, loading: skillSessionLoading, error: skillSessionError } = useSkillSession();

  const [language, setLanguage] = useState<LanguageCode>('zh');
  const [activeTab, setActiveTab] = useState<MobileHomeTab>('home');
  const [selectedCategory, setSelectedCategory] = useState<ChildScaleCategoryKey>('all_child');
  const [searchQuery, setSearchQuery] = useState('');
  const [scales, setScales] = useState<ScaleDefinition[]>([]);
  const [scalesLoading, setScalesLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState<MobileHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const loadScaleLibrary = useCallback(async () => {
    return fetchChildScaleLibrary(skillToken);
  }, [skillToken]);

  useEffect(() => {
    let cancelled = false;
    setScalesLoading(true);

    loadScaleLibrary()
      .then((clinicalScales) => {
        if (!cancelled) {
          setScales(clinicalScales);
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
    if (activeTab !== 'history' || !isAuthenticated || isDoctor) {
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);

    fetch(`/api/assessment/history?profileId=${encodeURIComponent(profile.id)}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(payload.history)) {
          return [];
        }
        return payload.history as MobileHistoryItem[];
      })
      .then((items) => {
        if (!cancelled) {
          setHistoryItems(items.slice(0, 5));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, isAuthenticated, isDoctor, profile.id]);

  const filteredMobileScales = useMemo(() => {
    return scales.filter((scale) => {
      if (!isParentSelfScale(scale)) {
        return false;
      }

      if (selectedCategory === 'child_development' && scale.category !== 'Child Development') {
        return false;
      }

      if (
        selectedCategory === 'child_clinical' &&
        (scale.category === 'Child Development' || scale.productGroup !== 'clinical_child')
      ) {
        return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        return true;
      }

      const title = resolveLocalizedText(scale.title, language);
      const description = resolveLocalizedText(scale.description, language);
      return [scale.id, title, description, ...(scale.tags ?? [])].join(' ').toLowerCase().includes(q);
    });
  }, [language, scales, searchQuery, selectedCategory]);

  const featuredScales = useMemo(() => filteredMobileScales.slice(0, 4), [filteredMobileScales]);
  const activeScaleList = activeTab === 'home' ? featuredScales : filteredMobileScales;
  const identityLabel = isDoctor
    ? user?.doctorProfile?.realName || user?.email || '医生账号'
    : profile.nickname;

  const goToPatientLogin = useCallback(() => {
    if (isAuthenticated && isDoctor) {
      logout();
    }
    router.push('/auth/login');
  }, [isAuthenticated, isDoctor, logout, router]);

  const goToDoctorEntry = useCallback(() => {
    router.push(isAuthenticated && isDoctor ? '/doctor' : '/doctor/login');
  }, [isAuthenticated, isDoctor, router]);

  const renderScaleCard = (scale: ScaleDefinition) => {
    const cardConfig = getScaleCardConfig(scale.id);
    const localizedTitle = resolveLocalizedText(scale.title, language);
    const localizedDescription = resolveLocalizedText(scale.description, language);
    const estimatedTime = getEstimatedTime(scale.questions.length, scale.estimatedMinutes);

    return (
      <button
        key={scale.id}
        type="button"
        onClick={() => setCurrentScale(scale)}
        className="w-full rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${cardConfig?.bgColor || 'bg-slate-100'}`}>
            {cardConfig?.icon || <ClipboardList className="h-6 w-6 text-slate-500" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-black text-slate-950">{scale.id}</div>
                <div className="mt-0.5 truncate text-sm font-semibold text-slate-700">{localizedTitle}</div>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                {estimatedTime}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{localizedDescription}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white">
              <span>开始自测</span>
              <Mic className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </button>
    );
  };

  if (currentScale) {
    return (
      <div data-root-home-view="mobile" className="min-h-dvh bg-[#f6fbf9] text-slate-950">
        <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[430px] items-center gap-3">
            <button
              type="button"
              onClick={resetAssessment}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
              aria-label="返回手机版首页"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-slate-950">
                {resolveLocalizedText(currentScale.title, language)}
              </div>
              <div className="text-xs font-semibold text-slate-500">手机版自测</div>
            </div>
            <button
              type="button"
              onClick={onSwitchToDesktop}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
            >
              <Monitor className="h-4 w-4" />
              电脑版
            </button>
          </div>
        </nav>
        <main className="mx-auto max-w-[430px] px-3 py-4">
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
    <div data-root-home-view="mobile" className="min-h-dvh bg-[#f6fbf9] pb-24 text-slate-950">
      <div className="mx-auto min-h-dvh max-w-[430px] px-4 pt-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-sm font-black text-indigo-600">
              <Sparkles className="h-4 w-4" />
              智伴童行 H5
            </div>
            <h1 className="mt-3 text-[34px] font-black leading-tight tracking-normal text-slate-950">
              我的健康筛查空间
            </h1>
            <p className="mt-3 max-w-[320px] text-base leading-7 text-slate-500">
              家长和患者优先进入自测；医生工作台保留为专业入口。
            </p>
          </div>
          <button
            type="button"
            onClick={onSwitchToDesktop}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm"
          >
            <Monitor className="h-4 w-4" />
            电脑版
          </button>
        </header>

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          {isDoctor ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Stethoscope className="h-7 w-7" />
                </div>
                <div>
                  <div className="text-xl font-black">{identityLabel}</div>
                  <div className="text-sm font-semibold text-slate-500">医生账号已登录</div>
                </div>
              </div>
              <button
                type="button"
                onClick={goToDoctorEntry}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-base font-black text-white"
              >
                <Stethoscope className="h-5 w-5" />
                进入医生工作台
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="rounded-2xl bg-indigo-50 p-1.5">
                    <Avatar nickname={profile.nickname} className="h-16 w-16 rounded-xl" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white bg-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-2xl font-black">{profile.nickname}</h2>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-600">
                      {isGuest ? '游客' : '已登录'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    默认从适合家长自评的量表开始，必要时再绑定医生。
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-500">家庭成员</span>
                  <select
                    value={profile.id}
                    onChange={(event) => selectProfile(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-black outline-none"
                  >
                    {profiles.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.nickname}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setIsOnboardingOpen(true)}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-base font-black text-slate-950"
                >
                  <UserPlus className="h-5 w-5" />
                  新增成员
                </button>
              </div>

              {!authLoading && !isAuthenticated ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={goToPatientLogin}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                  >
                    患者登录
                  </button>
                  <Link
                    href="/auth/register"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-950"
                  >
                    注册账号
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {!isDoctor ? (
          <section className="mt-5 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('scales')}
              className="rounded-[22px] border border-emerald-100 bg-emerald-50 p-4 text-left"
            >
              <ClipboardList className="mb-3 h-6 w-6 text-emerald-600" />
              <div className="text-sm font-black text-slate-950">开始自测</div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="rounded-[22px] border border-indigo-100 bg-indigo-50 p-4 text-left"
            >
              <History className="mb-3 h-6 w-6 text-indigo-600" />
              <div className="text-sm font-black text-slate-950">历史记录</div>
            </button>
            <button
              type="button"
              onClick={goToDoctorEntry}
              className="rounded-[22px] border border-amber-100 bg-amber-50 p-4 text-left"
            >
              <Stethoscope className="mb-3 h-6 w-6 text-amber-600" />
              <div className="text-sm font-black text-slate-950">医生入口</div>
            </button>
          </section>
        ) : null}

        {!isDoctor && activeTab !== 'history' ? (
          <section className="mt-7">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  {activeTab === 'home' ? '推荐自测' : '全部自测量表'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">仅展示适合家长/患者自评的量表。</p>
              </div>
              <LanguageSwitcher language={language} onChange={setLanguage} />
            </div>

            {activeTab === 'scales' ? (
              <div className="mb-4 space-y-3">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索量表名称或标签"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none"
                />
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {CATEGORY_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedCategory(tab.key)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${
                        selectedCategory === tab.key ? 'bg-slate-950 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      {tab.labels[language]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {skillSessionError ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                自测会话暂未就绪：{skillSessionError}
              </div>
            ) : null}

            <div className="space-y-3">
              {scalesLoading || skillSessionLoading ? (
                [0, 1, 2].map((item) => (
                  <div key={item} className="h-32 animate-pulse rounded-[22px] border border-slate-200 bg-white" />
                ))
              ) : (
                activeScaleList.map(renderScaleCard)
              )}
            </div>

            {!scalesLoading && !skillSessionLoading && activeScaleList.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-white p-5 text-center text-sm leading-6 text-slate-500">
                暂时没有符合条件的自测量表，请调整筛选或稍后再试。
              </div>
            ) : null}

            {activeTab === 'home' && filteredMobileScales.length > featuredScales.length ? (
              <button
                type="button"
                onClick={() => setActiveTab('scales')}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                查看全部量表
                <FileText className="h-4 w-4" />
              </button>
            ) : null}
          </section>
        ) : null}

        {!isDoctor && activeTab === 'history' ? (
          <section className="mt-7">
            <h2 className="text-xl font-black text-slate-950">历史记录</h2>
            <p className="mt-1 text-sm text-slate-500">仅显示当前账号和当前成员的已保存记录。</p>

            {!isAuthenticated ? (
              <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-5 text-center">
                <UserRound className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                <p className="text-sm leading-6 text-slate-500">登录后可以查看正式保存的历史记录。</p>
                <button
                  type="button"
                  onClick={goToPatientLogin}
                  className="mt-4 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
                >
                  患者登录
                </button>
              </div>
            ) : historyLoading ? (
              <div className="mt-4 h-32 animate-pulse rounded-[22px] border border-slate-200 bg-white" />
            ) : historyItems.length > 0 ? (
              <div className="mt-4 space-y-3">
                {historyItems.map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-black text-slate-950">{item.scaleName}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.childName}</div>
                      </div>
                      {item.riskLabel ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                          {item.riskLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 text-xs font-semibold text-slate-400">
                      {new Date(item.completedAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[22px] border border-dashed border-slate-300 bg-white p-5 text-center text-sm leading-6 text-slate-500">
                当前成员还没有正式保存的评估记录。
              </div>
            )}
          </section>
        ) : null}
      </div>

      {!isDoctor ? (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
          <div className="mx-auto grid max-w-[430px] grid-cols-3 gap-2">
            {[
              { key: 'home' as const, label: '首页', Icon: UserRound },
              { key: 'scales' as const, label: '自测', Icon: ClipboardList },
              { key: 'history' as const, label: '记录', Icon: History },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-black ${
                  activeTab === key ? 'bg-slate-950 text-white' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </nav>
      ) : null}

      <AccountOnboardingModal
        open={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        reason="manual"
      />
    </div>
  );
}

function DesktopHome({ onSwitchToMobile }: { onSwitchToMobile?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentScale, setCurrentScale, resetAssessment } = useAssessment();
  const { user, loading: authLoading, isAuthenticated, isDoctor, logout } = useAuthSession();
  const { profile, profiles, selectProfile, isGuest } = useProfile();
  const { token: skillToken, loading: skillSessionLoading } = useSkillSession();

  const [language, setLanguage] = useState<LanguageCode>('zh');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ChildScaleCategoryKey>('all_child');
  const [homeSection, setHomeSection] = useState<'clinical' | 'growth'>('clinical');
  const [scales, setScales] = useState<ScaleDefinition[]>([]);
  const [scalesLoading, setScalesLoading] = useState(true);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const loadScaleLibrary = useCallback(async () => {
    return fetchChildScaleLibrary(skillToken);
  }, [skillToken]);

  useEffect(() => {
    let cancelled = false;
    setScalesLoading(true);

    loadScaleLibrary()
      .then((clinicalScales) => {
        if (!cancelled) {
          setScales(clinicalScales);
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
      if (selectedCategory === 'child_development' && scale.category !== 'Child Development') {
        return false;
      }

      if (
        selectedCategory === 'child_clinical' &&
        (scale.category === 'Child Development' || scale.productGroup !== 'clinical_child')
      ) {
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
      <div data-root-home-view="desktop" className="min-h-screen bg-background">
        <nav className="sticky top-0 z-10 flex items-center border-b border-border bg-card px-6 py-4">
          <button onClick={resetAssessment} className="group flex items-center text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="mr-2 h-5 w-5 transition-transform group-hover:-translate-x-1" />
            <span className="text-sm font-medium">返回量表大厅</span>
          </button>
          <div className="ml-8 h-4 w-px bg-border" />
          <div className="ml-4 flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cardConfig?.bgColor || 'bg-muted'}`}>
              {cardConfig?.icon || <Sparkles className="h-4 w-4 text-muted-foreground" />}
            </div>
            <span className="font-semibold text-foreground">{resolveLocalizedText(currentScale.title, language)}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {onSwitchToMobile ? (
              <button
                type="button"
                onClick={onSwitchToMobile}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted md:hidden"
              >
                <Smartphone className="h-4 w-4" />
                <span>手机版</span>
              </button>
            ) : null}
            <LanguageSwitcher language={language} onChange={setLanguage} />
            <ThemeSwitcher />
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
    <div data-root-home-view="desktop" className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <header className="relative z-50 mx-auto flex w-full max-w-[1400px] flex-col justify-between gap-4 px-6 py-5 md:flex-row md:items-center md:py-6">
        <div>
          <div className="mb-1.5 inline-flex items-center text-xs font-bold tracking-wider text-primary">
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            AI 临床辅助评估系统 · BYOK 模式
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
            {isDoctor ? '医生工作入口' : profile.relation === 'self' ? '我的健康筛查空间' : `${profile.nickname} 的健康档案`}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {isDoctor
              ? '当前登录的是医生账号，患者侧模块已自动切换为医生视角。'
              : isGuest
                ? '游客模式可先体验筛查；注册后解锁多成员与更多能力。'
                : '正式账号可管理多成员档案、绑定医生和智能体入口。'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 self-end md:self-auto">
          {onSwitchToMobile ? (
            <button
              type="button"
              onClick={onSwitchToMobile}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted md:hidden"
            >
              <Smartphone className="h-4 w-4" />
              <span>手机版</span>
            </button>
          ) : null}
          {!authLoading && isAuthenticated && isDoctor ? (
            <Link
              href="/doctor"
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
            >
              进入医生后台
            </Link>
          ) : null}
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => goToLogin('PATIENT')}
              className="rounded-full px-3 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              患者登录
            </button>
            <button
              type="button"
              onClick={() => goToLogin('DOCTOR')}
              className="rounded-full px-3 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
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
              <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
                <Avatar nickname={profile.nickname} className="h-6 w-6" />
                <span className="hidden text-sm font-medium text-foreground sm:inline">{identityLabel}</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                <span>退出登录</span>
              </button>
            </>
          ) : null}
          <LanguageSwitcher language={language} onChange={setLanguage} />
          <ThemeSwitcher />
          <SettingsButton />
        </div>
      </header>

      {!isDoctor ? (
        <>
          <div className="relative z-10 mx-auto mb-6 w-full max-w-[1400px] px-4 md:px-6">
            <div className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="rounded-2xl bg-primary/10 p-1.5">
                      <Avatar nickname={profile.nickname} className="h-16 w-16 shrink-0 rounded-xl" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-foreground">{profile.nickname}</h2>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {isGuest ? '游客' : '已认证'}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
                      默认从量表大厅开始，按需绑定医生、进入医生智能体，或继续使用自助智能体。
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/50 px-4 py-2.5">
                    <span className="text-xs font-medium text-muted-foreground">家庭成员</span>
                    <select
                      value={profile.id}
                      onChange={(event) => selectProfile(event.target.value)}
                      className="min-w-[120px] rounded-lg border-0 bg-transparent py-0 text-sm font-semibold text-foreground outline-none"
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
                    className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
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
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/5 to-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Doctor Mode</div>
                <h2 className="mt-2 text-2xl font-bold text-foreground">{user?.doctorProfile?.realName || user?.email || '医生账号'}</h2>
                <p className="mt-2 text-sm text-muted-foreground">患者大厅模块已折叠，请从医生工作台进入患者管理、AI 分身和邀请功能。</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/doctor" className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:bg-primary">
                  进入医生工作台
                </Link>
                <Link href="/doctor/invites" className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
                  打开医生邀请
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-4 pb-16 md:px-6 md:pb-24">
        <div className="mb-6 rounded-3xl border border-border bg-card p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setHomeSection('clinical')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                homeSection === 'clinical' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              临床量表
            </button>
            <button
              type="button"
              onClick={() => setHomeSection('growth')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                homeSection === 'growth' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              生长曲线
            </button>
          </div>
        </div>

        {homeSection === 'clinical' ? (
          <>
            {isGuest ? (
              <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900 shadow-sm">
                游客自测结果仅供参考，不具有医疗法律效应；如涉及临床判断，请由医生或专业评估人员进一步确认。
              </div>
            ) : null}

            <div className="mb-6 rounded-3xl border border-border bg-card p-4 shadow-sm md:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索量表名称、标签或关键字"
                    className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:bg-card"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedCategory(tab.key)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        selectedCategory === tab.key ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
                    className="group relative flex h-full cursor-pointer flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
                  >
                    {cardConfig?.tag ? (
                      <span className="absolute right-4 top-4 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary md:text-xs">
                        {cardConfig.tag}
                      </span>
                    ) : null}

                    <div className="mb-4 flex items-center gap-3 pr-12">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cardConfig?.bgColor || 'bg-muted'} shadow-sm transition-all duration-300 group-hover:bg-gradient-to-br ${cardConfig?.gradient || 'from-primary to-primary/80'} group-hover:text-white`}>
                        {cardConfig?.icon || <Sparkles className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold leading-tight text-foreground transition-colors group-hover:text-primary md:text-xl">
                          {scale.id}
                        </h3>
                        <p className="mt-0.5 w-32 truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground md:text-xs">
                          {localizedTitle}
                        </p>
                      </div>
                    </div>

                    <p className="mb-6 flex-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{localizedDescription}</p>

                    <div className="mt-auto flex flex-col gap-3">
                      <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
                        <span>{scale.questions.length} 题</span>
                        <span>{estimatedTime}</span>
                      </div>
                      <button className="flex w-full items-center justify-center space-x-2 rounded-xl bg-foreground py-2.5 text-background transition-all hover:bg-primary hover:shadow-md group-hover:bg-primary active:scale-95 md:py-3">
                        <span className="text-sm font-bold md:text-base">开始评估</span>
                        <Mic className="h-4 w-4 md:h-5 md:w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {!scalesLoading && !skillSessionLoading && filteredScales.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                暂时没有符合条件的量表，请调整搜索或筛选条件。
              </div>
            ) : null}
          </>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Growth Tracking</div>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">新生儿生长曲线追踪</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                    在同一视图中查看胎龄 24-42 周的体重、身长、头围常模百分位，并叠加宝宝自己的历史轨迹与最新记录。
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                  支持男 / 女切换、三围切换、动态录入与即时摘要
                </div>
              </div>
            </div>

            <NewbornGrowthTracker />
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
