import { prisma } from "@/lib/db/prisma";
import { indexKnowledgeDocChunks } from "@/lib/services/platform-knowledge-indexing";

export type AdminKnowledgeReviewStatus =
  | "ALL"
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED";

export type AdminKnowledgeReviewItemType = "ALL" | "KNOWLEDGE_DOC" | "QUESTION_EXPLANATION";

export type AdminKnowledgeReviewAction = "approve" | "reject";

type ListAdminKnowledgeReviewItemsInput = {
  itemType?: AdminKnowledgeReviewItemType;
  status?: AdminKnowledgeReviewStatus;
  query?: string;
  limit?: number;
};

type ReviewKnowledgeItemInput = {
  itemType: Exclude<AdminKnowledgeReviewItemType, "ALL">;
  itemId: string;
  action: AdminKnowledgeReviewAction;
  reviewNotes?: string | null;
  adminId: string;
};

type AdminKnowledgeReviewRecord = {
  id: string;
  itemType: Exclude<AdminKnowledgeReviewItemType, "ALL">;
  title: string;
  summary: string | null;
  status: Exclude<AdminKnowledgeReviewStatus, "ALL">;
  scopeType: "PLATFORM" | "ORGANIZATION" | "DOCTOR";
  language: string;
  organizationId: string | null;
  doctorProfileId: string | null;
  organizationName: string | null;
  doctorName: string | null;
  sourceDocId: string | null;
  sourceDocTitle: string | null;
  questionId: number | null;
  scaleId: string | null;
  uploadedByUserId: string | null;
  sourceFileName: string | null;
  chunkCount: number;
  reviewedByAdminId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeTextPreview(value?: string | null, fallback = "暂无摘要") {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
}

function normalizeReviewItemStatus(status?: string | null): Exclude<AdminKnowledgeReviewStatus, "ALL"> {
  switch (status) {
    case "DRAFT":
    case "PENDING_REVIEW":
    case "APPROVED":
    case "REJECTED":
    case "ARCHIVED":
      return status;
    default:
      return "DRAFT";
  }
}

function buildReviewStatusFilter(status?: AdminKnowledgeReviewStatus) {
  return status && status !== "ALL" ? { status } : {};
}

async function buildReferenceMaps(items: Array<{ organizationId?: string | null; doctorProfileId?: string | null }>) {
  const organizationIds = Array.from(
    new Set(items.map((item) => item.organizationId).filter((value): value is string => Boolean(value)))
  );
  const doctorProfileIds = Array.from(
    new Set(items.map((item) => item.doctorProfileId).filter((value): value is string => Boolean(value)))
  );

  const organizationModel = (prisma as any).organization;
  const [organizations, doctors] = await Promise.all([
    organizationIds.length && organizationModel?.findMany
      ? organizationModel.findMany({
          where: { id: { in: organizationIds } },
          select: { id: true, name: true },
        })
      : [],
    doctorProfileIds.length
      ? prisma.doctorProfile.findMany({
          where: { id: { in: doctorProfileIds } },
          select: { id: true, realName: true, hospitalName: true },
        })
      : [],
  ]);

  return {
    organizationMap: new Map<string, string>(
      (organizations || []).map((item: { id: string; name: string }) => [item.id, item.name])
    ),
    doctorMap: new Map<string, string>(
      doctors.map((item) => [item.id, item.realName || item.hospitalName || item.id])
    ),
  };
}

function mapKnowledgeDocRecord(
  record: any,
  maps: {
    organizationMap: Map<string, string>;
    doctorMap: Map<string, string>;
  }
): AdminKnowledgeReviewRecord {
  return {
    id: record.id,
    itemType: "KNOWLEDGE_DOC",
    title: record.title,
    summary: normalizeTextPreview(record.summary || record.rawMd, "暂无文档摘要"),
    status: normalizeReviewItemStatus(record.status),
    scopeType: record.scopeType,
    language: record.language || "zh",
    organizationId: record.organizationId || null,
    doctorProfileId: record.doctorProfileId || null,
    organizationName: record.organizationId ? maps.organizationMap.get(record.organizationId) || null : null,
    doctorName: record.doctorProfileId ? maps.doctorMap.get(record.doctorProfileId) || null : null,
    sourceDocId: null,
    sourceDocTitle: null,
    questionId: null,
    scaleId: null,
    uploadedByUserId: record.uploadedByUserId || null,
    sourceFileName: record.sourceFileName || null,
    chunkCount: typeof record.chunkCount === "number" ? record.chunkCount : 0,
    reviewedByAdminId: record.reviewedByAdminId || null,
    reviewedAt: record.reviewedAt || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapQuestionExplanationRecord(
  record: any,
  maps: {
    organizationMap: Map<string, string>;
    doctorMap: Map<string, string>;
  }
): AdminKnowledgeReviewRecord {
  return {
    id: record.id,
    itemType: "QUESTION_EXPLANATION",
    title: record.title || `${record.scaleId} · 第 ${record.questionId} 题解释`,
    summary: normalizeTextPreview(record.contentMd, "暂无题目解释"),
    status: normalizeReviewItemStatus(record.status),
    scopeType: record.scopeType,
    language: record.lang || "zh",
    organizationId: record.organizationId || null,
    doctorProfileId: record.doctorProfileId || null,
    organizationName: record.organizationId ? maps.organizationMap.get(record.organizationId) || null : null,
    doctorName: record.doctorProfileId ? maps.doctorMap.get(record.doctorProfileId) || null : null,
    sourceDocId: record.sourceDoc?.id || record.sourceDocId || null,
    sourceDocTitle: record.sourceDoc?.title || null,
    questionId: typeof record.questionId === "number" ? record.questionId : null,
    scaleId: record.scaleId || null,
    uploadedByUserId: null,
    sourceFileName: null,
    chunkCount: 0,
    reviewedByAdminId: null,
    reviewedAt: null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function listAdminKnowledgeReviewItems(
  input: ListAdminKnowledgeReviewItemsInput = {}
) {
  const knowledgeDocModel = (prisma as any).knowledgeDoc;
  const questionExplanationModel = (prisma as any).questionExplanation;
  const query = input.query?.trim();
  const limit = input.limit || 100;

  const [knowledgeDocs, questionExplanations] = await Promise.all([
    input.itemType === "QUESTION_EXPLANATION" || !knowledgeDocModel?.findMany
      ? []
      : knowledgeDocModel.findMany({
          where: {
            ...buildReviewStatusFilter(input.status),
            ...(query
              ? {
                  OR: [
                    { title: { contains: query, mode: "insensitive" } },
                    { summary: { contains: query, mode: "insensitive" } },
                    { sourceFileName: { contains: query, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: input.itemType === "KNOWLEDGE_DOC" ? limit : Math.max(20, Math.floor(limit / 2)),
          select: {
            id: true,
            title: true,
            summary: true,
            rawMd: true,
            status: true,
            scopeType: true,
            language: true,
            organizationId: true,
            doctorProfileId: true,
            uploadedByUserId: true,
            sourceFileName: true,
            chunkCount: true,
            reviewedByAdminId: true,
            reviewedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
    input.itemType === "KNOWLEDGE_DOC" || !questionExplanationModel?.findMany
      ? []
      : questionExplanationModel.findMany({
          where: {
            ...buildReviewStatusFilter(input.status),
            ...(query
              ? {
                  OR: [
                    { title: { contains: query, mode: "insensitive" } },
                    { scaleId: { contains: query, mode: "insensitive" } },
                    {
                      sourceDoc: {
                        title: { contains: query, mode: "insensitive" },
                      },
                    },
                  ],
                }
              : {}),
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: input.itemType === "QUESTION_EXPLANATION" ? limit : Math.max(20, Math.floor(limit / 2)),
          select: {
            id: true,
            title: true,
            contentMd: true,
            status: true,
            scopeType: true,
            lang: true,
            organizationId: true,
            doctorProfileId: true,
            scaleId: true,
            questionId: true,
            sourceDocId: true,
            createdAt: true,
            updatedAt: true,
            sourceDoc: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        }),
  ]);

  const maps = await buildReferenceMaps([
    ...(knowledgeDocs || []).map((item: any) => ({
      organizationId: item.organizationId,
      doctorProfileId: item.doctorProfileId,
    })),
    ...(questionExplanations || []).map((item: any) => ({
      organizationId: item.organizationId,
      doctorProfileId: item.doctorProfileId,
    })),
  ]);

  return [
    ...(knowledgeDocs || []).map((item: any) => mapKnowledgeDocRecord(item, maps)),
    ...(questionExplanations || []).map((item: any) => mapQuestionExplanationRecord(item, maps)),
  ]
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
    .slice(0, limit);
}

export async function countPendingKnowledgeReviewItems() {
  const knowledgeDocModel = (prisma as any).knowledgeDoc;
  const questionExplanationModel = (prisma as any).questionExplanation;

  const [knowledgeDocs, questionExplanations] = await Promise.all([
    knowledgeDocModel?.count ? knowledgeDocModel.count({ where: { status: "PENDING_REVIEW" } }) : 0,
    questionExplanationModel?.count
      ? questionExplanationModel.count({ where: { status: "PENDING_REVIEW" } })
      : 0,
  ]);

  return knowledgeDocs + questionExplanations;
}

export async function reviewKnowledgeItem(input: ReviewKnowledgeItemInput) {
  const nextStatus = input.action === "approve" ? "APPROVED" : "REJECTED";
  const now = new Date();
  const auditLogModel = (prisma as any).auditLog;

  if (input.itemType === "KNOWLEDGE_DOC") {
    const knowledgeDocModel = (prisma as any).knowledgeDoc;
    if (!knowledgeDocModel?.findUnique || !knowledgeDocModel?.update) {
      throw new Error("KnowledgeDoc model is not available");
    }

    const record = await knowledgeDocModel.findUnique({
      where: { id: input.itemId },
      select: {
        id: true,
        title: true,
        organizationId: true,
        status: true,
      },
    });

    if (!record) {
      throw new Error("知识文档不存在");
    }

    if (record.status !== "PENDING_REVIEW") {
      throw new Error("只有待审核知识文档才能执行审核操作");
    }

    if (input.action === "approve") {
      await indexKnowledgeDocChunks(record.id);
    }

    const updated = await knowledgeDocModel.update({
      where: { id: input.itemId },
      data: {
        status: nextStatus,
        reviewedByAdminId: input.adminId,
        reviewedAt: now,
        reviewComment: input.reviewNotes?.trim() || null,
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    if (auditLogModel?.create) {
      await auditLogModel.create({
        data: {
          organizationId: record.organizationId || null,
          actorType: "ADMIN",
          actorAdminId: input.adminId,
          targetType: "KNOWLEDGE_DOC",
          targetId: record.id,
          action: input.action === "approve" ? "KNOWLEDGE_DOC_APPROVED" : "KNOWLEDGE_DOC_REJECTED",
          details: {
            title: record.title,
            nextStatus,
            reviewNotes: input.reviewNotes?.trim() || null,
          },
        },
      });
    }

    return {
      itemType: "KNOWLEDGE_DOC" as const,
      itemId: updated.id,
      title: updated.title,
      status: updated.status,
    };
  }

  const questionExplanationModel = (prisma as any).questionExplanation;
  if (!questionExplanationModel?.findUnique || !questionExplanationModel?.update) {
    throw new Error("QuestionExplanation model is not available");
  }

  const record = await questionExplanationModel.findUnique({
    where: { id: input.itemId },
    select: {
      id: true,
      title: true,
      organizationId: true,
      scaleId: true,
      questionId: true,
      status: true,
    },
  });

  if (!record) {
    throw new Error("题目解释不存在");
  }

  if (record.status !== "PENDING_REVIEW") {
    throw new Error("只有待审核题目解释才能执行审核操作");
  }

  const updated = await questionExplanationModel.update({
    where: { id: input.itemId },
    data: {
      status: nextStatus,
    },
    select: {
      id: true,
      title: true,
      status: true,
      scaleId: true,
      questionId: true,
    },
  });

  if (auditLogModel?.create) {
    await auditLogModel.create({
      data: {
        organizationId: record.organizationId || null,
        actorType: "ADMIN",
        actorAdminId: input.adminId,
        targetType: "QUESTION_EXPLANATION",
        targetId: record.id,
        action:
          input.action === "approve"
            ? "QUESTION_EXPLANATION_APPROVED"
            : "QUESTION_EXPLANATION_REJECTED",
        details: {
          title: record.title || null,
          scaleId: record.scaleId,
          questionId: record.questionId,
          nextStatus,
          reviewNotes: input.reviewNotes?.trim() || null,
        },
      },
    });
  }

  return {
    itemType: "QUESTION_EXPLANATION" as const,
    itemId: updated.id,
    title: updated.title || `${updated.scaleId} · 第 ${updated.questionId} 题解释`,
    status: updated.status,
  };
}
