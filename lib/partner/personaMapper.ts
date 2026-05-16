import crypto from 'node:crypto';

type TraitVector = {
  social_energy: number;
  empathy_resonance: number;
  rational_logic: number;
  stress_resilience: number;
  behavioral_flexibility: number;
};

type BehavioralConstraints = {
  communicationStyle: string;
  fears: string[];
  interests: string[];
  decisionMaking: string;
  defaultPosture: string;
  supportNeeds: string[];
};

type DatingTraits = {
  expression_warmth: number;
  intimacy_pacing: number;
  novelty_drive: number;
  boundary_awareness: number;
  conflict_recovery: number;
};

type MemberTraits = {
  interests: string[];
  fears: string[];
  behaviors: string[];
  medicalHistory: string[];
};

export type RawAssessmentScores = {
  memberTraits: MemberTraits;
  sources: string[];
  SRS?: {
    totalScore: number;
    normalizedTotal: number;
    subscales: {
      socialEnergyLoss: number;
      empathyDifficulty: number;
      stressSensitivity: number;
      flexibilityDifficulty: number;
      boundaryDifficulty: number;
    };
  };
  MBTI?: {
    personalityType: string;
    dimensions: {
      energy?: { E?: number; I?: number; winner?: string };
      perception?: { S?: number; N?: number; winner?: string };
      judgment?: { T?: number; F?: number; winner?: string };
      lifestyle?: { J?: number; P?: number; winner?: string };
    };
  };
  PHQ9?: {
    totalScore: number;
    normalizedTotal: number;
  };
  GAD7?: {
    totalScore: number;
    normalizedTotal: number;
  };
  HOLLAND?: {
    topCode: string;
    dimensions: Record<string, { score?: number; label?: string }>;
  };
};

const DEFAULT_VECTOR_VALUE = 0.5;
const DEFAULT_SNAPSHOT_SALT = 'arena-snapshot-dev-salt';

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_VECTOR_VALUE;
  }

  return Math.min(1, Math.max(0, value));
}

function round2(value: number) {
  return Number(clamp01(value).toFixed(2));
}

function average(values: Array<number | null | undefined>, fallback = DEFAULT_VECTOR_VALUE) {
  const usable = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!usable.length) {
    return fallback;
  }

  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function invert(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return 1 - clamp01(value);
}

function resolveMbtiRatio(
  dimensions: RawAssessmentScores['MBTI'] extends infer T
    ? T extends { dimensions: infer U }
      ? U
      : never
    : never,
  primary: string,
  secondary: string
) {
  const group = Object.values(dimensions || {}).find((value) => value && primary in value && secondary in value);
  if (!group) {
    return null;
  }

  const primaryScore = Number((group as Record<string, unknown>)[primary] || 0);
  const secondaryScore = Number((group as Record<string, unknown>)[secondary] || 0);
  const total = primaryScore + secondaryScore;
  if (!total) {
    return null;
  }

  return primaryScore / total;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

function getArenaSnapshotSalt() {
  return process.env.ARENA_SNAPSHOT_SALT || DEFAULT_SNAPSHOT_SALT;
}

export function generateTraitVector(rawScores: RawAssessmentScores): TraitVector {
  const mbtiExtraversion = rawScores.MBTI ? resolveMbtiRatio(rawScores.MBTI.dimensions, 'E', 'I') : null;
  const mbtiThinking = rawScores.MBTI ? resolveMbtiRatio(rawScores.MBTI.dimensions, 'T', 'F') : null;
  const mbtiIntuition = rawScores.MBTI ? resolveMbtiRatio(rawScores.MBTI.dimensions, 'N', 'S') : null;
  const mbtiPerceiving = rawScores.MBTI ? resolveMbtiRatio(rawScores.MBTI.dimensions, 'P', 'J') : null;

  const social_energy = average([
    mbtiExtraversion,
    invert(rawScores.SRS?.subscales.socialEnergyLoss),
    invert(rawScores.PHQ9?.normalizedTotal),
  ]);

  const empathy_resonance = average([
    invert(rawScores.SRS?.subscales.empathyDifficulty),
    rawScores.MBTI ? 1 - (mbtiThinking ?? DEFAULT_VECTOR_VALUE) : null,
  ]);

  const rational_logic = average([
    mbtiThinking,
    rawScores.HOLLAND?.topCode?.includes('I') ? 0.75 : null,
  ]);

  const stress_resilience = average([
    invert(rawScores.GAD7?.normalizedTotal),
    invert(rawScores.PHQ9?.normalizedTotal),
    invert(rawScores.SRS?.subscales.stressSensitivity),
  ]);

  const behavioral_flexibility = average([
    invert(rawScores.SRS?.subscales.flexibilityDifficulty),
    rawScores.MBTI ? mbtiPerceiving ?? DEFAULT_VECTOR_VALUE : null,
    rawScores.MBTI ? mbtiIntuition ?? DEFAULT_VECTOR_VALUE : null,
  ]);

  return {
    social_energy: round2(social_energy),
    empathy_resonance: round2(empathy_resonance),
    rational_logic: round2(rational_logic),
    stress_resilience: round2(stress_resilience),
    behavioral_flexibility: round2(behavioral_flexibility),
  };
}

export function generateBehavioralConstraints(
  rawScores: RawAssessmentScores,
  traitVector: TraitVector
): BehavioralConstraints {
  const constraints: BehavioralConstraints = {
    communicationStyle: '自然交流，能较稳定理解对方反馈。',
    fears: [...rawScores.memberTraits.fears],
    interests: [...rawScores.memberTraits.interests],
    decisionMaking: '综合考虑事实与感受后作决定。',
    defaultPosture: '自然放松，愿意观察环境并逐步互动。',
    supportNeeds: [],
  };

  if (traitVector.social_energy < 0.35) {
    constraints.communicationStyle = '偏谨慎和慢热，倾向简短表达，先观察再进入互动。';
  } else if (traitVector.social_energy > 0.7) {
    constraints.communicationStyle = '社交启动较积极，愿意主动发起互动，但需要稳定反馈。';
  }

  if (traitVector.empathy_resonance < 0.4) {
    constraints.supportNeeds.push('需要更明确的情绪提示和语义上下文，不适合高隐喻沟通。');
  }

  if (traitVector.stress_resilience < 0.4) {
    constraints.fears.push('突如其来的群体关注', '高噪音与高刺激环境');
    constraints.supportNeeds.push('在高压或高刺激场景下需要更清晰的节奏、边界和缓冲。');
    constraints.defaultPosture = '进入新环境时会先警觉观察，压力升高时可能减少表达。';
  }

  if (traitVector.behavioral_flexibility < 0.4) {
    constraints.supportNeeds.push('更适合提前说明流程和规则，尽量减少临时变化。');
  }

  if (rawScores.MBTI?.personalityType) {
    const type = rawScores.MBTI.personalityType;
    if (type.includes('T')) {
      constraints.decisionMaking = '更重视逻辑一致性、规则和可解释性。';
    } else if (type.includes('F')) {
      constraints.decisionMaking = '更重视关系氛围、感受和人际反馈。';
    }
  }

  if (rawScores.HOLLAND?.topCode) {
    const hollandHints: Record<string, string> = {
      R: '偏好动手实践与具体操作',
      I: '偏好研究、分析与独立思考',
      A: '偏好表达、审美与创意探索',
      S: '偏好帮助、协作与人际连接',
      E: '偏好带动、组织与目标推进',
      C: '偏好结构、秩序与明确流程',
    };
    const topCode = rawScores.HOLLAND.topCode;
    constraints.interests.push(
      ...topCode.split('').map((item) => hollandHints[item]).filter(Boolean)
    );
  }

  constraints.fears = uniqueValues(constraints.fears);
  constraints.interests = uniqueValues(constraints.interests);
  constraints.supportNeeds = uniqueValues(constraints.supportNeeds);

  return constraints;
}

export function generateDatingTraits(
  rawScores: RawAssessmentScores,
  traitVector: TraitVector
): DatingTraits {
  const boundary_awareness = average([
    invert(rawScores.SRS?.subscales.boundaryDifficulty),
    traitVector.empathy_resonance,
  ]);

  return {
    expression_warmth: round2(average([traitVector.social_energy, traitVector.empathy_resonance])),
    intimacy_pacing: round2(average([traitVector.behavioral_flexibility, traitVector.stress_resilience])),
    novelty_drive: round2(average([
      rawScores.MBTI?.personalityType?.includes('N') ? 0.75 : null,
      rawScores.HOLLAND?.topCode?.includes('A') ? 0.8 : null,
      rawScores.HOLLAND?.topCode?.includes('I') ? 0.7 : null,
      traitVector.social_energy,
    ])),
    boundary_awareness: round2(boundary_awareness),
    conflict_recovery: round2(average([traitVector.stress_resilience, traitVector.behavioral_flexibility])),
  };
}

export function generateLockedHash(traitVector: TraitVector, constraints: BehavioralConstraints) {
  const payload = JSON.stringify({ traitVector, constraints });
  return crypto.createHmac('sha256', getArenaSnapshotSalt()).update(payload).digest('hex');
}

export function createPublicProfileId(profileId: string) {
  const digest = crypto.createHmac('sha256', getArenaSnapshotSalt()).update(profileId).digest('hex');
  return `profile_${digest.slice(0, 16)}`;
}

export function getSourceSummary(rawScores: RawAssessmentScores) {
  const derivedFrom = uniqueValues(rawScores.sources);
  const baseScore = 0.5 + derivedFrom.length * 0.12 + (rawScores.memberTraits.interests.length ? 0.06 : 0) + (rawScores.memberTraits.fears.length ? 0.04 : 0);
  const reliabilityScore = Math.min(0.98, Number(baseScore.toFixed(2)));
  const dataDepth = derivedFrom.length >= 3 ? 'High' : derivedFrom.length >= 2 ? 'Medium' : 'Low';

  return {
    derivedFrom,
    reliabilityScore,
    dataDepth,
  };
}
