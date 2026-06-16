import { prisma } from '@/lib/db/prisma';
import { getScaleDefinitionById } from '@/lib/scales/catalog';
import { retrieveKnowledgeChunksByVector } from '@/lib/services/platform-knowledge-indexing';
import {
  resolveLocalizedText,
  resolveQuestionColloquial,
  resolveQuestionSimpleExplain,
  resolveQuestionText,
} from '@/lib/schemas/core/i18n';
import type { LanguageCode } from '@/lib/schemas/core/types';

export type QuestionExplanationScopeType = 'PLATFORM' | 'ORGANIZATION' | 'DOCTOR';

export type QuestionExplanationRecord = {
  id: string;
  scopeType: QuestionExplanationScopeType;
  title?: string | null;
  contentMd: string;
  priority: number;
  lang?: string;
  sourceDocId?: string | null;
  sourceDocTitle?: string | null;
  organizationId?: string | null;
  doctorProfileId?: string | null;
};

export type QuestionExplanationReference = {
  id: string;
  title: string;
  scopeType: QuestionExplanationScopeType;
};

export type QuestionExplanationRetrievalItem = {
  chunkId: string;
  chunkIndex: number;
  docId: string;
  docTitle: string;
  scopeType: QuestionExplanationScopeType;
  scope: QuestionExplanationScopeType;
  score: number;
  contentText: string;
};

type ComposeQuestionExplanationInput = {
  scaleId: string;
  scaleTitle: string;
  question: {
    id: number;
    text: string;
    colloquial: string;
    standardExplanation: string;
  };
  language: LanguageCode;
  platformOverride?: QuestionExplanationRecord | null;
  customExplanations: QuestionExplanationRecord[];
  retrieval?: QuestionExplanationRetrievalItem[];
};

export type QuestionExplanationView = ReturnType<typeof composeQuestionExplanationView>;

const QUESTION_RETRIEVAL_LIMIT = 4;

const SCOPE_ORDER: Record<QuestionExplanationScopeType, number> = {
  PLATFORM: 0,
  ORGANIZATION: 1,
  DOCTOR: 2,
};

function normalizeExplanationLanguage(language?: string | null): LanguageCode {
  return String(language || '').toLowerCase() === 'en' ? 'en' : 'zh';
}

function sortExplanationRecords(records: QuestionExplanationRecord[], language: LanguageCode) {
  return [...records].sort((left, right) => {
    const leftLanguagePenalty = normalizeExplanationLanguage(left.lang) === language ? 0 : 1;
    const rightLanguagePenalty = normalizeExplanationLanguage(right.lang) === language ? 0 : 1;
    if (leftLanguagePenalty !== rightLanguagePenalty) {
      return leftLanguagePenalty - rightLanguagePenalty;
    }
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return left.id.localeCompare(right.id);
  });
}

function sortScopeTypes(
  left: QuestionExplanationScopeType,
  right: QuestionExplanationScopeType
) {
  return SCOPE_ORDER[left] - SCOPE_ORDER[right];
}

function dedupeReferences(references: QuestionExplanationReference[]) {
  return [...references]
    .filter(
      (item, index, source) =>
        source.findIndex(
          (candidate) => candidate.id === item.id && candidate.scopeType === item.scopeType
        ) === index
    )
    .sort((left, right) => {
      const scopeDiff = sortScopeTypes(left.scopeType, right.scopeType);
      if (scopeDiff !== 0) {
        return scopeDiff;
      }
      return left.title.localeCompare(right.title, 'zh-Hans-CN');
    });
}

function mapRetrievalRecord(record: any): QuestionExplanationRetrievalItem | null {
  if (!record?.docId || !record?.contentText) {
    return null;
  }

  const scopeType = record.scopeType as QuestionExplanationScopeType;
  return {
    chunkId: String(record.chunkId || record.id),
    chunkIndex: typeof record.chunkIndex === 'number' ? record.chunkIndex : 0,
    docId: String(record.docId),
    docTitle: String(record.docTitle || '知识文档'),
    scopeType,
    scope: scopeType,
    score: Number(record.score || 0),
    contentText: record.contentText,
  };
}

function isRetrievalScopeVisible(input: {
  scopeType: QuestionExplanationScopeType;
  organizationId?: string | null;
  doctorProfileId?: string | null;
  visibleOrganizationId?: string | null;
  visibleDoctorProfileIds: string[];
}) {
  if (input.scopeType === 'PLATFORM') {
    return true;
  }

  if (input.scopeType === 'ORGANIZATION') {
    return Boolean(
      input.visibleOrganizationId &&
        input.organizationId &&
        input.visibleOrganizationId === input.organizationId
    );
  }

  return Boolean(
    input.doctorProfileId && input.visibleDoctorProfileIds.includes(input.doctorProfileId)
  );
}

async function getQuestionRetrievalSupplements(input: {
  scaleTitle: string;
  question: {
    text: string;
    colloquial: string;
    standardExplanation: string;
  };
  language: LanguageCode;
  organizationId?: string | null;
  doctorProfileId?: string | null;
  attendingDoctorProfileId?: string | null;
}) {
  const doctorProfileIds = Array.from(
    new Set([input.doctorProfileId, input.attendingDoctorProfileId].filter(Boolean))
  ) as string[];
  const queryText = [
    input.scaleTitle,
    input.question.text,
    input.question.colloquial,
    input.question.standardExplanation,
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n');
  if (!queryText) {
    return [];
  }

  const scoredCandidates: Array<QuestionExplanationRetrievalItem | null> = (
    await retrieveKnowledgeChunksByVector({
      queryText,
      organizationId: input.organizationId,
      doctorProfileId: input.doctorProfileId,
      attendingDoctorProfileId: input.attendingDoctorProfileId,
      limit: QUESTION_RETRIEVAL_LIMIT * 2,
    })
  ).map((item) => {
    const mapped = mapRetrievalRecord(item);
    if (!mapped) {
      return null;
    }

    if (
      !isRetrievalScopeVisible({
        scopeType: mapped.scopeType,
        organizationId:
          mapped.scopeType === 'ORGANIZATION' ? input.organizationId || null : null,
        doctorProfileId:
          mapped.scopeType === 'DOCTOR' && input.doctorProfileId
            ? input.doctorProfileId
            : mapped.scopeType === 'DOCTOR' && input.attendingDoctorProfileId
              ? input.attendingDoctorProfileId
              : null,
        visibleOrganizationId: input.organizationId || null,
        visibleDoctorProfileIds: doctorProfileIds,
      })
    ) {
      return null;
    }

    return mapped;
  });

  const ranked = scoredCandidates
    .filter(
      (item: QuestionExplanationRetrievalItem | null): item is QuestionExplanationRetrievalItem =>
        Boolean(item)
    )
    .sort((left: QuestionExplanationRetrievalItem, right: QuestionExplanationRetrievalItem) => {
      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const scopeDiff = sortScopeTypes(left.scopeType, right.scopeType);
      if (scopeDiff !== 0) {
        return scopeDiff;
      }

      if (left.chunkIndex !== right.chunkIndex) {
        return left.chunkIndex - right.chunkIndex;
      }

      return left.chunkId.localeCompare(right.chunkId);
    });

  const retrieval: QuestionExplanationRetrievalItem[] = [];
  const seenDocIds = new Set<string>();
  for (const item of ranked) {
    if (seenDocIds.has(item.docId)) {
      continue;
    }
    seenDocIds.add(item.docId);
    retrieval.push(item);
    if (retrieval.length >= QUESTION_RETRIEVAL_LIMIT) {
      break;
    }
  }

  return retrieval;
}

function groupQuestionExplanations(input: {
  customExplanations: QuestionExplanationRecord[];
  language: LanguageCode;
  platformOverride?: QuestionExplanationRecord | null;
}) {
  const sortedCustom = sortExplanationRecords(input.customExplanations, input.language);
  return {
    platformOverride: input.platformOverride || null,
    organization: sortedCustom.filter((item) => item.scopeType === "ORGANIZATION"),
    doctor: sortedCustom.filter((item) => item.scopeType === "DOCTOR"),
  };
}

export function composeQuestionExplanationView(input: ComposeQuestionExplanationInput) {
  const grouped = groupQuestionExplanations({
    customExplanations: input.customExplanations,
    language: input.language,
    platformOverride: input.platformOverride,
  });

  const platformRecord = grouped.platformOverride;
  const platformContent =
    platformRecord?.contentMd?.trim() || input.question.standardExplanation.trim();
  const retrieval = input.retrieval || [];
  const references = dedupeReferences([
    ...(platformRecord?.sourceDocId
      ? [
          {
            id: platformRecord.sourceDocId,
            title: platformRecord.sourceDocTitle || '平台题解文档',
            scopeType: platformRecord.scopeType,
          },
        ]
      : []),
    ...[...grouped.organization, ...grouped.doctor]
      .filter((item) => item.sourceDocId)
      .map((item) => ({
        id: item.sourceDocId as string,
        title: item.sourceDocTitle || item.title || '补充知识文档',
        scopeType: item.scopeType,
      })),
    ...retrieval.map((item) => ({
      id: item.docId,
      title: item.docTitle,
      scopeType: item.scopeType,
    })),
  ]);

  return {
    scale: {
      id: input.scaleId,
      title: input.scaleTitle,
    },
    question: {
      id: input.question.id,
      text: input.question.text,
      colloquial: input.question.colloquial,
    },
    exact: {
      platform: {
        source: platformRecord ? 'approved_question_explanation' : 'scale_definition',
        title: platformRecord?.title || '平台标准解释',
        content: platformContent,
      },
      organization: grouped.organization.map((item) => ({
        id: item.id,
        scopeType: item.scopeType,
        title: item.title || '机构补充',
        content: item.contentMd,
        sourceDocId: item.sourceDocId || null,
        sourceDocTitle: item.sourceDocTitle || null,
        priority: item.priority,
      })),
      doctor: grouped.doctor.map((item) => ({
        id: item.id,
        scopeType: item.scopeType,
        title: item.title || '医生补充',
        content: item.contentMd,
        sourceDocId: item.sourceDocId || null,
        sourceDocTitle: item.sourceDocTitle || null,
        priority: item.priority,
      })),
    },
    retrieval,
    references,
  };
}

function buildBaseQuestionExplanation(input: {
  scaleId: string;
  questionId: number;
  language: LanguageCode;
}) {
  const scale = getScaleDefinitionById(input.scaleId);
  if (!scale) {
    throw new Error(`Scale ${input.scaleId} not found`);
  }

  const question = scale.questions.find((item) => item.id === input.questionId);
  if (!question) {
    throw new Error(`Question ${input.questionId} not found in scale ${input.scaleId}`);
  }

  return {
    scaleId: scale.id,
    scaleTitle: resolveLocalizedText(scale.title, input.language),
    question: {
      id: question.id,
      text: resolveQuestionText(question, input.language),
      colloquial: resolveQuestionColloquial(question, input.language),
      standardExplanation: resolveQuestionSimpleExplain(question, input.language),
    },
  };
}

function mapQuestionExplanationRecord(record: any): QuestionExplanationRecord {
  return {
    id: record.id,
    scopeType: record.scopeType as QuestionExplanationScopeType,
    title: record.title || null,
    contentMd: record.contentMd,
    priority: typeof record.priority === 'number' ? record.priority : 100,
    lang: record.lang || 'zh',
    sourceDocId: record.sourceDoc?.id || record.sourceDocId || null,
    sourceDocTitle: record.sourceDoc?.title || null,
    organizationId: record.organizationId || null,
    doctorProfileId: record.doctorProfileId || null,
  };
}

export async function getQuestionExplanation(input: {
  scaleId: string;
  questionId: number;
  language: LanguageCode;
  organizationId?: string | null;
  doctorProfileId?: string | null;
  attendingDoctorProfileId?: string | null;
}) {
  const base = buildBaseQuestionExplanation(input);
  const questionExplanationModel = (prisma as any).questionExplanation;
  const doctorProfileIds = Array.from(
    new Set([input.doctorProfileId, input.attendingDoctorProfileId].filter(Boolean))
  ) as string[];
  const scopeFilters: Array<Record<string, unknown>> = [{ scopeType: 'PLATFORM' }];

  if (input.organizationId) {
    scopeFilters.push({
      scopeType: 'ORGANIZATION',
      organizationId: input.organizationId,
    });
  }

  if (doctorProfileIds.length) {
    scopeFilters.push({
      scopeType: 'DOCTOR',
      doctorProfileId: {
        in: doctorProfileIds,
      },
    });
  }

  const languageCandidates =
    input.language === 'zh' ? ['zh'] : [input.language, 'zh'];

  const records: QuestionExplanationRecord[] = questionExplanationModel?.findMany
    ? (
        await questionExplanationModel.findMany({
          where: {
            scaleId: base.scaleId,
            questionId: input.questionId,
            status: 'APPROVED',
            lang: {
              in: languageCandidates,
            },
            OR: scopeFilters,
          },
          include: {
            sourceDoc: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        })
      ).map(mapQuestionExplanationRecord)
    : [];

  const sorted = sortExplanationRecords(records, input.language);
  const platformOverride =
    sorted.find((item) => item.scopeType === 'PLATFORM') || null;
  const customExplanations = sorted.filter((item) => item.scopeType !== 'PLATFORM');
  const retrieval = await getQuestionRetrievalSupplements({
    scaleTitle: base.scaleTitle,
    question: base.question,
    language: input.language,
    organizationId: input.organizationId,
    doctorProfileId: input.doctorProfileId,
    attendingDoctorProfileId: input.attendingDoctorProfileId,
  }).catch((error) => {
    console.error('[platform-knowledge] vector retrieval unavailable:', error);
    return [];
  });

  return composeQuestionExplanationView({
    ...base,
    language: input.language,
    platformOverride,
    customExplanations,
    retrieval,
  });
}

export async function recordQuestionExplanationAudit(input: {
  organizationId?: string | null;
  actorType: 'USER' | 'DOCTOR' | 'ADMIN' | 'SYSTEM';
  actorUserId?: string | null;
  actorDoctorProfileId?: string | null;
  memberProfileId?: string | null;
  scaleId: string;
  questionId: number;
  customExplanationIds: string[];
}) {
  const auditLogModel = (prisma as any).auditLog;
  if (!auditLogModel?.create) {
    return null;
  }

  return auditLogModel.create({
    data: {
      organizationId: input.organizationId || null,
      actorType: input.actorType,
      actorUserId: input.actorUserId || null,
      actorDoctorProfileId: input.actorDoctorProfileId || null,
      memberProfileId: input.memberProfileId || null,
      targetType: 'QUESTION_EXPLANATION',
      targetId: `${input.scaleId}:${input.questionId}`,
      action: 'QUESTION_EXPLANATION_VIEWED',
      details: {
        scaleId: input.scaleId,
        questionId: input.questionId,
        customExplanationIds: input.customExplanationIds,
      },
    },
  });
}
