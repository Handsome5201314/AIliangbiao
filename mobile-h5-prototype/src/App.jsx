import React, { useState, useEffect } from 'react'
import { Home, ClipboardList, Clock, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import HomeScreen from '@/screens/HomeScreen'
import ChildrenScreen from '@/screens/ChildrenScreen'
import ScalesScreen from '@/screens/ScalesScreen'
import AssessmentIntroScreen from '@/screens/AssessmentIntroScreen'
import QuestionnaireScreen from '@/screens/QuestionnaireScreen'
import ReportScreen from '@/screens/ReportScreen'
import HistoryScreen from '@/screens/HistoryScreen'
import {
  getChildren,
  getChildrenScales,
  getQuestions,
  getReport,
  getHistory,
} from '@/services/assessmentService'

const TABS = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'scales', label: '量表', icon: ClipboardList },
  { id: 'history', label: '记录', icon: Clock },
  { id: 'children', label: '我的', icon: User },
]

// Screens that show bottom tab nav
const TAB_VISIBLE_SCREENS = ['home', 'children', 'scales', 'history']

export default function App() {
  const [screen, setScreen] = useState('home')
  const [childrenData, setChildrenData] = useState([])
  const [scalesData, setScalesData] = useState([])
  const [questionsData, setQuestionsData] = useState([])
  const [historyData, setHistoryData] = useState([])
  const [reportData, setReportData] = useState(null)
  const [selectedChildId, setSelectedChildId] = useState('child-1')
  const [selectedScale, setSelectedScale] = useState(null)
  const [reportEntrySource, setReportEntrySource] = useState('history')
  const [loading, setLoading] = useState(true)

  // Load initial data
  useEffect(() => {
    async function init() {
      setLoading(true)
      const [c, s, h] = await Promise.all([
        getChildren(),
        getChildrenScales(),
        getHistory(),
      ])
      setChildrenData(c)
      setScalesData(s)
      setHistoryData(h)
      setLoading(false)
    }
    init()
  }, [])

  const currentChild = childrenData.find(c => c.id === selectedChildId) || childrenData[0]

  const showTabNav = TAB_VISIBLE_SCREENS.includes(screen)

  const navigate = (target, params = {}) => {
    if (params.fromHistory) {
      setReportEntrySource('history')
    }
    setScreen(target)
  }

  const handleSelectChild = (child) => {
    setSelectedChildId(child.id)
    setScreen('home')
  }

  const handleSelectScale = async (scale) => {
    setSelectedScale(scale)
    const qs = await getQuestions(scale.id)
    setQuestionsData(qs)
    setScreen('assessment-intro')
  }

  const handleStartQuestionnaire = () => {
    setScreen('questionnaire')
  }

  const handleCompleteQuestionnaire = async (answers) => {
    const r = await getReport('session-001')
    setReportData(r)
    setReportEntrySource('just-submitted')
    setScreen('report')
  }

  const handleViewReport = async (record) => {
    const r = await getReport(record.sessionId)
    setReportData(r)
    setReportEntrySource('history')
    setScreen('report')
  }

  const renderScreen = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-3 border-cream-300 border-t-sage-500 rounded-full animate-spin" />
        </div>
      )
    }

    switch (screen) {
      case 'home':
        return (
          <HomeScreen
            currentChild={currentChild}
            recentAssessment={currentChild?.latestAssessment || historyData[0]}
            onNavigate={navigate}
            onSelectChild={() => navigate('children')}
          />
        )
      case 'children':
        return (
          <ChildrenScreen
            children={childrenData}
            selectedChildId={selectedChildId}
            onSelectChild={handleSelectChild}
          />
        )
      case 'scales':
        return (
          <ScalesScreen
            scales={scalesData}
            onSelectScale={handleSelectScale}
          />
        )
      case 'assessment-intro':
        return (
          <AssessmentIntroScreen
            scale={selectedScale}
            currentChild={currentChild}
            onStart={handleStartQuestionnaire}
            onBack={() => navigate('scales')}
            onSwitchChild={() => navigate('children')}
          />
        )
      case 'questionnaire':
        return (
          <QuestionnaireScreen
            scale={selectedScale}
            questions={questionsData}
            onComplete={handleCompleteQuestionnaire}
            onBack={() => navigate('assessment-intro')}
            memberId={selectedChildId}
          />
        )
      case 'report':
        return (
          <ReportScreen
            report={reportData}
            entrySource={reportEntrySource}
            onNavigate={navigate}
            onBack={() => navigate('history')}
          />
        )
      case 'history':
        return (
          <HistoryScreen
            history={historyData}
            onViewReport={handleViewReport}
          />
        )
      default:
        return <HomeScreen currentChild={currentChild} onNavigate={navigate} />
    }
  }

  return (
    <div data-component="mobile-app" className="w-full max-w-[480px] mx-auto h-[100dvh] flex flex-col bg-cream-100 relative" role="application" aria-label="儿童发育评估平台">
      {/* Phone frame for Canvas preview only — in production this would be full-width responsive */}
      <section data-component="screen-container" className="flex-1 flex flex-col overflow-hidden bg-cream-100 relative" style={{ minHeight: 0 }}>
        {/* Screen content */}
        <article data-component="screen-content" className="flex-1 overflow-y-auto no-scrollbar" style={{ minHeight: 0 }}>
          {renderScreen()}
        </article>

        {/* Bottom Tab Nav */}
        {showTabNav && (
          <nav
            data-component="bottom-tab-nav"
            className="flex items-center bg-white border-t border-cream-200 flex-shrink-0"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            aria-label="主导航"
          >
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = screen === tab.id || (tab.id === 'home' && ['home'].includes(screen))
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.id)}
                  className={`
                    flex-1 flex flex-col items-center justify-center py-2.5 min-h-touch transition-smooth
                    ${isActive ? 'text-sage-500' : 'text-muted'}
                  `}
                >
                  <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                  <span className={`text-xs ${isActive ? 'font-semibold' : 'font-normal'}`}>
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </nav>
        )}
      </section>
    </div>
  )
}
