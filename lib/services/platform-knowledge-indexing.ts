import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type PlatformKnowledgeScopeType = "PLATFORM" | "ORGANIZATION" | "DOCTOR";

export type PlatformKnowledgeRetrievalMatch = {
  chunkId: string;
  chunkIndex: number;
  docId: string;
  docTitle: string;
  scopeType: PlatformKnowledgeScopeType;
  contentText: string;
  score: number;
};

type RetrievalQueryInput = {
  queryText: string;
  organizationId?: string | null;
  doctorProfileId?: string | null;
  attendingDoctorProfileId?: string | null;
  limit?: number;
};

type EmbeddingApiResponse = {
  data?: Array<{
    embedding?: unknown;
    index?: number;
  }>;
};

const DEFAULT_EMBEDDING_ENDPOINT = "https://api.openai.com/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_RETRIEVAL_LIMIT = 8;

function getKnowledgeEmbeddingConfig() {
  const apiKey = process.env.PLATFORM_KNOWLEDGE_EMBEDDING_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("PLATFORM_KNOWLEDGE_EMBEDDING_API_KEY is not configured");
  }

  return {
    apiKey,
    endpoint:
      process.env.PLATFORM_KNOWLEDGE_EMBEDDING_ENDPOINT?.trim() || DEFAULT_EMBEDDING_ENDPOINT,
    model: process.env.PLATFORM_KNOWLEDGE_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
  };
}

function normalizeEmbeddingVector(vector: unknown) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Embedding provider returned an empty vector");
  }

  return vector.map((value) => {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      throw new Error("Embedding provider returned a non-finite vector value");
    }
    return numberValue;
  });
}

function serializePgVector(vector: number[]) {
  return `[${vector.map((value) => Number(value).toString()).join(",")}]`;
}

async function generateKnowledgeEmbeddings(texts: string[]) {
  if (!texts.length) {
    return [];
  }

  const config = getKnowledgeEmbeddingConfig();
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: texts,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Knowledge embedding request failed with ${response.status}: ${message.slice(0, 300)}`
    );
  }

  const payload = (await response.json()) as EmbeddingApiResponse;
  const rows = Array.isArray(payload.data) ? [...payload.data] : [];
  rows.sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0));

  const embeddings = rows.map((item) => normalizeEmbeddingVector(item.embedding));
  if (embeddings.length !== texts.length) {
    throw new Error("Embedding provider returned a mismatched number of vectors");
  }

  return embeddings;
}

function uniqueDoctorProfileIds(input: {
  doctorProfileId?: string | null;
  attendingDoctorProfileId?: string | null;
}) {
  return Array.from(
    new Set([input.doctorProfileId, input.attendingDoctorProfileId].filter(Boolean))
  ) as string[];
}

export async function indexKnowledgeDocChunks(docId: string) {
  const knowledgeChunkModel = (prisma as any).knowledgeChunk;
  if (!knowledgeChunkModel?.findMany) {
    throw new Error("KnowledgeChunk model is not available");
  }

  const chunks = await knowledgeChunkModel.findMany({
    where: { docId },
    orderBy: [{ chunkIndex: "asc" }],
    select: {
      id: true,
      chunkIndex: true,
      contentText: true,
    },
  });

  if (!chunks.length) {
    return 0;
  }

  const embeddings = await generateKnowledgeEmbeddings(
    chunks.map((chunk: { contentText: string }) => chunk.contentText)
  );

  for (const [index, chunk] of chunks.entries()) {
    const vectorLiteral = serializePgVector(embeddings[index] || []);
    await (prisma as any).$executeRaw(
      Prisma.sql`
        UPDATE "KnowledgeChunk"
        SET "embedding" = ${vectorLiteral}::vector,
            "updatedAt" = NOW()
        WHERE "id" = ${chunk.id}
      `
    );
  }

  return chunks.length;
}

export async function retrieveKnowledgeChunksByVector(
  input: RetrievalQueryInput
): Promise<PlatformKnowledgeRetrievalMatch[]> {
  const queryText = input.queryText.trim();
  if (!queryText) {
    return [];
  }

  const [queryVector] = await generateKnowledgeEmbeddings([queryText]);
  const vectorLiteral = serializePgVector(queryVector || []);
  const doctorProfileIds = uniqueDoctorProfileIds(input);
  const organizationClause = input.organizationId
    ? Prisma.sql`
        OR (
          kd."scopeType" = 'ORGANIZATION'
          AND kd."organizationId" = ${input.organizationId}
        )
      `
    : Prisma.empty;
  const doctorClause = doctorProfileIds.length
    ? Prisma.sql`
        OR (
          kd."scopeType" = 'DOCTOR'
          AND kd."doctorProfileId" IN (${Prisma.join(doctorProfileIds)})
        )
      `
    : Prisma.empty;

  const rows = (await (prisma as any).$queryRaw(
    Prisma.sql`
      SELECT
        kc."id" AS "chunkId",
        kc."chunkIndex" AS "chunkIndex",
        kc."contentText" AS "contentText",
        kd."id" AS "docId",
        kd."title" AS "docTitle",
        kd."scopeType" AS "scopeType",
        1 - (kc."embedding" <=> ${vectorLiteral}::vector) AS "score"
      FROM "KnowledgeChunk" kc
      INNER JOIN "KnowledgeDoc" kd ON kd."id" = kc."docId"
      WHERE kd."status" = 'APPROVED'
        AND kc."embedding" IS NOT NULL
        AND (
          kd."scopeType" = 'PLATFORM'
          ${organizationClause}
          ${doctorClause}
        )
      ORDER BY kc."embedding" <=> ${vectorLiteral}::vector
      LIMIT ${input.limit || DEFAULT_RETRIEVAL_LIMIT}
    `
  )) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    chunkId: String(row.chunkId || ""),
    chunkIndex: Number(row.chunkIndex || 0),
    docId: String(row.docId || ""),
    docTitle: String(row.docTitle || "知识文档"),
    scopeType: String(row.scopeType || "PLATFORM") as PlatformKnowledgeScopeType,
    contentText: String(row.contentText || ""),
    score: Number(row.score || 0),
  }));
}
