// Assessment service layer — wraps mock data now, real API later
import { children, scales, questions, report, history } from '../data/mockData'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export async function getChildren() {
  await delay(300)
  return [...children]
}

export async function getChildrenScales() {
  await delay(300)
  // Only children's clinical scales — no MBTI, Holland, PHQ-9, etc.
  return [...scales]
}

export async function getQuestions(scaleId) {
  await delay(200)
  const qs = questions[scaleId] || questions['snap-iv']
  return [...qs]
}

export async function autoSaveLocal(sessionId, questionId, answer) {
  // In real implementation, this saves to localStorage
  await delay(50)
  return { success: true, savedLocally: true }
}

export async function autoSaveServer(sessionId, answers) {
  await delay(400)
  // Simulate occasional server failure
  if (Math.random() > 0.9) {
    return { success: false, savedLocally: true, error: 'Network error' }
  }
  return { success: true, savedLocally: false }
}

export async function forceSync(sessionId) {
  await delay(500)
  return { success: true }
}

export async function submitAnswers(sessionId, answers) {
  await delay(800)
  return {
    success: true,
    sessionId,
    reportId: 'session-001',
  }
}

export async function getReport(sessionId) {
  await delay(500)
  return { ...report }
}

export async function getHistory(memberId) {
  await delay(400)
  if (memberId) {
    return history.filter(h => h.childId === memberId)
  }
  return [...history]
}
