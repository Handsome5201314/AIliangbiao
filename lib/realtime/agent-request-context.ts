import { getMemberContext } from "@/lib/assessment-skill/member-service";
import type { AgentSessionPayload } from "@/lib/assessment-skill/auth";
import type {
  AgentMemberContextSummary,
  AgentTenantContextSummary,
} from "@/lib/realtime/agent-conversation";

type ResolvedTenantContextInput = {
  channel?: string | null;
  tenantRole?: string | null;
  organization?: {
    id: string;
    name?: string | null;
  } | null;
  activeDoctorProfile?: {
    id: string;
    realName?: string | null;
  } | null;
};

export async function buildAgentMemberContextSummary(input: {
  userId: string;
  memberId: string;
  language: "zh" | "en";
}) {
  try {
    const context = await getMemberContext(input.userId, input.memberId);

    return {
      nickname: context.member.nickname,
      relation: context.member.relation,
      latestAssessmentConclusion:
        context.latestAssessment?.conclusion ||
        (input.language === "en" ? "No recent assessment records" : "近期暂无评估记录"),
      interests: context.member.interests,
      fears: context.member.fears,
      behaviors: context.member.behaviors,
      medicalHistory: context.member.medicalHistory,
    } satisfies AgentMemberContextSummary;
  } catch {
    return null;
  }
}

export function buildAgentTenantContextFromSession(
  session: Pick<
    AgentSessionPayload,
    "channel" | "tenant_role" | "organization_id" | "doctor_profile_id"
  >
) {
  return {
    channel: session.channel,
    tenantRole: session.tenant_role,
    organizationId: session.organization_id,
    doctorProfileId: session.doctor_profile_id,
  } satisfies AgentTenantContextSummary;
}

export function buildAgentTenantContextFromResolved(
  input: ResolvedTenantContextInput
) {
  return {
    channel: input.channel || undefined,
    tenantRole: input.tenantRole || undefined,
    organizationId: input.organization?.id || undefined,
    doctorProfileId: input.activeDoctorProfile?.id || undefined,
    organizationName: input.organization?.name || undefined,
    doctorName: input.activeDoctorProfile?.realName || undefined,
  } satisfies AgentTenantContextSummary;
}
