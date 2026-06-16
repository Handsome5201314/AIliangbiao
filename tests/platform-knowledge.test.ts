import test from "node:test";
import assert from "node:assert/strict";

import { issueAgentSessionToken } from "../lib/assessment-skill/auth";
import {
  composeQuestionExplanationView,
  getQuestionExplanation,
} from "../lib/services/platform-knowledge";

test("agent session token carries tenant metadata for platform knowledge routing", () => {
  const issued = issueAgentSessionToken({
    userId: "user-1",
    memberId: "member-1",
    role: "REGISTERED",
    deviceId: "device-1",
    accountType: "PATIENT",
    entrypoint: "agent",
    organizationId: "org-1",
    hermesProfileId: "hermes-1",
    channel: "wechat_h5",
    tenantRole: "PATIENT_MEMBER",
  });

  assert.equal(issued.payload.organization_id, "org-1");
  assert.equal(issued.payload.hermes_profile_id, "hermes-1");
  assert.equal(issued.payload.channel, "wechat_h5");
  assert.equal(issued.payload.tenant_role, "PATIENT_MEMBER");
});

test("composeQuestionExplanationView keeps platform standard first and separates doctor and organization supplements", () => {
  const view = composeQuestionExplanationView({
    scaleId: "GAD-7",
    scaleTitle: "广泛性焦虑量表 (GAD-7)",
    question: {
      id: 1,
      text: "感到紧张、焦虑或急切。",
      colloquial: "最近两周，会不会老是觉得紧张、绷着、心里发慌？",
      standardExplanation: "这道题关注持续性紧张和焦虑张力，是整份量表的基础判断点。",
    },
    language: "zh",
    customExplanations: [
      {
        id: "org-explanation",
        scopeType: "ORGANIZATION",
        title: "机构补充",
        contentMd: "在门诊场景里，我们更关注是否已经影响到睡眠和日常功能。",
        priority: 20,
      },
      {
        id: "doctor-explanation",
        scopeType: "DOCTOR",
        title: "医生补充",
        contentMd: "如果孩子也会描述自己总是紧绷，可以同步记录诱因和出现频率。",
        priority: 10,
      },
    ],
  });

  assert.equal(
    view.exact.platform.content,
    "这道题关注持续性紧张和焦虑张力，是整份量表的基础判断点。"
  );
  assert.deepEqual(view.exact.doctor.map((item) => item.id), ["doctor-explanation"]);
  assert.deepEqual(view.exact.organization.map((item) => item.id), ["org-explanation"]);
  assert.equal(view.question.id, 1);
  assert.equal(view.scale.id, "GAD-7");
  assert.deepEqual(view.retrieval, []);
});

test("question explanation service should append approved retrieval supplements after exact explanations", async () => {
  const { prisma } = await import("../lib/db/prisma");
  const questionExplanationModel = (prisma as any).questionExplanation;
  const knowledgeChunkModel = (prisma as any).knowledgeChunk;
  const originalQueryRaw = (prisma as any).$queryRaw;
  const originalFetch = global.fetch;
  const previousEmbeddingApiKey = process.env.PLATFORM_KNOWLEDGE_EMBEDDING_API_KEY;
  const previousEmbeddingEndpoint = process.env.PLATFORM_KNOWLEDGE_EMBEDDING_ENDPOINT;
  const previousEmbeddingModel = process.env.PLATFORM_KNOWLEDGE_EMBEDDING_MODEL;

  const originalQuestionExplanationFindMany = questionExplanationModel?.findMany;
  const originalKnowledgeChunkFindMany = knowledgeChunkModel?.findMany;

  if (!questionExplanationModel || !knowledgeChunkModel) {
    throw new Error("Required Prisma models are unavailable");
  }

  questionExplanationModel.findMany = async () => [];
  knowledgeChunkModel.findMany = async () => {
    throw new Error("vector retrieval should not use keyword chunk scanning");
  };
  process.env.PLATFORM_KNOWLEDGE_EMBEDDING_API_KEY = "test-embedding-key";
  process.env.PLATFORM_KNOWLEDGE_EMBEDDING_ENDPOINT = "https://embedding.example/v1/embeddings";
  process.env.PLATFORM_KNOWLEDGE_EMBEDDING_MODEL = "text-embedding-test";

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), "https://embedding.example/v1/embeddings");
    assert.match(String(init?.body || ""), /text-embedding-test/);
    return new Response(
      JSON.stringify({
        data: [
          {
            embedding: [0.12, 0.34, 0.56],
          },
        ],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }) as typeof global.fetch;

  (prisma as any).$queryRaw = async (...args: any[]) => {
    assert.ok(args[0], "vector retrieval should execute a raw pgvector query");
    return [
      {
        id: "chunk-platform",
        chunkIndex: 0,
        contentText: "这段平台知识强调持续紧张、焦虑和睡眠受影响时需要进一步追问严重度。",
        docId: "doc-platform",
        docTitle: "平台焦虑问诊提示",
        scopeType: "PLATFORM",
      },
      {
        id: "chunk-doctor",
        chunkIndex: 2,
        contentText: "医生补充建议：如果家长反映孩子持续紧张、总是发慌，可以同步记录诱因和持续时间。",
        docId: "doc-doctor",
        docTitle: "医生门诊补充",
        scopeType: "DOCTOR",
      },
    ];
  };

  try {
    const explanation = await getQuestionExplanation({
      scaleId: "GAD-7",
      questionId: 1,
      language: "zh",
      doctorProfileId: "doctor-1",
    });

    assert.ok(explanation.retrieval.length >= 2);
    assert.ok(
      explanation.retrieval.some((item) => item.docId === "doc-platform"),
      "approved platform chunks should be included"
    );
    assert.ok(
      explanation.retrieval.some((item) => item.docId === "doc-doctor"),
      "approved doctor chunks should be included"
    );
    assert.ok(
      explanation.references.some((item) => item.id === "doc-platform"),
      "retrieval docs should also appear in the references list"
    );
  } finally {
    questionExplanationModel.findMany = originalQuestionExplanationFindMany;
    knowledgeChunkModel.findMany = originalKnowledgeChunkFindMany;
    (prisma as any).$queryRaw = originalQueryRaw;
    global.fetch = originalFetch;
    if (previousEmbeddingApiKey === undefined) {
      delete process.env.PLATFORM_KNOWLEDGE_EMBEDDING_API_KEY;
    } else {
      process.env.PLATFORM_KNOWLEDGE_EMBEDDING_API_KEY = previousEmbeddingApiKey;
    }
    if (previousEmbeddingEndpoint === undefined) {
      delete process.env.PLATFORM_KNOWLEDGE_EMBEDDING_ENDPOINT;
    } else {
      process.env.PLATFORM_KNOWLEDGE_EMBEDDING_ENDPOINT = previousEmbeddingEndpoint;
    }
    if (previousEmbeddingModel === undefined) {
      delete process.env.PLATFORM_KNOWLEDGE_EMBEDDING_MODEL;
    } else {
      process.env.PLATFORM_KNOWLEDGE_EMBEDDING_MODEL = previousEmbeddingModel;
    }
  }
});

test("knowledge doc approval should generate embeddings before the document becomes approved", async () => {
  const { prisma } = await import("../lib/db/prisma");
  const { reviewKnowledgeItem } = await import("../lib/services/admin-knowledge-reviews");
  const knowledgeDocModel = (prisma as any).knowledgeDoc;
  const knowledgeChunkModel = (prisma as any).knowledgeChunk;
  const auditLogModel = (prisma as any).auditLog;
  const originalFindUnique = knowledgeDocModel?.findUnique;
  const originalUpdate = knowledgeDocModel?.update;
  const originalChunkFindMany = knowledgeChunkModel?.findMany;
  const originalAuditCreate = auditLogModel?.create;
  const originalExecuteRaw = (prisma as any).$executeRaw;
  const originalFetch = global.fetch;
  const previousEmbeddingApiKey = process.env.PLATFORM_KNOWLEDGE_EMBEDDING_API_KEY;
  const previousEmbeddingEndpoint = process.env.PLATFORM_KNOWLEDGE_EMBEDDING_ENDPOINT;
  const previousEmbeddingModel = process.env.PLATFORM_KNOWLEDGE_EMBEDDING_MODEL;

  if (!knowledgeDocModel || !knowledgeChunkModel || !auditLogModel) {
    throw new Error("Required Prisma models are unavailable");
  }

  knowledgeDocModel.findUnique = async () => ({
    id: "doc-approve-1",
    title: "焦虑问诊补充知识",
    organizationId: "org-1",
    status: "PENDING_REVIEW",
  });
  knowledgeChunkModel.findMany = async () => [
    {
      id: "chunk-1",
      chunkIndex: 0,
      contentText: "第一段补充知识",
    },
    {
      id: "chunk-2",
      chunkIndex: 1,
      contentText: "第二段补充知识",
    },
  ];
  const executeRawCalls: any[][] = [];
  (prisma as any).$executeRaw = async (...args: any[]) => {
    executeRawCalls.push(args);
    return 1;
  };
  knowledgeDocModel.update = async (args: any) => ({
    id: "doc-approve-1",
    title: "焦虑问诊补充知识",
    status: args.data.status,
  });
  auditLogModel.create = async () => null;

  process.env.PLATFORM_KNOWLEDGE_EMBEDDING_API_KEY = "test-embedding-key";
  process.env.PLATFORM_KNOWLEDGE_EMBEDDING_ENDPOINT = "https://embedding.example/v1/embeddings";
  process.env.PLATFORM_KNOWLEDGE_EMBEDDING_MODEL = "text-embedding-test";
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: [
          { embedding: [0.11, 0.22, 0.33] },
          { embedding: [0.44, 0.55, 0.66] },
        ],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )) as typeof global.fetch;

  try {
    const result = await reviewKnowledgeItem({
      itemType: "KNOWLEDGE_DOC",
      itemId: "doc-approve-1",
      action: "approve",
      adminId: "admin-1",
    });

    assert.equal(result.status, "APPROVED");
    assert.equal(executeRawCalls.length, 2);
  } finally {
    knowledgeDocModel.findUnique = originalFindUnique;
    knowledgeDocModel.update = originalUpdate;
    knowledgeChunkModel.findMany = originalChunkFindMany;
    auditLogModel.create = originalAuditCreate;
    (prisma as any).$executeRaw = originalExecuteRaw;
    global.fetch = originalFetch;
    if (previousEmbeddingApiKey === undefined) {
      delete process.env.PLATFORM_KNOWLEDGE_EMBEDDING_API_KEY;
    } else {
      process.env.PLATFORM_KNOWLEDGE_EMBEDDING_API_KEY = previousEmbeddingApiKey;
    }
    if (previousEmbeddingEndpoint === undefined) {
      delete process.env.PLATFORM_KNOWLEDGE_EMBEDDING_ENDPOINT;
    } else {
      process.env.PLATFORM_KNOWLEDGE_EMBEDDING_ENDPOINT = previousEmbeddingEndpoint;
    }
    if (previousEmbeddingModel === undefined) {
      delete process.env.PLATFORM_KNOWLEDGE_EMBEDDING_MODEL;
    } else {
      process.env.PLATFORM_KNOWLEDGE_EMBEDDING_MODEL = previousEmbeddingModel;
    }
  }
});

test("platform question explanation route should expose both agent-token GET and existing POST entry", async () => {
  const route = await import("../app/api/platform/v1/ai/explanations/question/route");
  assert.equal(typeof route.GET, "function");
  assert.equal(typeof route.POST, "function");
});

test("platform question explanation GET route should reject missing agent token", async () => {
  const route = await import("../app/api/platform/v1/ai/explanations/question/route");
  const response = await route.GET(
    new Request(
      "http://localhost/api/platform/v1/ai/explanations/question?scaleId=GAD-7&questionId=1"
    ) as any
  );

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.match(body.error, /Missing Bearer token/);
});

test("platform knowledge panel should call the platform explanation API", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("components/PlatformKnowledgePanel.tsx", "utf8");

  assert.match(source, /\/api\/platform\/v1\/ai\/explanations\/question/);
});

test("agent knowledge page should read scale and question params for platform explanations", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("app/agent/knowledge/page.tsx", "utf8");

  assert.match(source, /PlatformKnowledgePanel/);
  assert.match(source, /scaleId/);
  assert.match(source, /questionId/);
});

test("platform knowledge doc routes should exist for list, create, and submit-review", async () => {
  const docsRoute = await import("../app/api/platform/v1/kb/docs/route");
  const submitRoute = await import("../app/api/platform/v1/kb/docs/[id]/submit-review/route");

  assert.equal(typeof docsRoute.GET, "function");
  assert.equal(typeof docsRoute.POST, "function");
  assert.equal(typeof submitRoute.POST, "function");
});

test("platform knowledge doc service should create draft docs and support submit-review workflow", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("lib/services/platform-kb-docs.ts", "utf8");

  assert.match(source, /KNOWLEDGE_DOC_CREATED/);
  assert.match(source, /KNOWLEDGE_DOC_SUBMITTED_REVIEW/);
  assert.match(source, /chunks:/);
  assert.match(source, /PENDING_REVIEW/);
});
