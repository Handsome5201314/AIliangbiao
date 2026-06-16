// AI explanation service — mock now, real API later
// Real endpoint: GET /api/platform/v1/ai/explanations/question?scaleId=xxx&questionId=xxx&memberId=xxx
import { aiExplanations } from '../data/mockData'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const DISCLAIMER = '我只能解释题意，不能替你作答或诊断。如有疑虑请咨询专业医生。'

export async function getQuestionExplanation({
  scaleId,
  questionId,
  questionText,
  options,
  memberId,
  assessmentSessionId,
}) {
  await delay(600)

  const explanation = aiExplanations[questionId] ||
    `这道题观察的是孩子在日常生活中的行为表现。请根据孩子最近几周的实际表现来判断，而不是某一次特殊情况。每个选项代表行为出现的频率或程度，请选出最符合孩子情况的选项。`

  return {
    questionId,
    questionText,
    explanation,
    disclaimer: DISCLAIMER,
    timestamp: new Date().toISOString(),
  }
}

export async function getQuickExplanation(questionId, quickType) {
  await delay(400)

  const base = aiExplanations[questionId] || '请根据孩子的实际表现来选择。'

  switch (quickType) {
    case 'meaning':
      return `题意解释：${base}`
    case 'options':
      return `选项理解：这四个选项代表行为出现的频率。"完全没有"表示极少或从不出现，"有一点"表示偶尔出现，"比较多"表示经常出现，"非常多"表示几乎每天都能观察到。`
    case 'example':
      return `举个例子：比如这道题，如果孩子在做作业时经常走神、看窗外、玩铅笔，但上课时能保持专注，那在学校场景可能选"有一点"，在家做功课的场景可能选"比较多"。请综合考虑各场景的表现。`
    case 'unsure':
      return `如果不确定怎么选：请回想孩子最近2-4周的整体表现，而不是某一天。如果某些行为只在特定情境下出现（比如只在陌生环境），可以选择程度较轻的选项。记住，没有"正确答案"，如实反映就是最好的。`
    default:
      return base
  }
}

export { DISCLAIMER }
