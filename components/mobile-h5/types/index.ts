/* ===== Assessment Mode ===== */
export type AssessmentMode = 'parent_self' | 'doctor_assisted' | 'caregiver_handoff_locked';

/* ===== Child / Member ===== */
export interface Child {
  id: string;
  name: string;
  age: number;          // months
  ageLabel: string;     // display-friendly
  gender: 'male' | 'female' | 'unknown';
  avatar: string;       // emoji or url
  latestAssessment?: {
    scaleName: string;
    date: string;
    status: 'completed' | 'in_progress';
    riskLevel: 'low' | 'moderate' | 'high';
  } | null;
}

/* ===== Scale ===== */
export type ScaleCategory = 'all' | 'autism' | 'attention_behavior' | 'development';

export interface Scale {
  id: string;
  name: string;
  shortName: string;
  category: ScaleCategory;
  ageRange: string;
  duration: string;     // e.g. "10-15分钟"
  questionCount: number;
  tags: string[];
  description: string;
  recommended: boolean;
}

/* ===== Question & Option ===== */
export interface Option {
  id: string;
  label: string;
  value: number;
}

export interface Question {
  id: string;
  text: string;
  options: Option[];
}

/* ===== Answer ===== */
export interface Answer {
  questionId: string;
  optionId: string;
  value: number;
  unsure?: boolean;     // doctor marked "parent unsure"
  confidence?: number;
  evidence?: string;
  source?: 'manual' | 'ai_mapped' | 'user_confirmed_mapping';
  confirmedLowConfidence?: boolean;
}

/* ===== Report ===== */
export interface Dimension {
  name: string;
  score: number;
  maxScore: number;
  level: 'low' | 'moderate' | 'high';
  description: string;
}

export interface Report {
  sessionId: string;
  scaleName: string;
  childName: string;
  completedAt: string;
  totalScore: number;
  maxScore: number;
  riskLevel: 'low' | 'moderate' | 'high';
  riskLabel: string;
  summary: string;
  dimensions: Dimension[];
  recommendations: string[];
}

/* ===== History ===== */
export interface HistoryRecord {
  id: string;
  sessionId: string;
  scaleName: string;
  childName: string;
  childId: string;
  completedAt: string;
  status: 'completed' | 'in_progress';
  riskLevel: 'low' | 'moderate' | 'high';
  riskLabel: string;
}

/* ===== Doctor-specific ===== */
export interface DoctorPatient {
  id: string;
  name: string;
  age: number;
  ageLabel: string;
  gender: 'male' | 'female' | 'unknown';
  avatar: string;
  isTemporary: boolean;
  latestAssessment?: {
    scaleName: string;
    date: string;
    riskLevel: 'low' | 'moderate' | 'high';
  } | null;
}

export interface TemporaryPatient {
  name: string;
  gender: 'male' | 'female';
  ageMonths: number;
  contact?: string;
  note?: string;
}

export interface DoctorStats {
  todayCount: number;
  monthCount: number;
}

export interface DoctorHistoryRecord {
  id: string;
  patientName: string;
  scaleName: string;
  date: string;
  fillMode: 'doctor_assisted' | 'caregiver_handoff_locked';
  status: 'completed' | 'in_progress';
  riskLevel: 'low' | 'moderate' | 'high';
}

/* ===== Auto-save ===== */
export type AutoSaveStatus = 'saving' | 'saved' | 'saved-locally' | 'syncing' | 'failed';

/* ===== Screen routing ===== */
export type ScreenId =
  | 'login'
  | 'role-select'
  | 'doctor-pin-login'
  | 'lock'
  | 'home'
  | 'children'
  | 'scales'
  | 'assessment-intro'
  | 'questionnaire'
  | 'report'
  | 'history'
  | 'doctor-home'
  | 'doctor-patient-picker'
  | 'doctor-temp-patient'
  | 'doctor-scale-picker'
  | 'doctor-fill-mode'
  | 'doctor-assisted-runner'
  | 'caregiver-locked-runner'
  | 'caregiver-complete'
  | 'doctor-reauth'
  | 'doctor-report';

export interface ScreenParams {
  childId?: string;
  scaleId?: string;
  sessionId?: string;
  patientId?: string;
  fillMode?: 'doctor_assisted' | 'caregiver_handoff_locked';
  reportEntrySource?: 'history' | 'just-submitted';
}

/* ===== AI ===== */
export interface AiExplanation {
  questionId: string;
  explanation: string;
}

export type QuickQuestionType = 'meaning' | 'options' | 'example' | 'unsure' | 'explain-to-parent';

/* ===== Auth ===== */
export type AccountType = 'PATIENT' | 'DOCTOR';

export interface DoctorProfile {
  id: string;
  name: string;
  department?: string;
  verificationStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
}

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  accountType: AccountType;
  isDoctor: boolean;
  isPatient: boolean;
  isGuest?: boolean;
  email?: string;
  doctorProfile?: DoctorProfile | null;
}
