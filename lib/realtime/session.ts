import type { NextRequest } from "next/server";

import { getRealtimeRuntimeConfig, type RealtimeSurface } from "@/lib/realtime/config";
import { listRealtimeToolDescriptors } from "@/lib/realtime/tools";
import { createDoctorBotBootstrapState } from "@/lib/realtime/doctor-bot-bootstrap";
import { resolveAgentChannel, resolveAgentSessionContext } from "@/lib/services/agent-session";
import { issueAgentSessionToken } from "@/lib/assessment-skill/auth";
import { getLatestActiveAssessmentSession } from "@/lib/assessment-skill/scale-service";
import { getMemberAssessmentSummary, getMemberContext } from "@/lib/assessment-skill/member-service";
import { getPublishedDoctorBotBySlug } from "@/lib/services/doctor-bot";

type MemberSnapshotInput = {
  nickname?: string;
  gender?: string;
  ageMonths?: number;
  relation?: string;
  languagePreference?: string;
  interests?: string[];
  fears?: string[];
  avatarConfig?: unknown;
};

type KnowledgeDefaultMode = "platform_proxy" | "direct_fastgpt";

function readHermesProfileRuntimeConfig(configJson: unknown) {
  const raw =
    configJson && typeof configJson === "object" && !Array.isArray(configJson)
      ? (configJson as Record<string, unknown>)
      : {};

  return {
    knowledgeDefaultMode:
      raw.knowledgeDefaultMode === "direct_fastgpt"
        ? ("direct_fastgpt" as const)
        : ("platform_proxy" as const),
    doctorBotFallbackEnabled: raw.doctorBotFallbackEnabled !== false,
  };
}

function resolveKnowledgeDefaultMode(input: {
  surface: RealtimeSurface;
  hermesProfileConfig?: unknown;
  doctorBotConfig?: { knowledgeMode?: KnowledgeDefaultMode | null } | null;
}) {
  if (input.surface === "doctor_bot") {
    return input.doctorBotConfig?.knowledgeMode || "platform_proxy";
  }

  return readHermesProfileRuntimeConfig(input.hermesProfileConfig).knowledgeDefaultMode;
}

export type RealtimeSessionBootstrapInput = {
  request: NextRequest;
  surface: RealtimeSurface;
  deviceId: string;
  memberId?: string;
  doctorBotSlug?: string;
  channel?: string;
  memberSnapshot?: MemberSnapshotInput;
};

export async function buildRealtimeSessionBootstrap(input: RealtimeSessionBootstrapInput) {
  const runtime = await getRealtimeRuntimeConfig();

  if (!runtime.allowedSurfaces.includes(input.surface)) {
    throw new Error(`Surface ${input.surface} is not enabled`);
  }

  const resolved = await resolveAgentSessionContext({
    request: input.request,
    deviceId: input.deviceId,
    memberId: input.memberId,
    memberSnapshot: input.memberSnapshot,
  });

  const token = issueAgentSessionToken({
    userId: resolved.user.id,
    memberId: resolved.member.id,
    role: resolved.user.role,
    deviceId: input.deviceId,
    accountType: resolved.activeAccountType,
    doctorProfileId: resolved.activeAccountType === "DOCTOR" ? resolved.activeDoctorProfile?.id : undefined,
    organizationId: resolved.organization?.id || undefined,
    hermesProfileId: resolved.hermesProfile?.id || undefined,
    tenantRole: resolved.tenantRole,
    channel: resolveAgentChannel({
      channel: input.channel,
      clientKind: "app",
      entrypoint: input.surface === "doctor_bot" ? "app" : "agent",
      accountType: resolved.activeAccountType,
    }),
    entrypoint: input.surface === "doctor_bot" ? "app" : "agent",
  });

  const [memberContext, assessmentSummary, activeAssessment] = await Promise.all([
    getMemberContext(resolved.user.id, resolved.member.id),
    getMemberAssessmentSummary(resolved.user.id, resolved.member.id),
    getLatestActiveAssessmentSession({
      userId: resolved.user.id,
      profileId: resolved.member.id,
    }),
  ]);

  const toolDescriptors = listRealtimeToolDescriptors({
    surface: input.surface,
    accountType: resolved.activeAccountType,
    doctorProfileId: resolved.user.doctorProfile?.id,
  });

  const doctorBot =
    input.surface === "doctor_bot" && input.doctorBotSlug
      ? await createDoctorBotBootstrapState({
          slug: input.doctorBotSlug,
          deviceId: input.deviceId,
        })
      : null;

  const doctorBotPublic =
    input.surface === "doctor_bot" && input.doctorBotSlug
      ? await getPublishedDoctorBotBySlug(input.doctorBotSlug)
      : null;

  const uiMode =
    input.surface === "doctor_bot"
      ? "doctor_bot"
      : input.doctorBotSlug
        ? "public_share"
        : "self_service";

  const voiceMode = runtime.fallbacks.voiceIntent ? "stable" : "experimental";
  const hermesProfileRuntime = readHermesProfileRuntimeConfig(
    resolved.hermesProfile?.configJson || null
  );
  const knowledgeDefaultMode = resolveKnowledgeDefaultMode({
    surface: input.surface,
    hermesProfileConfig: resolved.hermesProfile?.configJson || null,
    doctorBotConfig: doctorBotPublic?.config as
      | { knowledgeMode?: KnowledgeDefaultMode | null }
      | null
      | undefined,
  });
  const fastgptAvailable = Boolean(doctorBotPublic?.config.fastgptBaseUrl);
  const doctorBotFallbackEnabled =
    runtime.fallbacks.doctorBot && hermesProfileRuntime.doctorBotFallbackEnabled;

  return {
    runtime,
    surface: input.surface,
    uiMode,
    voiceMode,
    session: {
      token: token.token,
      payload: token.payload,
    },
    account: {
      userId: resolved.user.id,
      role: resolved.user.role,
      accountType: resolved.activeAccountType,
      isAuthenticated: !resolved.user.isGuest,
      doctorProfileId: resolved.user.doctorProfile?.id || null,
      tenantRole: resolved.tenantRole,
      organization: resolved.organization,
      hermesProfile: resolved.hermesProfile,
    },
    member: {
      id: resolved.member.id,
      nickname: resolved.member.nickname,
      relation: String(resolved.member.relation || "SELF").toLowerCase(),
    },
    members: resolved.profiles.map((profile: any) => ({
      id: profile.id,
      nickname: profile.nickname,
      relation: String(profile.relation || "SELF").toLowerCase(),
    })),
    context: memberContext,
    assessmentSummary,
    activeAssessment,
    tools: toolDescriptors,
    knowledge: {
      defaultMode: knowledgeDefaultMode,
      fastgptAvailable,
      directModeEnabled:
        knowledgeDefaultMode === "direct_fastgpt" && fastgptAvailable,
    },
    doctorBot: doctorBot
      ? {
          slug: input.doctorBotSlug!,
          bot: doctorBot.bot,
          enabledScales: doctorBot.enabledScales,
          fallback: {
            enabled: doctorBotFallbackEnabled,
            provider: fastgptAvailable ? "fastgpt" : null,
          },
        }
      : null,
  };
}
