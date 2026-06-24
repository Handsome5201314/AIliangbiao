import { prisma } from "@/lib/db/prisma";
import { assertDoctorCanWriteMember, logPatientWriteAction } from "@/lib/services/care-teams";

type KnowledgeReviewStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";
type AssessmentReportStatus = "DRAFT" | "PENDING_DOCTOR_REVIEW" | "APPROVED" | "REJECTED" | "SUPERSEDED";
type DoctorReviewStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO" | "SUPERSEDED";

export type EducationContentMatchCandidate = {
  id: string;
  title: string;
  status: KnowledgeReviewStatus | string;
  scaleId?: string | null;
  riskLevel?: string | null;
  dimensionKey?: string | null;
  audience?: string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
  [key: string]: unknown;
};

type EducationContentMatch = EducationContentMatchCandidate & {
  matchScore: number;
  matchReasons: string[];
};

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalJson(value: unknown) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function toTime(value?: Date | string | null) {
  if (!value) {
    return 0;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function matchesNullableFilter(candidateValue: string | null | undefined, expected?: string | null) {
  return !candidateValue || !expected || candidateValue === expected;
}

function scoreEducationContentMatch(input: {
  content: EducationContentMatchCandidate;
  scaleId?: string | null;
  riskLevel?: string | null;
  dimensionKeys: string[];
  audience?: string | null;
}) {
  const reasons: string[] = [];
  let score = 0;

  if (input.content.audience && input.audience && input.content.audience !== input.audience) {
    return null;
  }

  if (!matchesNullableFilter(input.content.scaleId, input.scaleId)) {
    return null;
  }
  if (!matchesNullableFilter(input.content.riskLevel, input.riskLevel)) {
    return null;
  }
  if (input.content.dimensionKey && !input.dimensionKeys.includes(input.content.dimensionKey)) {
    return null;
  }

  if (input.content.scaleId && input.content.scaleId === input.scaleId) {
    score += 10;
    reasons.push("scale");
  }
  if (input.content.riskLevel && input.content.riskLevel === input.riskLevel) {
    score += 6;
    reasons.push("risk");
  }
  if (input.content.dimensionKey && input.dimensionKeys.includes(input.content.dimensionKey)) {
    score += 8;
    reasons.push("dimension");
  }
  if (!input.content.scaleId) {
    score += 1;
    reasons.push("general");
  }

  return {
    score,
    reasons: reasons.length ? reasons : ["approved_fallback"],
  };
}

export function selectApprovedEducationContentMatches(input: {
  contents: EducationContentMatchCandidate[];
  scaleId?: string | null;
  riskLevel?: string | null;
  dimensionKeys?: string[] | null;
  audience?: string | null;
  limit?: number;
}): EducationContentMatch[] {
  const dimensionKeys = input.dimensionKeys?.filter(Boolean) || [];

  return input.contents
    .filter((content) => content.status === "APPROVED")
    .map((content) => {
      const match = scoreEducationContentMatch({
        content,
        scaleId: input.scaleId,
        riskLevel: input.riskLevel,
        dimensionKeys,
        audience: input.audience || "caregiver",
      });

      return match
        ? {
            ...content,
            matchScore: match.score,
            matchReasons: match.reasons,
          }
        : null;
    })
    .filter((item): item is EducationContentMatch => Boolean(item))
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore;
      }
      return toTime(right.updatedAt || right.createdAt) - toTime(left.updatedAt || left.createdAt);
    })
    .slice(0, input.limit || 5);
}

export function assertCanCreateFormalEducationDelivery(input: {
  reportStatus: AssessmentReportStatus | string;
  doctorReviewStatus: DoctorReviewStatus | string;
}) {
  if (input.reportStatus !== "APPROVED" || input.doctorReviewStatus !== "APPROVED") {
    throw new Error("正式健康教育必须在医生复核通过并生成已批准正式报告后触达");
  }
}

function deriveRiskLevel(value: unknown) {
  const text = String(value || "");
  if (/重度|高度|高风险|明显|severe|high/i.test(text)) {
    return "high";
  }
  if (/中度|建议|关注|moderate/i.test(text)) {
    return "moderate";
  }
  if (/低|正常|通过|low/i.test(text)) {
    return "low";
  }
  return null;
}

function deriveDimensionKeys(value: unknown) {
  const keys = new Set<string>();
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const details = value as Record<string, unknown>;
    const dimensions = details.dimensions;
    if (typeof dimensions === "object" && dimensions !== null && !Array.isArray(dimensions)) {
      Object.keys(dimensions).forEach((key) => keys.add(key));
    }
  }
  return Array.from(keys);
}

function readReportSnapshotResult(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const snapshot = value as Record<string, unknown>;
  const result = snapshot.result;
  return typeof result === "object" && result !== null && !Array.isArray(result)
    ? (result as Record<string, unknown>)
    : {};
}

async function assertSourceDocApproved(sourceDocId?: string | null) {
  if (!sourceDocId) {
    return;
  }

  const sourceDoc = await prisma.knowledgeDoc.findUnique({
    where: { id: sourceDocId },
    select: { id: true, status: true },
  });

  if (!sourceDoc) {
    throw new Error("健康教育来源知识文档不存在");
  }
  if (sourceDoc.status !== "APPROVED") {
    throw new Error("健康教育来源知识文档必须先通过人工审核");
  }
}

export async function listDoctorEducationContents(input: {
  doctorProfileId: string;
  status?: KnowledgeReviewStatus | "ALL";
}) {
  return prisma.educationContent.findMany({
    where: {
      createdByDoctorProfileId: input.doctorProfileId,
      ...(input.status && input.status !== "ALL" ? { status: input.status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function createEducationContentDraft(input: {
  doctorProfileId: string;
  title: string;
  contentMd: string;
  summary?: string | null;
  scaleId?: string | null;
  dimensionKey?: string | null;
  riskLevel?: string | null;
  audience?: string | null;
  sourceDocId?: string | null;
  metadata?: unknown;
}) {
  const title = input.title.trim();
  const contentMd = input.contentMd.trim();
  if (!title) {
    throw new Error("健康教育标题不能为空");
  }
  if (!contentMd) {
    throw new Error("健康教育内容不能为空");
  }

  await assertSourceDocApproved(input.sourceDocId);

  const created = await prisma.educationContent.create({
    data: {
      title,
      contentMd,
      summary: normalizeOptionalText(input.summary),
      status: "DRAFT",
      scaleId: normalizeOptionalText(input.scaleId),
      dimensionKey: normalizeOptionalText(input.dimensionKey),
      riskLevel: normalizeOptionalText(input.riskLevel),
      audience: normalizeOptionalText(input.audience) || "caregiver",
      sourceDocId: normalizeOptionalText(input.sourceDocId),
      createdByDoctorProfileId: input.doctorProfileId,
      metadata: normalizeOptionalJson(input.metadata),
    },
  });

  const auditLogModel = prisma.auditLog;
  if (auditLogModel?.create) {
    await auditLogModel.create({
      data: {
        actorType: "DOCTOR",
        actorDoctorProfileId: input.doctorProfileId,
        targetType: "EDUCATION_CONTENT",
        targetId: created.id,
        action: "EDUCATION_CONTENT_DRAFT_CREATED",
        details: {
          title: created.title,
          scaleId: created.scaleId,
          riskLevel: created.riskLevel,
        },
      },
    });
  }

  return created;
}

export async function submitEducationContentForReview(input: {
  doctorProfileId: string;
  educationContentId: string;
}) {
  const content = await prisma.educationContent.findFirst({
    where: {
      id: input.educationContentId,
      createdByDoctorProfileId: input.doctorProfileId,
    },
    select: {
      id: true,
      title: true,
      status: true,
      sourceDocId: true,
    },
  });

  if (!content) {
    throw new Error("健康教育内容不存在或无权提交");
  }
  if (!["DRAFT", "REJECTED"].includes(content.status)) {
    throw new Error("只有草稿或已驳回的健康教育内容可以提交审核");
  }

  await assertSourceDocApproved(content.sourceDocId);

  const updated = await prisma.educationContent.update({
    where: { id: content.id },
    data: {
      status: "PENDING_REVIEW",
      reviewedByAdminId: null,
      reviewedAt: null,
      reviewComment: null,
    },
  });

  const auditLogModel = prisma.auditLog;
  if (auditLogModel?.create) {
    await auditLogModel.create({
      data: {
        actorType: "DOCTOR",
        actorDoctorProfileId: input.doctorProfileId,
        targetType: "EDUCATION_CONTENT",
        targetId: content.id,
        action: "EDUCATION_CONTENT_SUBMITTED_REVIEW",
        details: {
          title: content.title,
          previousStatus: content.status,
          nextStatus: updated.status,
        },
      },
    });
  }

  return updated;
}

async function findApprovedAssessmentReport(input: {
  memberId: string;
  assessmentReportId?: string | null;
  assessmentHistoryId?: string | null;
}) {
  if (!input.assessmentReportId && !input.assessmentHistoryId) {
    throw new Error("缺少正式报告或评估记录 ID");
  }

  const where = input.assessmentReportId
    ? { id: input.assessmentReportId, memberProfileId: input.memberId }
    : {
        assessmentHistoryId: input.assessmentHistoryId,
        memberProfileId: input.memberId,
        reportStatus: "APPROVED" as const,
      };

  return prisma.assessmentReport.findFirst({
    where,
    include: {
      doctorReview: {
        select: {
          id: true,
          status: true,
        },
      },
      assessmentHistory: {
        select: {
          id: true,
          profileId: true,
          scaleId: true,
          conclusion: true,
          resultDetails: true,
          createdAt: true,
        },
      },
      assessmentSession: {
        select: {
          id: true,
          scaleId: true,
        },
      },
    },
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function createEducationDeliveriesForApprovedReport(input: {
  doctorProfileId: string;
  memberId: string;
  assessmentReportId?: string | null;
  assessmentHistoryId?: string | null;
  limit?: number;
}) {
  await assertDoctorCanWriteMember(input.memberId, input.doctorProfileId);

  const report = await findApprovedAssessmentReport(input);
  if (!report) {
    throw new Error("未找到已批准的正式报告，不能触达健康教育");
  }

  assertCanCreateFormalEducationDelivery({
    reportStatus: report.reportStatus,
    doctorReviewStatus: report.doctorReview?.status,
  });

  const assessment = report.assessmentHistory;
  const scaleId = report.scaleId || assessment?.scaleId || report.assessmentSession?.scaleId || null;
  const snapshotResult = readReportSnapshotResult(report.reportSnapshot);
  const riskLevel = deriveRiskLevel(snapshotResult.riskLevel || snapshotResult.conclusion || assessment?.conclusion);
  const dimensionKeys = deriveDimensionKeys(assessment?.resultDetails);

  const candidates = await prisma.educationContent.findMany({
    where: {
      status: "APPROVED",
      audience: "caregiver",
      OR: [{ scaleId }, { scaleId: null }],
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const matches = selectApprovedEducationContentMatches({
    contents: candidates,
    scaleId,
    riskLevel,
    dimensionKeys,
    audience: "caregiver",
    limit: input.limit || 5,
  });

  const now = new Date();
  const deliveries = [];
  for (const match of matches) {
    const existing = await prisma.educationDelivery.findFirst({
      where: {
        educationContentId: match.id,
        assessmentReportId: report.id,
        memberProfileId: input.memberId,
      },
    });

    if (existing) {
      deliveries.push(existing);
      continue;
    }

    const created = await prisma.educationDelivery.create({
      data: {
        educationContentId: match.id,
        memberProfileId: input.memberId,
        assessmentReportId: report.id,
        assessmentHistoryId: report.assessmentHistoryId || assessment?.id || null,
        assessmentSessionId: report.assessmentSessionId || report.assessmentSession?.id || null,
        doctorProfileId: input.doctorProfileId,
        deliveryStatus: "DELIVERED",
        deliveredAt: now,
        metadata: {
          channel: "IN_APP_REPORT",
          matchScore: match.matchScore,
          matchReasons: match.matchReasons,
          source: "approved_education_content",
        },
      },
    });
    deliveries.push(created);
  }

  await prisma.aiDecisionLog.create({
    data: {
      memberProfileId: input.memberId,
      assessmentHistoryId: report.assessmentHistoryId || assessment?.id || null,
      assessmentSessionId: report.assessmentSessionId || report.assessmentSession?.id || null,
      doctorProfileId: input.doctorProfileId,
      decisionType: "EDUCATION_MATCH",
      modelName: "deterministic-approved-content-matcher",
      inputSummary: JSON.stringify({
        scaleId,
        riskLevel,
        dimensionKeys,
      }),
      outputSummary: JSON.stringify({
        matchedContentIds: matches.map((item) => item.id),
      }),
      confidence: matches.length ? 1 : 0,
      reviewRequired: true,
      metadata: {
        reportId: report.id,
        candidateCount: candidates.length,
        matchedCount: matches.length,
      },
    },
  });

  await logPatientWriteAction({
    actorDoctorProfileId: input.doctorProfileId,
    memberId: input.memberId,
    action: "EDUCATION_DELIVERED",
    metadata: {
      assessmentReportId: report.id,
      assessmentHistoryId: report.assessmentHistoryId || assessment?.id || null,
      deliveryCount: deliveries.length,
    },
  });

  return {
    reportId: report.id,
    matches,
    deliveries,
  };
}

export async function listDoctorPatientEducationDeliveries(input: {
  doctorProfileId: string;
  memberId: string;
}) {
  await assertDoctorCanWriteMember(input.memberId, input.doctorProfileId);

  return prisma.educationDelivery.findMany({
    where: {
      memberProfileId: input.memberId,
    },
    include: {
      educationContent: true,
      assessmentReport: {
        select: {
          id: true,
          reportNo: true,
          approvedAt: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function markEducationDeliveryRead(input: {
  userId: string;
  deliveryId: string;
  confirmed?: boolean;
}) {
  const delivery = await prisma.educationDelivery.findFirst({
    where: {
      id: input.deliveryId,
      memberProfile: {
        userId: input.userId,
      },
    },
    select: {
      id: true,
      deliveryStatus: true,
      readAt: true,
      confirmedAt: true,
    },
  });

  if (!delivery) {
    throw new Error("健康教育触达记录不存在或无权访问");
  }

  const now = new Date();
  return prisma.educationDelivery.update({
    where: { id: delivery.id },
    data: {
      deliveryStatus: input.confirmed ? "CONFIRMED" : delivery.deliveryStatus === "CONFIRMED" ? "CONFIRMED" : "READ",
      readAt: now,
      confirmedAt: input.confirmed ? delivery.confirmedAt || now : delivery.confirmedAt,
    },
  });
}
