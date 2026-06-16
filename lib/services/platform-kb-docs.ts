import { prisma } from "@/lib/db/prisma";

export type PlatformKnowledgeDocScopeType = "PLATFORM" | "ORGANIZATION" | "DOCTOR";

type DoctorKnowledgeDocActor = {
  kind: "doctor";
  userId: string;
  doctorProfileId: string;
  organizationId?: string | null;
  isOrganizationOwner?: boolean;
};

type AdminKnowledgeDocActor = {
  kind: "admin";
  adminId: string;
};

export type PlatformKnowledgeDocActor = DoctorKnowledgeDocActor | AdminKnowledgeDocActor;

type ListPlatformKnowledgeDocsInput = {
  actor: PlatformKnowledgeDocActor;
  status?: "ALL" | "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";
  query?: string;
  limit?: number;
};

type CreatePlatformKnowledgeDocInput = {
  actor: PlatformKnowledgeDocActor;
  title: string;
  summary?: string | null;
  rawMd: string;
  language?: string | null;
  sourceFileName?: string | null;
  scopeType?: PlatformKnowledgeDocScopeType;
  organizationId?: string | null;
  doctorProfileId?: string | null;
};

type SubmitPlatformKnowledgeDocReviewInput = {
  actor: PlatformKnowledgeDocActor;
  knowledgeDocId: string;
};

function buildMarkdownChunks(rawMd: string) {
  const normalized = rawMd
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const segments = normalized.length ? normalized : [rawMd.trim()].filter(Boolean);
  return segments.length ? segments : ["空文档"];
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildKnowledgeDocSlug(title: string) {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z\u4e00-\u9fff]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || null;
}

function countChunkTokens(contentText: string) {
  return contentText
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;
}

function resolveScopeForCreate(input: CreatePlatformKnowledgeDocInput) {
  if (input.actor.kind === "admin") {
    const scopeType = input.scopeType || "PLATFORM";
    if (scopeType === "DOCTOR" && !input.doctorProfileId) {
      throw new Error("医生作用域知识文档必须绑定 doctorProfileId");
    }
    if (scopeType === "ORGANIZATION" && !input.organizationId) {
      throw new Error("机构作用域知识文档必须绑定 organizationId");
    }

    return {
      scopeType,
      organizationId: scopeType === "ORGANIZATION" ? input.organizationId || null : null,
      doctorProfileId: scopeType === "DOCTOR" ? input.doctorProfileId || null : null,
    };
  }

  const requestedScope = input.scopeType || "DOCTOR";
  if (requestedScope === "ORGANIZATION") {
    if (!input.actor.organizationId) {
      throw new Error("当前医生未归属机构，不能创建机构知识文档");
    }
    if (!input.actor.isOrganizationOwner) {
      throw new Error("只有机构负责人医生才能创建机构知识文档");
    }

    return {
      scopeType: "ORGANIZATION" as const,
      organizationId: input.actor.organizationId,
      doctorProfileId: input.actor.doctorProfileId,
    };
  }

  if (requestedScope === "PLATFORM") {
    throw new Error("医生不能直接创建平台级知识文档");
  }

  return {
    scopeType: "DOCTOR" as const,
    organizationId: input.actor.organizationId || null,
    doctorProfileId: input.actor.doctorProfileId,
  };
}

function buildActorFilter(actor: PlatformKnowledgeDocActor) {
  if (actor.kind === "admin") {
    return {};
  }

  const doctorScopeFilters: Array<Record<string, unknown>> = [
    { doctorProfileId: actor.doctorProfileId },
  ];

  if (actor.organizationId) {
    doctorScopeFilters.push({
      scopeType: "ORGANIZATION",
      organizationId: actor.organizationId,
    });
  }

  return {
    OR: doctorScopeFilters,
  };
}

function mapKnowledgeDocListItem(record: any) {
  return {
    id: record.id,
    title: record.title,
    summary: record.summary || null,
    rawMdPreview: record.rawMd.length > 180 ? `${record.rawMd.slice(0, 177)}...` : record.rawMd,
    language: record.language || "zh",
    status: record.status,
    scopeType: record.scopeType,
    sourceFileName: record.sourceFileName || null,
    chunkCount: typeof record.chunkCount === "number" ? record.chunkCount : 0,
    organizationId: record.organizationId || null,
    doctorProfileId: record.doctorProfileId || null,
    uploadedByUserId: record.uploadedByUserId || null,
    reviewedByAdminId: record.reviewedByAdminId || null,
    reviewedAt: record.reviewedAt || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function listPlatformKnowledgeDocs(input: ListPlatformKnowledgeDocsInput) {
  const knowledgeDocModel = (prisma as any).knowledgeDoc;
  if (!knowledgeDocModel?.findMany) {
    throw new Error("KnowledgeDoc model is not available");
  }

  const query = input.query?.trim();
  const docs = await knowledgeDocModel.findMany({
    where: {
      ...buildActorFilter(input.actor),
      ...(input.status && input.status !== "ALL" ? { status: input.status } : {}),
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
    take: input.limit || 100,
    select: {
      id: true,
      title: true,
      summary: true,
      rawMd: true,
      language: true,
      status: true,
      scopeType: true,
      sourceFileName: true,
      chunkCount: true,
      organizationId: true,
      doctorProfileId: true,
      uploadedByUserId: true,
      reviewedByAdminId: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return docs.map(mapKnowledgeDocListItem);
}

export async function createPlatformKnowledgeDoc(input: CreatePlatformKnowledgeDocInput) {
  const knowledgeDocModel = (prisma as any).knowledgeDoc;
  if (!knowledgeDocModel?.create) {
    throw new Error("KnowledgeDoc model is not available");
  }

  const title = input.title.trim();
  const rawMd = input.rawMd.trim();
  if (!title) {
    throw new Error("知识文档标题不能为空");
  }
  if (!rawMd) {
    throw new Error("知识文档内容不能为空");
  }

  const scope = resolveScopeForCreate(input);
  const chunks = buildMarkdownChunks(rawMd);
  const created = await knowledgeDocModel.create({
    data: {
      title,
      slug: buildKnowledgeDocSlug(title),
      summary: normalizeOptionalText(input.summary),
      sourceType: "MARKDOWN",
      rawMd,
      renderedHtml: null,
      language: normalizeOptionalText(input.language) || "zh",
      sourceFileName: normalizeOptionalText(input.sourceFileName),
      status: "DRAFT",
      scopeType: scope.scopeType,
      organizationId: scope.organizationId,
      doctorProfileId: scope.doctorProfileId,
      uploadedByUserId: input.actor.kind === "doctor" ? input.actor.userId : null,
      reviewComment: null,
      metadataJson: {},
      chunkCount: chunks.length,
      chunks: {
        create: chunks.map((contentText, index) => ({
          chunkIndex: index,
          scaleId: null,
          questionId: null,
          contentText,
          searchText: contentText,
          tokenCount: countChunkTokens(contentText),
          metadataJson: {},
        })),
      },
    },
    select: {
      id: true,
      title: true,
      summary: true,
      rawMd: true,
      language: true,
      status: true,
      scopeType: true,
      sourceFileName: true,
      chunkCount: true,
      organizationId: true,
      doctorProfileId: true,
      uploadedByUserId: true,
      reviewedByAdminId: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const auditLogModel = (prisma as any).auditLog;
  if (auditLogModel?.create) {
    await auditLogModel.create({
      data: {
        organizationId: scope.organizationId || null,
        actorType: input.actor.kind === "doctor" ? "DOCTOR" : "ADMIN",
        actorUserId: input.actor.kind === "doctor" ? input.actor.userId : null,
        actorDoctorProfileId: input.actor.kind === "doctor" ? input.actor.doctorProfileId : null,
        actorAdminId: input.actor.kind === "admin" ? input.actor.adminId : null,
        targetType: "KNOWLEDGE_DOC",
        targetId: created.id,
        action: "KNOWLEDGE_DOC_CREATED",
        details: {
          title: created.title,
          scopeType: created.scopeType,
          chunkCount: created.chunkCount,
        },
      },
    });
  }

  return mapKnowledgeDocListItem(created);
}

export async function submitPlatformKnowledgeDocForReview(
  input: SubmitPlatformKnowledgeDocReviewInput
) {
  const knowledgeDocModel = (prisma as any).knowledgeDoc;
  if (!knowledgeDocModel?.findUnique || !knowledgeDocModel?.update) {
    throw new Error("KnowledgeDoc model is not available");
  }

  const record = await knowledgeDocModel.findUnique({
    where: { id: input.knowledgeDocId },
    select: {
      id: true,
      title: true,
      status: true,
      organizationId: true,
      doctorProfileId: true,
      uploadedByUserId: true,
    },
  });

  if (!record) {
    throw new Error("知识文档不存在");
  }

  if (input.actor.kind === "doctor") {
    const canManageAsOwner =
      record.doctorProfileId === input.actor.doctorProfileId ||
      record.uploadedByUserId === input.actor.userId;
    const canManageAsOrgOwner =
      Boolean(input.actor.organizationId) &&
      Boolean(input.actor.isOrganizationOwner) &&
      record.organizationId === input.actor.organizationId;

    if (!canManageAsOwner && !canManageAsOrgOwner) {
      throw new Error("只能提交自己或本机构负责的知识文档");
    }
  }

  if (!["DRAFT", "REJECTED"].includes(record.status)) {
    throw new Error("只有草稿或已驳回的知识文档可以提交审核");
  }

  const updated = await knowledgeDocModel.update({
    where: { id: input.knowledgeDocId },
    data: {
      status: "PENDING_REVIEW",
      reviewedByAdminId: null,
      reviewedAt: null,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      rawMd: true,
      language: true,
      status: true,
      scopeType: true,
      sourceFileName: true,
      chunkCount: true,
      organizationId: true,
      doctorProfileId: true,
      uploadedByUserId: true,
      reviewedByAdminId: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const auditLogModel = (prisma as any).auditLog;
  if (auditLogModel?.create) {
    await auditLogModel.create({
      data: {
        organizationId: record.organizationId || null,
        actorType: input.actor.kind === "doctor" ? "DOCTOR" : "ADMIN",
        actorUserId: input.actor.kind === "doctor" ? input.actor.userId : null,
        actorDoctorProfileId: input.actor.kind === "doctor" ? input.actor.doctorProfileId : null,
        actorAdminId: input.actor.kind === "admin" ? input.actor.adminId : null,
        targetType: "KNOWLEDGE_DOC",
        targetId: updated.id,
        action: "KNOWLEDGE_DOC_SUBMITTED_REVIEW",
        details: {
          title: updated.title,
          previousStatus: record.status,
          nextStatus: updated.status,
        },
      },
    });
  }

  return mapKnowledgeDocListItem(updated);
}
