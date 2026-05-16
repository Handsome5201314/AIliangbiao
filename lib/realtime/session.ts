import type { NextRequest } from "next/server";

import { getRealtimeRuntimeConfig, type RealtimeSurface } from "@/lib/realtime/config";
import { listRealtimeToolDescriptors } from "@/lib/realtime/tools";
import { createDoctorBotBootstrapState } from "@/lib/realtime/doctor-bot-bootstrap";
import { resolveAgentSessionContext } from "@/lib/services/agent-session";
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

export type RealtimeSessionBootstrapInput = {
  request: NextRequest;
  surface: RealtimeSurface;
  deviceId: string;
  memberId?: string;
  doctorBotSlug?: string;
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
    doctorProfileId: resolved.user.doctorProfile?.id,
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
      defaultMode: "platform_proxy",
      fastgptAvailable: Boolean(doctorBotPublic?.config.fastgptBaseUrl),
      directModeEnabled: false,
    },
    doctorBot: doctorBot
      ? {
          slug: input.doctorBotSlug!,
          bot: doctorBot.bot,
          enabledScales: doctorBot.enabledScales,
          fallback: {
            enabled: runtime.fallbacks.doctorBot,
            provider: doctorBotPublic?.config.fastgptBaseUrl ? "fastgpt" : null,
          },
        }
      : null,
  };
}
