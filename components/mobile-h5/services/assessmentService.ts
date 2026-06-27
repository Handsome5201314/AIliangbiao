import type {
  Child,
  Scale,
  ScaleCategory,
  Question,
  Report,
  HistoryRecord,
  DoctorPatient,
  DoctorStats,
  DoctorHistoryRecord,
  TemporaryPatient,
  Answer,
} from '@/components/mobile-h5/types';

import { apiRequest, getAuthHeaders } from '@/components/mobile-h5/services/authService';

type LocalizedText = string | { zh?: string; en?: string };

type ServerScaleOption = {
  label: LocalizedText;
  score: number;
};

type ServerScaleQuestion = {
  id: number | string;
  text?: LocalizedText;
  colloquial?: LocalizedText;
  options: ServerScaleOption[];
};

type ServerScale = {
  id: string;
  title: LocalizedText;
  description?: LocalizedText;
  category?: string;
  tags?: string[];
  estimatedMinutes?: number;
  interactionMode?: string;
  resultDeliveryMode?: string;
  questions: ServerScaleQuestion[];
  voiceFriendly?: boolean;
};

type ProfileSyncResponse = {
  profiles?: Array<{
    id: string;
    nickname?: string;
    realName?: string | null;
    gender?: string;
    ageMonths?: number | null;
  }>;
};

type AssessmentHistoryResponse = {
  history?: Array<{
    id: string;
    sessionId?: string;
    scaleId: string;
    scaleName?: string;
    childName?: string;
    childId?: string | null;
    completedAt: string;
    status?: 'completed' | 'in_progress';
    riskLevel?: 'low' | 'moderate' | 'high';
    riskLabel?: string;
  }>;
};

type DoctorPatientsResponse = {
  patients?: Array<{
    memberId: string;
    nickname?: string;
    realName?: string | null;
    gender?: string;
    ageMonths?: number | null;
    latestAssessment?: {
      scaleId?: string;
      conclusion?: string;
      createdAt?: string;
    } | null;
  }>;
};

type DoctorDashboardResponse = {
  patientCount?: number;
  recentAssessmentCount?: number;
  recentAssessments?: Array<{
    id: string;
    scaleId: string;
    conclusion: string;
    createdAt: string;
  }>;
};

type EvaluateResponse = {
  scaleId: string;
  result: {
    totalScore: number;
    conclusion: string;
    details?: Record<string, unknown>;
  };
};

type SaveAssessmentResponse = {
  assessment?: {
    id: string;
    scaleId: string;
    totalScore: number;
    conclusion: string;
    createdAt: string;
  };
};

type MobileTemporaryPatientResponse = {
  patient: DoctorPatient;
};

type MobileClinicAssessmentResponse = {
  sessionId: string;
  success: true;
};

type MobileHandoffLockResponse = {
  success: true;
  lockedAt: number;
};

type MobileDoctorReauthResponse = {
  success: boolean;
};

type SubmitContext = {
  scaleId: string;
  childId?: string | null;
  childName?: string;
  serverSessionId?: string | null;
};

const SCALE_META: Record<string, Pick<Scale, 'category' | 'ageRange' | 'recommended'>> = {
  'M_CHAT_R': { category: 'autism', ageRange: '16-30月', recommended: true },
  'SRS': { category: 'autism', ageRange: '2.5-18岁', recommended: true },
  'CARS': { category: 'autism', ageRange: '2岁以上', recommended: false },
  'ATEC': { category: 'autism', ageRange: '2-12岁', recommended: false },
  'SNAP-IV': { category: 'attention_behavior', ageRange: '6-12岁', recommended: true },
  'ABC': { category: 'attention_behavior', ageRange: '0-12岁', recommended: false },
  'VINELAND_3': { category: 'development', ageRange: '0-18岁', recommended: false },
  'CBCL_113': { category: 'development', ageRange: '1.5-18岁', recommended: false },
  'TAS_37': { category: 'development', ageRange: '儿童青少年', recommended: false },
};

export const PARENT_SELF_BLOCKED_SCALE_IDS = new Set(['CARS', 'VINELAND_3']);

function resolveText(value: LocalizedText | undefined, fallback = '') {
  if (!value) return fallback;
  return typeof value === 'string' ? value : value.zh || value.en || fallback;
}

function mergeHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...getAuthHeaders(),
    ...(extra || {}),
  };
}

function requireAuthHeaders(extra?: HeadersInit) {
  const headers = mergeHeaders(extra);
  const normalized = new Headers(headers);
  if (!normalized.has('Authorization')) {
    throw new Error('需要登录后访问该数据');
  }
  return headers;
}

function normalizeGender(value?: string): Child['gender'] {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'male' || normalized === 'm') return 'male';
  if (normalized === 'female' || normalized === 'f') return 'female';
  return 'unknown';
}

function avatarForGender(gender: Child['gender']) {
  if (gender === 'male') return '男';
  if (gender === 'female') return '女';
  return '童';
}

function formatAge(ageMonths?: number | null) {
  if (!Number.isFinite(ageMonths ?? NaN) || ageMonths === null || ageMonths === undefined) {
    return '年龄未填写';
  }
  if (ageMonths < 12) return `${ageMonths}个月`;
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  return months ? `${years}岁${months}个月` : `${years}岁`;
}

function mapRisk(conclusion?: string): { riskLevel: 'low' | 'moderate' | 'high'; riskLabel: string } {
  const text = conclusion || '';
  if (/重度|高度|高风险|明显|severe|high/i.test(text)) {
    return { riskLevel: 'high', riskLabel: '高度关注' };
  }
  if (/中度|建议|关注|moderate/i.test(text)) {
    return { riskLevel: 'moderate', riskLabel: '中度关注' };
  }
  return { riskLevel: 'low', riskLabel: '低风险' };
}

function mapScale(scale: ServerScale): Scale {
  const id = scale.id.toUpperCase();
  const meta = SCALE_META[id] || {
    category: (scale.category === 'Child Development' ? 'development' : 'autism') as ScaleCategory,
    ageRange: '儿童青少年',
    recommended: false,
  };

  return {
    id: scale.id,
    name: resolveText(scale.title, scale.id),
    shortName: scale.id.replace(/_/g, '-'),
    category: meta.category,
    ageRange: meta.ageRange,
    duration: `${scale.estimatedMinutes || 10}-${(scale.estimatedMinutes || 10) + 5}分钟`,
    questionCount: scale.questions.length,
    tags: scale.tags || [],
    description: resolveText(scale.description, '儿童发育行为筛查量表'),
    recommended: meta.recommended || Boolean(scale.voiceFriendly),
  };
}

function mapQuestion(question: ServerScaleQuestion): Question {
  const questionId = String(question.id);
  return {
    id: questionId,
    text: resolveText(question.colloquial, resolveText(question.text, questionId)),
    options: question.options.map((option, index) => ({
      id: `${questionId}-o${index + 1}`,
      label: resolveText(option.label, String(option.score)),
      value: option.score,
    })),
  };
}

async function fetchScale(scaleId: string) {
  const data = await apiRequest<{ scale: ServerScale }>(`/api/scales?id=${encodeURIComponent(scaleId)}`);
  return data.scale;
}

function buildReport(input: {
  sessionId: string;
  scale: ServerScale;
  result: EvaluateResponse['result'];
  childName?: string;
}): Report {
  const questionMaxScore = input.scale.questions.reduce((sum, question) => {
    const maxOption = Math.max(...question.options.map((option) => option.score));
    return sum + (Number.isFinite(maxOption) ? maxOption : 0);
  }, 0);
  const risk = mapRisk(input.result.conclusion);

  return {
    sessionId: input.sessionId,
    scaleName: resolveText(input.scale.title, input.scale.id),
    childName: input.childName || '孩子',
    completedAt: new Date().toISOString(),
    totalScore: input.result.totalScore,
    maxScore: questionMaxScore,
    riskLevel: risk.riskLevel,
    riskLabel: risk.riskLabel,
    summary: input.result.conclusion,
    dimensions: [],
    recommendations: [
      '本结果仅用于儿童发育行为筛查与随访参考，不能替代专业诊断。',
      '如结果提示持续关注，请携带报告咨询儿童发育行为或心理专科医生。',
    ],
  };
}

async function recordReportViewAccess(sessionId: string, headers?: HeadersInit) {
  await apiRequest('/api/research/report-views', {
    method: 'POST',
    headers: requireAuthHeaders(headers),
    body: JSON.stringify({
      assessmentHistoryId: sessionId,
      viewerRole: 'MOBILE_H5',
      metadata: {
        surface: 'mobile-h5',
      },
    }),
  });
}

export async function recordFollowUpCompletion(input: {
  memberProfileId?: string | null;
  assessmentHistoryId?: string | null;
  assessmentSessionId?: string | null;
  headers?: HeadersInit;
}) {
  await apiRequest('/api/research/followups', {
    method: 'POST',
    headers: requireAuthHeaders(input.headers),
    body: JSON.stringify({
      memberProfileId: input.memberProfileId || null,
      assessmentHistoryId: input.assessmentHistoryId || null,
      assessmentSessionId: input.assessmentSessionId || null,
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      metadata: {
        surface: 'mobile-h5',
      },
    }),
  });
}

export async function getChildren(headers?: HeadersInit): Promise<Child[]> {
  const data = await apiRequest<ProfileSyncResponse>('/api/profile/sync', {
    headers: requireAuthHeaders(headers),
  });

  return (data.profiles || []).map((profile) => {
    const gender = normalizeGender(profile.gender);
    return {
      id: profile.id,
      name: profile.nickname || profile.realName || '未命名儿童',
      age: profile.ageMonths ?? 0,
      ageLabel: formatAge(profile.ageMonths),
      gender,
      avatar: avatarForGender(gender),
      latestAssessment: null,
    };
  });
}

export async function getScales(options?: {
  group?: ScaleCategory;
  audience?: 'parent_self' | 'doctor';
}): Promise<Scale[]> {
  const data = await apiRequest<{ scales: ServerScale[] }>('/api/scales');
  const audience = options?.audience || 'parent_self';
  const availableScales = audience === 'doctor'
    ? data.scales
    : data.scales.filter((scale) => {
        const scaleId = scale.id.toUpperCase();
        return (
          !PARENT_SELF_BLOCKED_SCALE_IDS.has(scaleId) &&
          scale.interactionMode !== 'web_handoff' &&
          scale.resultDeliveryMode !== 'physician_review'
        );
      });
  const allScales = availableScales.map(mapScale);

  if (!options?.group || options.group === 'all') {
    return allScales;
  }

  return allScales.filter((scale) => scale.category === options.group);
}

export async function getQuestions(scaleId: string): Promise<Question[]> {
  const scale = await fetchScale(scaleId);
  return scale.questions.map(mapQuestion);
}

export async function autoSaveLocal(
  sessionId: string,
  answers: Record<string, Answer>,
): Promise<{ success: true; savedLocally: true }> {
  window.localStorage.setItem(`h5_assessment_draft:${sessionId}`, JSON.stringify(answers));
  const [, scaleId] = sessionId.match(/^session_([^:]+):/) || [];
  if (scaleId) {
    window.localStorage.setItem(`h5_assessment_draft:last:${scaleId}`, sessionId);
  }
  return { success: true, savedLocally: true };
}

export async function autoSaveServer(
  sessionId: string,
  answers: Record<string, Answer>,
): Promise<{ success: boolean; savedLocally: boolean }> {
  await autoSaveLocal(sessionId, answers);
  return { success: true, savedLocally: true };
}

export async function forceSync(): Promise<{ success: true }> {
  throw new Error('答题同步接口尚未接入真实后端契约');
}

export async function loadLocalDraft(sessionId: string): Promise<Record<string, Answer> | null> {
  const raw = window.localStorage.getItem(`h5_assessment_draft:${sessionId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Record<string, Answer>;
  } catch {
    window.localStorage.removeItem(`h5_assessment_draft:${sessionId}`);
    return null;
  }
}

export async function loadLatestLocalDraftForScale(scaleId: string): Promise<Record<string, Answer> | null> {
  const sessionId = window.localStorage.getItem(`h5_assessment_draft:last:${scaleId}`);
  return sessionId ? loadLocalDraft(sessionId) : null;
}

export async function clearLocalDraft(sessionId: string, scaleId?: string): Promise<{ success: true }> {
  window.localStorage.removeItem(`h5_assessment_draft:${sessionId}`);
  if (scaleId) {
    window.localStorage.removeItem(`h5_assessment_draft:last:${scaleId}`);
  }
  return { success: true };
}

export async function submitAnswers(
  sessionId: string,
  answers: Record<string, Answer>,
  headers?: HeadersInit,
  context?: SubmitContext,
): Promise<{ success: true; sessionId: string; reportId: string }> {
  if (!context?.scaleId) {
    throw new Error('提交测评缺少量表 ID');
  }

  const scale = await fetchScale(context.scaleId);
  const orderedScores = scale.questions.map((question) => {
    const answer = answers[String(question.id)];
    if (!answer) {
      throw new Error(`第 ${question.id} 题尚未作答`);
    }
    return answer.value;
  });
  const evaluation = await apiRequest<EvaluateResponse>('/api/scales/evaluate', {
    method: 'POST',
    body: JSON.stringify({
      scaleId: context.scaleId,
      answers: orderedScores,
    }),
  });

  const saved = await apiRequest<SaveAssessmentResponse>('/api/assessment/save', {
    method: 'POST',
    headers: requireAuthHeaders(headers),
    body: JSON.stringify({
      profileId: context.childId,
      scaleId: context.scaleId,
      totalScore: evaluation.result.totalScore,
      conclusion: evaluation.result.conclusion,
      answers: orderedScores,
      ...(context.serverSessionId ? { sessionId: context.serverSessionId } : {}),
    }),
  });

  const reportId = saved.assessment?.id || sessionId;

  if (context.childId || context.serverSessionId) {
    await recordFollowUpCompletion({
      memberProfileId: context.childId,
      assessmentHistoryId: reportId,
      assessmentSessionId: context.serverSessionId,
      headers,
    });
  }

  return { success: true, sessionId: reportId, reportId };
}

export async function getReport(sessionId: string, headers?: HeadersInit): Promise<Report> {
  try {
    const report = await apiRequest<Report>(`/api/assessment/history/${encodeURIComponent(sessionId)}/report`, {
      headers: requireAuthHeaders(headers),
    });
    await recordReportViewAccess(sessionId, headers);
    return report;
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : '';
    if (status === 403 || /PENDING_DOCTOR_REVIEW|等待医生复核/.test(message)) {
      throw new Error('PENDING_DOCTOR_REVIEW：等待医生复核后可查看正式报告');
    }
    throw error;
  }
}

export async function getHistory(memberId?: string, headers?: HeadersInit): Promise<HistoryRecord[]> {
  const query = memberId ? `?profileId=${encodeURIComponent(memberId)}` : '';
  const data = await apiRequest<AssessmentHistoryResponse>(`/api/assessment/history${query}`, {
    headers: requireAuthHeaders(headers),
  });

  return (data.history || []).map((item) => {
    const risk = mapRisk(item.riskLabel);
    return {
      id: item.id,
      sessionId: item.sessionId || item.id,
      scaleName: item.scaleName || item.scaleId,
      childName: item.childName || '孩子',
      childId: item.childId || '',
      completedAt: item.completedAt,
      status: item.status || 'completed',
      riskLevel: item.riskLevel || risk.riskLevel,
      riskLabel: item.riskLabel || risk.riskLabel,
    };
  });
}

export async function getDoctorPatients(headers?: HeadersInit): Promise<DoctorPatient[]> {
  const data = await apiRequest<DoctorPatientsResponse>('/api/doctor/patients', {
    headers: requireAuthHeaders(headers),
  });

  return (data.patients || []).map((patient) => {
    const gender = normalizeGender(patient.gender);
    const risk = mapRisk(patient.latestAssessment?.conclusion);
    return {
      id: patient.memberId,
      name: patient.nickname || patient.realName || '未命名患者',
      age: patient.ageMonths ?? 0,
      ageLabel: formatAge(patient.ageMonths),
      gender,
      avatar: avatarForGender(gender),
      isTemporary: false,
      latestAssessment: patient.latestAssessment
        ? {
            scaleName: patient.latestAssessment.scaleId || '量表',
            date: patient.latestAssessment.createdAt || '',
            riskLevel: risk.riskLevel,
          }
        : null,
    };
  });
}

export async function createTemporaryPatient(
  data: TemporaryPatient,
  headers?: HeadersInit,
): Promise<DoctorPatient> {
  const response = await apiRequest<MobileTemporaryPatientResponse>('/api/doctor/mobile/temporary-members', {
    method: 'POST',
    headers: requireAuthHeaders(headers),
    body: JSON.stringify(data),
  });
  return response.patient;
}

export async function createClinicAssessment(
  patientId: string,
  scaleId: string,
  fillMode: 'doctor_assisted' | 'caregiver_handoff_locked',
  headers?: HeadersInit,
): Promise<MobileClinicAssessmentResponse> {
  return await apiRequest<MobileClinicAssessmentResponse>('/api/doctor/mobile/clinic-screenings', {
    method: 'POST',
    headers: requireAuthHeaders(headers),
    body: JSON.stringify({
      patientId,
      scaleId,
      fillMode,
    }),
  });
}

export async function enterCaregiverHandoff(
  sessionId: string,
  headers?: HeadersInit,
): Promise<MobileHandoffLockResponse> {
  return await apiRequest<MobileHandoffLockResponse>(
    `/api/doctor/mobile/clinic-screenings/${encodeURIComponent(sessionId)}/handoff-lock`,
    {
      method: 'POST',
      headers: requireAuthHeaders(headers),
    },
  );
}

export async function verifyDoctorPin(
  pin: string,
  sessionId?: string | null,
  headers?: HeadersInit,
): Promise<MobileDoctorReauthResponse> {
  const path = sessionId
    ? `/api/doctor/mobile/clinic-screenings/${encodeURIComponent(sessionId)}/reauth`
    : '/api/doctor/mobile/reauth';
  return await apiRequest<MobileDoctorReauthResponse>(path, {
    method: 'POST',
    headers: requireAuthHeaders(headers),
    body: JSON.stringify({ pin }),
  });
}

export async function getDoctorStats(headers?: HeadersInit): Promise<DoctorStats> {
  const data = await apiRequest<DoctorDashboardResponse>('/api/doctor/me/dashboard', {
    headers: requireAuthHeaders(headers),
  });

  return {
    todayCount: data.recentAssessmentCount || 0,
    monthCount: data.patientCount || 0,
  };
}

export async function getDoctorHistory(headers?: HeadersInit): Promise<DoctorHistoryRecord[]> {
  const data = await apiRequest<DoctorDashboardResponse>('/api/doctor/me/dashboard', {
    headers: requireAuthHeaders(headers),
  });

  return (data.recentAssessments || []).map((item) => {
    const risk = mapRisk(item.conclusion);
    return {
      id: item.id,
      patientName: '患者',
      scaleName: item.scaleId,
      date: item.createdAt,
      fillMode: 'doctor_assisted',
      status: 'completed',
      riskLevel: risk.riskLevel,
    };
  });
}
