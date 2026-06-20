import { useState, useEffect, useCallback } from 'react'
import { Home, Users, ClipboardList, Clock, ArrowLeft } from 'lucide-react'
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
} from '@/types'
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
  submitAnswers,
} from '@/services/assessmentService'
import { Button } from '@/components/ui/button'

// Screens
import HomeScreen from '@/screens/patient/HomeScreen'
import ChildrenScreen from '@/screens/patient/ChildrenScreen'
import ScalesScreen from '@/screens/patient/ScalesScreen'
import AssessmentIntroScreen from '@/screens/patient/AssessmentIntroScreen'
import ReportScreen from '@/screens/patient/ReportScreen'
import HistoryScreen from '@/screens/patient/HistoryScreen'
import DoctorHomeScreen from '@/screens/doctor/DoctorHomeScreen'
import DoctorPatientPickerScreen from '@/screens/doctor/DoctorPatientPickerScreen'
import TemporaryPatientFormScreen from '@/screens/doctor/TemporaryPatientFormScreen'
import DoctorScalePickerScreen from '@/screens/doctor/DoctorScalePickerScreen'
import FillModeSelectorScreen from '@/screens/doctor/FillModeSelectorScreen'
import DoctorAssistedRunnerScreen from '@/screens/doctor/DoctorAssistedRunnerScreen'
import CaregiverLockedRunnerScreen from '@/screens/doctor/CaregiverLockedRunnerScreen'
import CaregiverCompleteScreen from '@/screens/doctor/CaregiverCompleteScreen'
import DoctorReauthScreen from '@/screens/doctor/DoctorReauthScreen'
import DoctorReportScreen from '@/screens/doctor/DoctorReportScreen'

// AI Components
import AiAssistantFab from '@/screens/ai/AiAssistantFab'
import AiAssistantDrawer from '@/screens/ai/AiAssistantDrawer'

// Shared
import AssessmentRunner from '@/screens/shared/AssessmentRunner'

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

export default function App() {
  // ---- Mode ----
  const [appMode, setAppMode] = useState<'patient' | 'doctor'>('patient')

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

  // ---- AI state ----
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [aiQuestionId, setAiQuestionId] = useState('q1')
  const [aiQuestionNumber, setAiQuestionNumber] = useState(1)
  const [aiQuestionText, setAiQuestionText] = useState('')

  // ---- Loading ----
  const [loading, setLoading] = useState(true)

  const navigate = useCallback((screen: ScreenId, newParams?: ScreenParams) => {
    setCurrentScreen(screen)
    if (newParams) setParams(prev => ({ ...prev, ...newParams }))
  }, [])

  // ---- Load initial data ----
  useEffect(() => {
    async function init() {
      try {
        const [childData, scaleData, histData, patients, stats, docHist] = await Promise.all([
          getChildren(),
          getScales(),
          getHistory(),
          getDoctorPatients(),
          getDoctorStats(),
          getDoctorHistory(),
        ])
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
        setLoading(false)
      }
    }
    init()
  }, [])

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
    const result = await submitAnswers('session-mock', answers)
    const rpt = await getReport(result.sessionId)
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
    const rpt = await getReport(sessionId)
    setReport(rpt)
    navigate('report', { reportEntrySource: 'history' })
  }

  // Doctor handlers
  const handleSelectPatient = (patient: DoctorPatient) => {
    setSelectedPatient(patient)
    navigate('doctor-scale-picker')
  }

  const handleCreateTempPatient = async (data: TemporaryPatient) => {
    const newPatient = await createTemporaryPatient(data)
    setDoctorPatients(prev => [newPatient, ...prev])
    setSelectedPatient(newPatient)
    navigate('doctor-scale-picker')
  }

  const handleSelectDoctorScale = (scale: Scale) => {
    setSelectedScale(scale)
    getQuestions(scale.id).then(qs => {
      setQuestions(qs)
      navigate('doctor-fill-mode')
    })
  }

  const handleSelectFillMode = (mode: 'doctor_assisted' | 'caregiver_handoff_locked') => {
    setSelectedFillMode(mode)
    if (mode === 'doctor_assisted') {
      navigate('doctor-assisted-runner')
    } else {
      navigate('caregiver-locked-runner')
    }
  }

  const handleDoctorViewReport = async (sessionId?: string) => {
    const rpt = report || await getReport(sessionId || 'session-mock')
    setReport(rpt)
    navigate('doctor-report')
  }

  // AI handler
  const handleOpenAi = () => {
    if (questions.length > 0) {
      const q = questions[0] // simplified for demo
      setAiQuestionId(q.id)
      setAiQuestionNumber(1)
      setAiQuestionText(q.text)
    }
    setAiDrawerOpen(true)
  }

  // ---- Render screen ----
  const renderScreen = () => {
    if (loading) {
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

  // ---- Bottom nav visibility ----
  const showBottomNav = appMode === 'patient' && TAB_SCREENS.includes(currentScreen)
  const showAiFab = AI_FAB_SCREENS.includes(currentScreen) && !aiDrawerOpen && currentScreen !== 'caregiver-locked-runner'

  return (
    <div
      data-component="mobile-app"
      className="w-full max-w-[480px] mx-auto h-[100dvh] flex flex-col bg-cream-100 relative overflow-hidden"
    >
      {/* Mode switcher - small pill at top */}
      <div
        data-component="mode-switcher"
        className="flex-shrink-0 flex items-center justify-center py-2 px-5 safe-top"
        data-hide-in-locked
      >
        <div className="flex bg-cream-200 rounded-pill p-0.5">
          <Button
            variant="ghost"
            onClick={() => { setAppMode('patient'); setCurrentScreen('home') }}
            className={`px-4 py-1.5 rounded-pill text-xs font-medium transition-smooth ${
              appMode === 'patient' ? 'bg-white text-foreground shadow-sm' : 'text-muted'
            }`}
          >
            家长端
          </Button>
          <Button
            variant="ghost"
            onClick={() => { setAppMode('doctor'); setCurrentScreen('doctor-home') }}
            className={`px-4 py-1.5 rounded-pill text-xs font-medium transition-smooth ${
              appMode === 'doctor' ? 'bg-white text-foreground shadow-sm' : 'text-muted'
            }`}
          >
            医生端
          </Button>
        </div>
      </div>

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
      {showBottomNav && (
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
      {showAiFab && (
        <AiAssistantFab onClick={handleOpenAi} visible={showAiFab} />
      )}

      {/* AI drawer overlay */}
      <AiAssistantDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        questionNumber={aiQuestionNumber}
        questionText={aiQuestionText}
        questionId={aiQuestionId}
        mode={currentScreen === 'doctor-assisted-runner' ? 'doctor_assisted' : 'parent_self'}
      />
    </div>
  )
}
