export const AGENT_SESSION_PATH = '/api/agent/session';
export const SKILL_ROUTE_PREFIX = '/api/skill/v1';

export const skillRoutes = {
  scales: `${SKILL_ROUTE_PREFIX}/scales`,
  voiceIntent: `${SKILL_ROUTE_PREFIX}/voice-intent`,
  speechTranscribe: `${SKILL_ROUTE_PREFIX}/speech/transcribe`,
  profileSync: `${SKILL_ROUTE_PREFIX}/profile/sync`,
  accountUpgrade: `${SKILL_ROUTE_PREFIX}/account/upgrade`,
  quota: `${SKILL_ROUTE_PREFIX}/me/quota`,
  triageSession: `${SKILL_ROUTE_PREFIX}/me/triage-session`,
  scaleDetail: (scaleId: string) => `${SKILL_ROUTE_PREFIX}/scales/${encodeURIComponent(scaleId)}`,
  scaleEvaluate: (scaleId: string) => `${SKILL_ROUTE_PREFIX}/scales/${encodeURIComponent(scaleId)}/evaluate`,
  scaleSessions: (scaleId: string) => `${SKILL_ROUTE_PREFIX}/scales/${encodeURIComponent(scaleId)}/sessions`,
  scaleSession: (scaleId: string, sessionId: string) =>
    `${SKILL_ROUTE_PREFIX}/scales/${encodeURIComponent(scaleId)}/sessions/${encodeURIComponent(sessionId)}`,
  scaleSessionAnswer: (scaleId: string, sessionId: string) =>
    `${SKILL_ROUTE_PREFIX}/scales/${encodeURIComponent(scaleId)}/sessions/${encodeURIComponent(sessionId)}/answer`,
  scaleSessionResult: (scaleId: string, sessionId: string) =>
    `${SKILL_ROUTE_PREFIX}/scales/${encodeURIComponent(scaleId)}/sessions/${encodeURIComponent(sessionId)}/result`,
  scaleAnalyzeConversation: (scaleId: string) =>
    `${SKILL_ROUTE_PREFIX}/scales/${encodeURIComponent(scaleId)}/analyze-conversation`,
  members: `${SKILL_ROUTE_PREFIX}/me/members`,
  memberContext: (memberId: string) =>
    `${SKILL_ROUTE_PREFIX}/me/members/${encodeURIComponent(memberId)}/context`,
  memberAssessmentSummary: (memberId: string) =>
    `${SKILL_ROUTE_PREFIX}/me/members/${encodeURIComponent(memberId)}/assessment-summary`,
  memberMemorySummary: (memberId: string) =>
    `${SKILL_ROUTE_PREFIX}/me/members/${encodeURIComponent(memberId)}/memory-summary`,
  memberMemoryNotes: (memberId: string) =>
    `${SKILL_ROUTE_PREFIX}/me/members/${encodeURIComponent(memberId)}/memory-notes`,
  memberAdvice: (memberId: string) =>
    `${SKILL_ROUTE_PREFIX}/me/members/${encodeURIComponent(memberId)}/advice`,
} as const;
