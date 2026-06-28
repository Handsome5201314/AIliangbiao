'use client'

import { useState, useEffect, useCallback } from 'react'
import { Home, Users, ClipboardList, Clock } from 'lucide-react'
import type {
  ScreenId,
  ScreenParams,
  Child,
  Scale,
  Question,
  Report,
  HistoryRecord,
  DoctorPatient,
  DoctorStats,
  DoctorHistoryRecord,
  TemporaryPatient,
  Answer,
  AuthUser,
} from '@/components/mobile-h5/types'
import {
  getChildren,
  getScales,
  getQuestions,
  getReport,
  getHistory,
  getDoctorPatients,
  getDoctorStats,
  getDoctorHistory,
  createTemporaryPatient,
  createClinicAssessment,
  enterCaregiverHandoff,
  submitAnswers,
} from '@/components/mobile-h5/services/assessmentService'
import { Button } from '@/components/mobile-h5/components/ui/button'

// Auth
import { AuthSessionProvider, useAuthSession } from '@/components/mobile-h5/contexts/AuthContext'

// Screens
import HomeScreen from '@/components/mobile-h5/screens/patient/HomeScreen'
import ChildrenScreen from '@/components/mobile-h5/screens/patient/ChildrenScreen'
import ScalesScreen from '@/components/mobile-h5/screens/patient/ScalesScreen'
import AssessmentIntroScreen from '@/components/mobile-h5/screens/patient/AssessmentIntroScreen'
import ReportScreen from '@/components/mobile-h5/screens/patient/ReportScreen'
import HistoryScreen from '@/components/mobile-h5/screens/patient/HistoryScreen'
import DoctorHomeScreen from '@/components/mobile-h5/screens/doctor/DoctorHomeScreen'
import DoctorPatientPickerScreen from '@/components/mobile-h5/screens/doctor/DoctorPatientPickerScreen'
import TemporaryPatientFormScreen from '@/components/mobile-h5/screens/doctor/TemporaryPatientFormScreen'
import DoctorScalePickerScreen from '@/components/mobile-h5/screens/doctor/DoctorScalePickerScreen'
import FillModeSelectorScreen from '@/components/mobile-h5/screens/doctor/FillModeSelectorScreen'
import DoctorAssistedRunnerScreen from '@/components/mobile-h5/screens/doctor/DoctorAssistedRunnerScreen'
import CaregiverLockedRunnerScreen from '@/components/mobile-h5/screens/doctor/CaregiverLockedRunnerScreen'
import CaregiverCompleteScreen from '@/components/mobile-h5/screens/doctor/CaregiverCompleteScreen'
import DoctorReauthScreen from '@/components/mobile-h5/screens/doctor/DoctorReauthScreen'
import DoctorReportScreen from '@/components/mobile-h5/screens/doctor/DoctorReportScreen'

// Auth screens
import LoginScreen from '@/components/mobile-h5/screens/auth/LoginScreen'
import RoleSelectScreen from '@/components/mobile-h5/screens/auth/RoleSelectScreen'
import DoctorPinLoginScreen from '@/components/mobile-h5/screens/auth/DoctorPinLoginScreen'
import LockScreen from '@/components/mobile-h5/screens/auth/LockScreen'

// AI Components
import AiAssistantFab from '@/components/mobile-h5/screens/ai/AiAssistantFab'
import AiAssistantDrawer from '@/components/mobile-h5/screens/ai/AiAssistantDrawer'

// Shared
import AssessmentRunner from '@/components/mobile-h5/screens/shared/AssessmentRunner'

/* Tab screens that show bottom nav */
const TAB_SCREENS: ScreenId[] = ['home', 'children', 'scales', 'history']
const TAB_ITEMS = [
  { id: 'home' as ScreenId, label: '首页', icon: Home },
  { id: 'children' as ScreenId, label: '孩子', icon: Users },
  { id: 'scales' as ScreenId, label: '测评', icon: ClipboardList },
  { id: 'history' as ScreenId, label: '历史', icon: Clock },
]

/* Screens that show AI fab */
const AI_FAB_SCREENS: ScreenId[] = ['questionnaire', 'doctor-assisted-runner']

/* Screens that are auth-exempt (auth screens themselves) */
const AUTH_SCREENS: ScreenId[] = ['login', 'role-select', 'doctor-pin-login', 'lock']

/* Doctor-only screens */
const DOCTOR_SCREENS: ScreenId[] = [
  'doctor-home', 'doctor-patient-picker', 'doctor-temp-patient',
  'doctor-scale-picker', 'doctor-fill-mode', 'doctor-assisted-runner',
  'caregiver-locked-runner', 'caregiver-complete', 'doctor-reauth', 'doctor-report',
]

/* Patient-only screens */
const PATIENT_SCREENS: ScreenId[] = [
  'home', 'children', 'scales', 'assessment-intro', 'questionnaire', 'report', 'history',
]

type MobileH5AppProps = {
  onSwitchToDesktop?: () => void
}

// ─── Inner app (uses auth context) ─────────────────────────────────────────────

function AppInner({ onSwitchToDesktop }: MobileH5AppProps) {
  const auth = useAuthSession()

  // ---- Mode ----
  const [appMode, setAppMode] = useState<'patient' | 'doctor'>('patient')
  // Track if role selection is needed after login
  const [pendingRoleSelect, setPendingRoleSelect] = useState(false)

  // ---- Navigation ----
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home')
  const [params, setParams] = useState<ScreenParams>({})

  // ---- Patient data ----
  const [children, setChildren] = useState<Child[]>([])
  const [scales, setScales] = useState<Scale[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [selectedScale, setSelectedScale] = useState<Scale | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [history, setHistory] = useState<HistoryRecord[]>([])

  // ---- Doctor data ----
  const [doctorPatients, setDoctorPatients] = useState<DoctorPatient[]>([])
  const [doctorStats, setDoctorStats] = useState<DoctorStats>({ todayCount: 0, monthCount: 0 })
  const [doctorHistory, setDoctorHistory] = useState<DoctorHistoryRecord[]>([])
  const [selectedPatient, setSelectedPatient] = useState<DoctorPatient | null>(null)
  const [selectedFillMode, setSelectedFillMode] = useState<'doctor_assisted' | 'caregiver_handoff_locked'>('doctor_assisted')
  const [activeClinicSessionId, setActiveClinicSessionId] = useState<string | null>(null)

  // ---- AI state ----
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [aiQuestionId, setAiQuestionId] = useState('q1')
  const [aiQuestionNumber, setAiQuestionNumber] = useState(1)
  const [aiQuestionText, setAiQuestionText] = useState('')

  // ---- Loading ----
  const [dataLoading, setDataLoading] = useState(false)

  const navigate = useCallback((screen: ScreenId, newParams?: ScreenParams) => {
    setCurrentScreen(screen)
    if (newParams) setParams(prev => ({ ...prev, ...newParams }))
  }, [])

  // ---- Load data after authentication ----
  useEffect(() => {
    if (!auth.isAuthenticated || auth.loading) return

    // Set initial mode based on user role
    if (auth.isDoctor && !auth.isPatient) {
      setAppMode('doctor')
    } else if (auth.isPatient && !auth.isDoctor) {
      setAppMode('patient')
    }
    // If both roles, keep current mode (or wait for role selection)

    async function init() {
      setDataLoading(true)
      try {
        const promises: Promise<any>[] = []
        if (auth.isPatient) {
          promises.push(
            getChildren(auth.authHeaders),
            getScales({ audience: auth.isDoctor && !auth.isPatient ? 'doctor' : 'parent_self' }),
            getHistory(undefined, auth.authHeaders),
          )
        } else {
          promises.push(Promise.resolve([]), getScales({ audience: 'doctor' }), Promise.resolve([]))
        }
        if (auth.isDoctor) {
          promises.push(
            getDoctorPatients(auth.authHeaders),
            getDoctorStats(auth.authHeaders),
            getDoctorHistory(auth.authHeaders)
          )
        } else {
          promises.push(Promise.resolve([]), Promise.resolve({ todayCount: 0, monthCount: 0 }), Promise.resolve([]))
        }

        const [childData, scaleData, histData, patients, stats, docHist] = await Promise.all(promises)
        setChildren(childData)
        setScales(scaleData)
        setHistory(histData)
        setDoctorPatients(patients)
        setDoctorStats(stats)
        setDoctorHistory(docHist)
        if (childData.length > 0) setSelectedChildId(childData[0].id)
      } catch (e) {
        console.error('Init failed:', e)
      } finally {
        setDataLoading(false)
      }
    }
    init()
  }, [auth.isAuthenticated, auth.loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Current child ----
  const currentChild = children.find(c => c.id === selectedChildId) || null

  // ---- Navigation handlers ----
  const handleSelectScale = async (scale: Scale) => {
    setSelectedScale(scale)
    const qs = await getQuestions(scale.id)
    setQuestions(qs)
    if (appMode === 'patient') {
      navigate('assessment-intro')
    }
  }

  const handleStartAssessment = () => {
    navigate('questionnaire')
  }

  const handleCompleteQuestionnaire = async (answers: Record<string, Answer>) => {
    if (!selectedScale) return
    const sessionId = appMode === 'doctor' && activeClinicSessionId
      ? activeClinicSessionId
      : globalThis.crypto.randomUUID()
    const result = await submitAnswers(sessionId, answers, auth.authHeaders, {
      scaleId: selectedScale.id,
      childId: appMode === 'patient' ? selectedChildId : selectedPatient?.id,
      childName: appMode === 'patient' ? currentChild?.name : selectedPatient?.name,
      serverSessionId: appMode === 'doctor' ? activeClinicSessionId : null,
    })
    const rpt = await getReport(result.reportId, auth.authHeaders)
    setReport(rpt)
    if (appMode === 'patient') {
      navigate('report', { reportEntrySource: 'just-submitted' })
    } else if (selectedFillMode === 'doctor_assisted') {
      navigate('doctor-report', { reportEntrySource: 'just-submitted' })
    } else {
      navigate('caregiver-complete')
    }
  }

  const handleViewReport = async (sessionId: string) => {
    const rpt = await getReport(sessionId, auth.authHeaders)
    setReport(rpt)
    navigate('report', { reportEntrySource: 'history' })
  }

  // Doctor handlers
  const handleSelectPatient = (patient: DoctorPatient) => {
    setSelectedPatient(patient)
    setActiveClinicSessionId(null)
    navigate('doctor-scale-picker')
  }

  const handleCreateTempPatient = async (data: TemporaryPatient) => {
    const newPatient = await createTemporaryPatient(data, auth.authHeaders)
    setDoctorPatients(prev => [newPatient, ...prev])
    setSelectedPatient(newPatient)
    setActiveClinicSessionId(null)
    navigate('doctor-scale-picker')
  }

  const handleSelectDoctorScale = (scale: Scale) => {
    setSelectedScale(scale)
    setActiveClinicSessionId(null)
    getQuestions(scale.id).then(qs => {
      setQuestions(qs)
      navigate('doctor-fill-mode')
    })
  }

  const handleSelectFillMode = async (mode: 'doctor_assisted' | 'caregiver_handoff_locked') => {
    if (!selectedPatient || !selectedScale) return
    setSelectedFillMode(mode)
    const session = await createClinicAssessment(
      selectedPatient.id,
      selectedScale.id,
      mode,
      auth.authHeaders,
    )
    setActiveClinicSessionId(session.sessionId)
    if (mode === 'doctor_assisted') {
      navigate('doctor-assisted-runner')
    } else {
      await enterCaregiverHandoff(session.sessionId, auth.authHeaders)
      navigate('caregiver-locked-runner')
    }
  }

  const handleDoctorViewReport = async (sessionId?: string) => {
    const rpt = report || (sessionId ? await getReport(sessionId, auth.authHeaders) : null)
    if (!rpt) return
    setReport(rpt)
    navigate('doctor-report')
  }

  // AI handler
  function handleOpenAi(question?: Question, questionNumber?: number) {
    const activeQuestion = question || questions[0]
    if (activeQuestion) {
      const resolvedQuestionNumber =
        questionNumber || questions.findIndex((item) => item.id === activeQuestion.id) + 1 || 1
      setAiQuestionId(activeQuestion.id)
      setAiQuestionNumber(resolvedQuestionNumber)
      setAiQuestionText(activeQuestion.text)
    }
    setAiDrawerOpen(true)
  }

  // ---- Auth handlers ----
  const handleLoginSuccess = useCallback((token: string, user: AuthUser) => {
    auth.login(token, user)
    // If user has both roles, show role selection
    if (user.isDoctor && user.isPatient) {
      setPendingRoleSelect(true)
      navigate('role-select')
    } else if (user.isDoctor) {
      setAppMode('doctor')
      navigate('doctor-home')
    } else {
      setAppMode('patient')
      navigate('home')
    }
  }, [auth, navigate])

  const handleGuestLogin = useCallback(async () => {
    await auth.loginAsGuest()
    setAppMode('patient')
    navigate('home')
  }, [auth, navigate])

  const handleSelectRole = useCallback((role: 'patient' | 'doctor') => {
    setPendingRoleSelect(false)
    setAppMode(role)
    if (role === 'doctor') {
      navigate('doctor-home')
    } else {
      navigate('home')
    }
  }, [navigate])

  const handleLogout = useCallback(() => {
    auth.logout()
    setAppMode('patient')
    navigate('login')
    // Reset all data
    setChildren([])
    setScales([])
    setHistory([])
    setDoctorPatients([])
    setDoctorStats({ todayCount: 0, monthCount: 0 })
    setDoctorHistory([])
    setReport(null)
    setSelectedPatient(null)
    setSelectedScale(null)
  }, [auth, navigate])

  const handleSwitchMode = useCallback((mode: 'patient' | 'doctor') => {
    setAppMode(mode)
    getScales({ audience: mode === 'doctor' ? 'doctor' : 'parent_self' })
      .then(setScales)
      .catch((error) => console.error('Load scales failed:', error))
    if (mode === 'patient') {
      navigate('home')
    } else {
      navigate('doctor-home')
    }
  }, [navigate])

  // ---- Render screen ----
  const renderScreen = () => {
    // Auth loading
    if (auth.loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-sage-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted">加载中...</span>
          </div>
        </div>
      )
    }

    // Not authenticated → show login
    if (!auth.isAuthenticated) {
      return (
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onGuestLogin={handleGuestLogin}
        />
      )
    }

    // Data loading
    if (dataLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-sage-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted">加载中...</span>
          </div>
        </div>
      )
    }

    switch (currentScreen) {
      // ===== Auth screens =====
      case 'login':
        return (
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onGuestLogin={handleGuestLogin}
          />
        )
      case 'role-select':
        return (
          <RoleSelectScreen
            userName={auth.user?.name || '用户'}
            onSelectRole={handleSelectRole}
          />
        )
      case 'doctor-pin-login':
        return (
          <DoctorPinLoginScreen
            doctorName={auth.user?.name || '医生'}
            onUnlock={() => navigate('doctor-home')}
            onLogout={handleLogout}
          />
        )
      case 'lock':
        return null // Lock screen is rendered as overlay

      // ===== Patient screens =====
      case 'home':
        return (
          <HomeScreen
            currentChild={currentChild}
            onSelectChild={() => navigate('children')}
            onStartAssessment={() => navigate('scales')}
            onViewHistory={() => navigate('history')}
            onOpenAi={handleOpenAi}
          />
        )
      case 'children':
        return (
          <ChildrenScreen
            children={children}
            selectedChildId={selectedChildId}
            onSelectChild={(id) => { setSelectedChildId(id); navigate('home') }}
            onBack={() => navigate('home')}
          />
        )
      case 'scales':
        return (
          <ScalesScreen
            scales={scales}
            onSelectScale={handleSelectScale}
            onBack={() => navigate('home')}
          />
        )
      case 'assessment-intro':
        return selectedScale && currentChild ? (
          <AssessmentIntroScreen
            child={currentChild}
            scale={selectedScale}
            onStart={handleStartAssessment}
            onBack={() => navigate('scales')}
            onSwitchChild={() => navigate('children')}
          />
        ) : null
      case 'questionnaire':
        return selectedScale ? (
          <AssessmentRunner
            mode="parent_self"
            questions={questions}
            scale={selectedScale}
            patientInfo={{ name: currentChild?.name || '', ageLabel: currentChild?.ageLabel || '' }}
            onComplete={handleCompleteQuestionnaire}
            onBack={() => navigate('assessment-intro')}
            showAi={true}
            onOpenAi={handleOpenAi}
          />
        ) : null
      case 'report':
        return report ? (
          <ReportScreen
            report={report}
            onGoHome={() => navigate('home')}
            onViewHistory={() => navigate('history')}
            onBack={() => navigate('history')}
            fromHistory={params.reportEntrySource === 'history'}
          />
        ) : null
      case 'history':
        return (
          <HistoryScreen
            history={history}
            onViewReport={handleViewReport}
            onBack={() => navigate('home')}
          />
        )

      // ===== Doctor screens =====
      case 'doctor-home':
        return (
          <DoctorHomeScreen
            stats={doctorStats}
            recentHistory={doctorHistory}
            onStartAssessment={() => navigate('doctor-patient-picker')}
          />
        )
      case 'doctor-patient-picker':
        return (
          <DoctorPatientPickerScreen
            patients={doctorPatients}
            onSelectPatient={handleSelectPatient}
            onCreateTemp={() => navigate('doctor-temp-patient')}
            onBack={() => navigate('doctor-home')}
          />
        )
      case 'doctor-temp-patient':
        return (
          <TemporaryPatientFormScreen
            onSubmit={handleCreateTempPatient}
            onBack={() => navigate('doctor-patient-picker')}
          />
        )
      case 'doctor-scale-picker':
        return (
          <DoctorScalePickerScreen
            scales={scales}
            onSelectScale={handleSelectDoctorScale}
            onBack={() => navigate('doctor-patient-picker')}
          />
        )
      case 'doctor-fill-mode':
        return selectedScale && selectedPatient ? (
          <FillModeSelectorScreen
            onSelectMode={handleSelectFillMode}
            onBack={() => navigate('doctor-scale-picker')}
            patientName={selectedPatient.name}
            scaleName={selectedScale.name}
          />
        ) : null
      case 'doctor-assisted-runner':
        return selectedScale && selectedPatient ? (
          <DoctorAssistedRunnerScreen
            questions={questions}
            scale={selectedScale}
            patient={selectedPatient}
            onComplete={handleCompleteQuestionnaire}
            onBack={() => navigate('doctor-fill-mode')}
            onOpenAi={handleOpenAi}
          />
        ) : null
      case 'caregiver-locked-runner':
        return selectedScale ? (
          <CaregiverLockedRunnerScreen
            questions={questions}
            scale={selectedScale}
            onComplete={handleCompleteQuestionnaire}
          />
        ) : null
      case 'caregiver-complete':
        return (
          <CaregiverCompleteScreen
            onReturnToDoctor={() => navigate('doctor-reauth')}
          />
        )
      case 'doctor-reauth':
        return (
          <DoctorReauthScreen
            sessionId={activeClinicSessionId}
            authHeaders={auth.authHeaders}
            onVerifySuccess={() => {
              if (report) {
                navigate('doctor-report')
              } else {
                handleDoctorViewReport()
              }
            }}
          />
        )
      case 'doctor-report':
        return report && selectedPatient ? (
          <DoctorReportScreen
            report={report}
            patient={selectedPatient}
            onGoHome={() => { setReport(null); navigate('doctor-home') }}
            onNewAssessment={() => { setReport(null); navigate('doctor-patient-picker') }}
            onViewDetail={() => {}}
          />
        ) : null
      default:
        return null
    }
  }

  // ---- Visibility rules ----
  const isAuthScreen = AUTH_SCREENS.includes(currentScreen)
  const isDoctorScreen = DOCTOR_SCREENS.includes(currentScreen)
  const showBottomNav = auth.isAuthenticated && !isAuthScreen && appMode === 'patient' && TAB_SCREENS.includes(currentScreen)
  const showAiFab = auth.isAuthenticated && !isAuthScreen && AI_FAB_SCREENS.includes(currentScreen) && !aiDrawerOpen && currentScreen !== 'caregiver-locked-runner'

  // Mode switcher: only visible for dual-role users when not on auth screens
  const showModeSwitcher = auth.isAuthenticated && !isAuthScreen && auth.isDoctor && auth.isPatient
  // Guest users: show a restricted banner instead of full app
  const isGuest = auth.isGuest

  return (
    <div
      data-component="mobile-app"
      className="mobile-h5-theme w-full max-w-[480px] mx-auto h-[100dvh] flex flex-col bg-cream-100 relative overflow-hidden"
    >
      {onSwitchToDesktop && (
        <button
          type="button"
          data-component="desktop-view-switch"
          data-hide-in-locked
          onClick={onSwitchToDesktop}
          className="absolute right-3 z-30 rounded-pill bg-white/90 px-3 py-1.5 text-xs font-medium text-sage-700 shadow-sm ring-1 ring-cream-200 backdrop-blur transition-smooth hover:bg-white"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
        >
          电脑版
        </button>
      )}

      {/* Lock screen overlay */}
      {auth.isAuthenticated && auth.isLocked && (
        <LockScreen
          doctorName={auth.user?.name || '医生'}
          onUnlock={auth.unlockScreen}
          onLogout={handleLogout}
        />
      )}

      {/* Mode switcher — only for dual-role users */}
      {showModeSwitcher && (
        <div
          data-component="mode-switcher"
          className="flex-shrink-0 flex items-center justify-center py-2 px-5 safe-top"
          data-hide-in-locked
        >
          <div className="flex bg-cream-200 rounded-pill p-0.5">
            <Button
              variant="ghost"
              onClick={() => handleSwitchMode('patient')}
              className={`px-4 py-1.5 rounded-pill text-xs font-medium transition-smooth ${
                appMode === 'patient' ? 'bg-white text-foreground shadow-sm' : 'text-muted'
              }`}
            >
              家长端
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleSwitchMode('doctor')}
              className={`px-4 py-1.5 rounded-pill text-xs font-medium transition-smooth ${
                appMode === 'doctor' ? 'bg-white text-foreground shadow-sm' : 'text-muted'
              }`}
            >
              医生端
            </Button>
          </div>
        </div>
      )}

      {/* Single-role header — shows user info */}
      {auth.isAuthenticated && !isAuthScreen && !showModeSwitcher && (
        <div
          data-component="user-header"
          className="flex-shrink-0 flex items-center justify-between py-2 px-5 safe-top"
          data-hide-in-locked
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center">
              <span className="text-xs font-bold text-sage-600">
                {auth.user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <span className="text-xs text-muted">
              {auth.isGuest ? '游客模式' : auth.user?.name || ''}
              {auth.isDoctor && !auth.isPatient ? ' · 医生端' : ''}
              {auth.isPatient && !auth.isDoctor ? ' · 家长端' : ''}
            </span>
          </div>
          {!auth.isGuest && (
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-xs text-muted px-2 py-1 h-auto"
            >
              退出
            </Button>
          )}
        </div>
      )}

      {/* Guest banner */}
      {isGuest && auth.isAuthenticated && !isAuthScreen && (
        <div
          data-component="guest-banner"
          className="flex-shrink-0 bg-sage-50 border-b border-sage-200 px-5 py-2 flex items-center justify-between"
        >
          <span className="text-xs text-sage-700">注册后可保存测评记录并查看完整报告</span>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-xs text-sage-600 font-medium px-3 py-1 h-auto"
          >
            去注册
          </Button>
        </div>
      )}

      {/* Screen content */}
      <section
        data-component="screen-container"
        className="flex-1 overflow-hidden flex flex-col"
      >
        <article
          data-component="screen-content"
          className="flex-1 overflow-y-auto no-scrollbar"
        >
          {renderScreen()}
        </article>
      </section>

      {/* Bottom tab navigation */}
      {showBottomNav && !auth.isLocked && (
        <nav
          data-component="bottom-tab-nav"
          className="flex-shrink-0 bg-white border-t border-cream-200 safe-bottom"
        >
          <div className="flex items-center justify-around h-14">
            {TAB_ITEMS.map((tab) => {
              const Icon = tab.icon
              const isActive = currentScreen === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-touch transition-smooth ${
                    isActive ? 'text-sage-500' : 'text-muted'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                  <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      )}

      {/* AI floating action button */}
      {showAiFab && !auth.isLocked && (
        <AiAssistantFab onClick={handleOpenAi} visible={showAiFab} />
      )}

      {/* AI drawer overlay */}
      <AiAssistantDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        questionNumber={aiQuestionNumber}
        questionText={aiQuestionText}
        questionId={aiQuestionId}
        scaleId={selectedScale?.id || ''}
        mode={currentScreen === 'doctor-assisted-runner' ? 'doctor_assisted' : 'parent_self'}
      />
    </div>
  )
}

// ─── Root App (wraps with provider) ────────────────────────────────────────────

export default function MobileH5App({ onSwitchToDesktop }: MobileH5AppProps) {
  return (
    <AuthSessionProvider>
      <AppInner onSwitchToDesktop={onSwitchToDesktop} />
    </AuthSessionProvider>
  )
}
