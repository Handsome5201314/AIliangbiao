import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Save, ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ProgressBar from './components/ProgressBar'
import QuestionCard from './components/QuestionCard'
import OptionButton from './components/OptionButton'
import AutoSaveIndicator from './components/AutoSaveIndicator'
import AiAssistantFab from './components/AiAssistantFab'
import AiAssistantDrawer from './components/AiAssistantDrawer'
import AiAssistantFull from './components/AiAssistantFull'
import { autoSaveLocal, autoSaveServer } from '../services/assessmentService'
import { getQuestionExplanation } from '../services/aiExplanationService'

export default function QuestionnaireScreen({
  scale,
  questions,
  onComplete,
  onBack,
  memberId,
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [saveStatus, setSaveStatus] = useState('saved')
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [aiFullScreen, setAiFullScreen] = useState(false)
  const [aiExplanation, setAiExplanation] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length
  const isLast = currentIndex === totalQuestions - 1

  // Load AI explanation when question changes
  useEffect(() => {
    if (!currentQuestion) return
    setAiExplanation(null)
    if (aiDrawerOpen) {
      loadExplanation()
    }
  }, [currentIndex, aiDrawerOpen])

  const loadExplanation = useCallback(async () => {
    if (!currentQuestion) return
    setAiLoading(true)
    try {
      const result = await getQuestionExplanation({
        scaleId: scale?.id || 'snap-iv',
        questionId: currentQuestion.id,
        questionText: currentQuestion.text,
        options: currentQuestion.options,
        memberId,
        assessmentSessionId: 'session-mock',
      })
      setAiExplanation(result.explanation)
    } catch {
      setAiExplanation('抱歉，暂时无法加载题目解释。')
    }
    setAiLoading(false)
  }, [currentQuestion, scale, memberId])

  const handleSelectOption = async (option) => {
    const newAnswers = { ...answers, [currentQuestion.id]: option }
    setAnswers(newAnswers)

    // Dual-layer auto-save: local first, then server
    setSaveStatus('saving')
    await autoSaveLocal('session-mock', currentQuestion.id, option)
    setSaveStatus('saved')

    // Async server sync
    autoSaveServer('session-mock', newAnswers).then(result => {
      if (result.success) {
        setSaveStatus('saved')
      } else {
        setSaveStatus('saved-locally')
      }
    })
  }

  const handleNext = () => {
    if (!answers[currentQuestion.id]) {
      setToastMsg('请先选择一个选项再继续')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
      return
    }
    if (isLast) {
      onComplete(answers)
    } else {
      setCurrentIndex(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }

  return (
    <section data-component="questionnaire-screen" className="flex flex-col h-full relative">
      {/* Toast */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-foreground text-white text-sm px-4 py-2.5 rounded-pill shadow-lg toast-enter">
          {toastMsg}
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200 bg-white flex-shrink-0">
        <Button onClick={onBack} variant="ghost" size="icon" className="p-2 -ml-2 rounded-full hover:bg-cream-100">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-base font-medium text-foreground truncate max-w-[140px]">
            {scale?.shortName || '量表填写'}
          </span>
          <AutoSaveIndicator status={saveStatus} />
        </div>
        <Button variant="ghost" size="icon" className="p-2 -mr-2 rounded-full hover:bg-cream-100">
          <Save className="w-5 h-5 text-muted" />
        </Button>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 bg-white border-b border-cream-100 flex-shrink-0">
        <ProgressBar current={currentIndex + 1} total={totalQuestions} />
      </div>

      {/* Question area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
        <QuestionCard
          questionNumber={currentIndex + 1}
          text={currentQuestion?.text}
          animationKey={currentQuestion?.id}
        />

        {/* Options */}
        <div className="space-y-2.5">
          {currentQuestion?.options.map(option => (
            <OptionButton
              key={option.id}
              option={option}
              selected={answers[currentQuestion.id]?.id === option.id}
              onSelect={handleSelectOption}
            />
          ))}
        </div>
      </div>

      {/* Bottom action bar */}
      <footer
        data-component="questionnaire-actions"
        className="flex items-center gap-3 px-4 py-3 bg-white border-t border-cream-200 flex-shrink-0"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex-1"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          上一题
        </Button>
        <Button
          onClick={handleNext}
          className="flex-[1.5]"
        >
          {isLast ? '提交' : '下一题'}
        </Button>
      </footer>

      {/* AI Assistant FAB */}
      <AiAssistantFab
        onClick={() => {
          setAiDrawerOpen(true)
          loadExplanation()
        }}
        visible={!aiDrawerOpen && !aiFullScreen}
      />

      {/* AI Drawer */}
      <AiAssistantDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        onExpand={() => {
          setAiDrawerOpen(false)
          setAiFullScreen(true)
        }}
        questionNumber={currentIndex + 1}
        questionText={currentQuestion?.text}
        questionId={currentQuestion?.id}
        explanation={aiExplanation}
        loading={aiLoading}
      />

      {/* AI Full */}
      <AiAssistantFull
        open={aiFullScreen}
        onClose={() => setAiFullScreen(false)}
        questionText={currentQuestion?.text}
      />
    </section>
  )
}
