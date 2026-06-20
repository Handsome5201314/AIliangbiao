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
} from '@/types';

import {
  children,
  scales,
  questions,
  report,
  history,
  doctorPatients,
  doctorStats,
  doctorHistory,
} from '@/data/mockData';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── Patient Side ──────────────────────────────────────────────────────────────

/**
 * Fetch all children profiles.
 */
export async function getChildren(): Promise<Child[]> {
  await delay(300);
  return [...children];
}

/**
 * Fetch scales, optionally filtered by category.
 * Defaults to children clinical scales (excludes exploration scales).
 */
export async function getScales(options?: {
  group?: ScaleCategory;
}): Promise<Scale[]> {
  await delay(400);
  const group = options?.group;
  if (!group || group === 'all') {
    return [...scales];
  }
  return scales.filter((s) => s.category === group);
}

/**
 * Fetch all questions for a given scale.
 */
export async function getQuestions(scaleId: string): Promise<Question[]> {
  await delay(300);
  return [...(questions[scaleId] || [])];
}

// ─── Auto-save ─────────────────────────────────────────────────────────────────

/**
 * Save answers to local storage (fast, reliable).
 */
export async function autoSaveLocal(
  _sessionId: string,
  _answers: Record<string, any>,
): Promise<{ success: true; savedLocally: true }> {
  await delay(50);
  return { success: true, savedLocally: true };
}

/**
 * Save answers to server (slower, 10% random failure rate for mock).
 */
export async function autoSaveServer(
  _sessionId: string,
  _answers: Record<string, any>,
): Promise<{ success: boolean; savedLocally: boolean }> {
  await delay(400);
  const failed = Math.random() < 0.1;
  if (failed) {
    return { success: false, savedLocally: true };
  }
  return { success: true, savedLocally: false };
}

/**
 * Force-sync locally saved answers to server.
 */
export async function forceSync(
  _sessionId: string,
): Promise<{ success: true }> {
  await delay(500);
  return { success: true };
}

// ─── Submit & Report ───────────────────────────────────────────────────────────

/**
 * Submit completed assessment answers.
 */
export async function submitAnswers(
  sessionId: string,
  _answers: Record<string, any>,
): Promise<{ success: true; sessionId: string; reportId: string }> {
  await delay(600);
  return { success: true, sessionId, reportId: 'report-1' };
}

/**
 * Fetch a completed assessment report.
 */
export async function getReport(_sessionId: string): Promise<Report> {
  await delay(500);
  return { ...report };
}

// ─── History ───────────────────────────────────────────────────────────────────

/**
 * Fetch assessment history, optionally filtered by member/child.
 */
export async function getHistory(memberId?: string): Promise<HistoryRecord[]> {
  await delay(400);
  if (memberId) {
    return history.filter((h) => h.childId === memberId).map((h) => ({ ...h }));
  }
  return history.map((h) => ({ ...h }));
}

// ─── Doctor Side ───────────────────────────────────────────────────────────────

/**
 * Fetch all patients assigned to the current doctor.
 */
export async function getDoctorPatients(): Promise<DoctorPatient[]> {
  await delay(400);
  return doctorPatients.map((p) => ({ ...p }));
}

/**
 * Create a temporary (walk-in) patient for a clinic session.
 * TODO: POST /api/doctor/mobile/temporary-members
 */
export async function createTemporaryPatient(
  data: TemporaryPatient,
): Promise<DoctorPatient> {
  await delay(500);
  const newPatient: DoctorPatient = {
    id: randomId(),
    name: data.name,
    age: data.ageMonths,
    ageLabel: `${Math.floor(data.ageMonths / 12)}岁${data.ageMonths % 12 ? `${data.ageMonths % 12}个月` : ''}`,
    gender: data.gender,
    avatar: data.gender === 'male' ? '👦' : '👧',
    isTemporary: true,
    latestAssessment: null,
  };
  return newPatient;
}

/**
 * Create a clinic assessment session for a patient.
 * TODO: POST /api/doctor/mobile/clinic-screenings
 */
export async function createClinicAssessment(
  _patientId: string,
  _scaleId: string,
  _fillMode: string,
): Promise<{ sessionId: string; success: true }> {
  await delay(500);
  return { sessionId: randomId(), success: true };
}

/**
 * Lock the session for caregiver handoff mode.
 * TODO: POST /api/doctor/mobile/clinic-screenings/:sessionId/handoff-lock
 */
export async function enterCaregiverHandoff(
  _sessionId: string,
): Promise<{ success: true; lockedAt: number }> {
  await delay(400);
  return { success: true, lockedAt: Date.now() };
}

/**
 * Verify doctor PIN for re-authentication during caregiver handoff.
 * TODO: POST /api/doctor/mobile/clinic-screenings/:sessionId/reauth
 */
export async function verifyDoctorPin(
  pin: string,
): Promise<{ success: boolean }> {
  await delay(300);
  // Accept '123456' or any 6-digit string (mock only)
  const isValid = pin === '123456' || /^\d{6}$/.test(pin);
  return { success: isValid };
}

/**
 * Fetch doctor's assessment statistics.
 */
export async function getDoctorStats(): Promise<DoctorStats> {
  await delay(300);
  return { ...doctorStats };
}

/**
 * Fetch doctor's assessment history.
 */
export async function getDoctorHistory(): Promise<DoctorHistoryRecord[]> {
  await delay(400);
  return doctorHistory.map((h) => ({ ...h }));
}
