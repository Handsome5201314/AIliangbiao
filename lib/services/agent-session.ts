import { NextRequest } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { extractAppBearerToken, verifyAppSessionToken } from '@/lib/auth/app-session';
import type { AgentChannel, AgentTenantRole } from '@/lib/assessment-skill/auth';
import { ensureMemberForDevice } from '@/lib/assessment-skill/member-service';
import { getActiveDoctorAssignment } from '@/lib/services/doctor-care';

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

type OrganizationSummary = {
  id: string;
  name: string;
  status: string;
} | null;

type TenantContext = {
  activeDoctorProfile: any | null;
  organization: OrganizationSummary;
  tenantRole: AgentTenantRole;
};

const KNOWN_AGENT_CHANNELS = new Set<AgentChannel>([
  'app_web',
  'agent_web',
  'doctor_workspace',
  'ai_toy',
  'wechat_h5',
  'feishu_bot',
  'wecom_bot',
  'dingtalk_bot',
  'public_share',
]);

function memberProfileModel() {
  return (prisma as any).memberProfile ?? (prisma as any).childProfile;
}

async function tryGetAuthenticatedUser(request: NextRequest) {
  try {
    const token = extractAppBearerToken(request);
    const session = verifyAppSessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: {
        doctorProfile: true,
        profiles: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) {
      return null;
    }

    return { session, user };
  } catch {
    return null;
  }
}

function buildDefaultMemberInput(user: any, snapshot?: MemberSnapshotInput) {
  const nickname =
    snapshot?.nickname ||
    user.doctorProfile?.realName ||
    user.email?.split('@')[0] ||
    user.phone ||
    '本人';

  return {
    userId: user.id,
    relation: String(snapshot?.relation || 'SELF').toUpperCase(),
    languagePreference: String(snapshot?.languagePreference || 'ZH').toUpperCase(),
    nickname,
    realName: user.doctorProfile?.realName || nickname,
    contactPhone: user.phone || null,
    gender: snapshot?.gender || 'unknown',
    ageMonths: snapshot?.ageMonths || null,
    pendingClaim: false,
    traits: {
      interests: snapshot?.interests || [],
      fears: snapshot?.fears || [],
    },
    avatarConfig: snapshot?.avatarConfig || {},
  };
}

async function ensureMemberForAuthenticatedUser(input: {
  user: any;
  memberId?: string;
  memberSnapshot?: MemberSnapshotInput;
}) {
  const model = memberProfileModel();
  let profiles = await model.findMany({
    where: { userId: input.user.id },
    orderBy: { createdAt: 'asc' },
  });

  if (!profiles.length) {
    const created = await model.create({
      data: buildDefaultMemberInput(input.user, input.memberSnapshot),
    });
    profiles = [created];
  }

  let member = profiles.find((item: any) => item.id === input.memberId) || profiles[0];

  if (!member && input.memberSnapshot) {
    member = await model.create({
      data: buildDefaultMemberInput(input.user, input.memberSnapshot),
    });
    profiles.push(member);
  }

  if (!member) {
    throw new Error('Failed to resolve authenticated member');
  }

  return {
    user: input.user,
    member,
    profiles,
  };
}

async function resolveOrganizationSummary(organizationId?: string | null): Promise<OrganizationSummary> {
  if (!organizationId) {
    return null;
  }

  const organizationModel = (prisma as any).organization;
  if (!organizationModel?.findUnique) {
    return null;
  }

  return organizationModel.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });
}

async function resolveDoctorTenantContext(input: { user: any }): Promise<TenantContext> {
  const activeDoctorProfile = input.user.doctorProfile || null;
  const organization = await resolveOrganizationSummary(activeDoctorProfile?.organizationId || null);

  return {
    activeDoctorProfile,
    organization,
    tenantRole: organization ? 'ORG_DOCTOR' : 'DOCTOR_SELF',
  };
}

async function resolvePatientTenantContext(input: {
  user: any;
  memberId: string;
}): Promise<TenantContext> {
  const assignment = await getActiveDoctorAssignment(input.memberId);
  const activeDoctorProfile = (assignment?.doctorProfile as any) || null;
  const organization = await resolveOrganizationSummary(activeDoctorProfile?.organizationId || null);

  return {
    activeDoctorProfile,
    organization,
    tenantRole: input.user.isGuest ? 'GUEST_MEMBER' : 'PATIENT_MEMBER',
  };
}

export async function resolveAgentTenantContext(input: {
  user: any;
  member: any;
  activeAccountType: 'PATIENT' | 'DOCTOR';
}) {
  return input.activeAccountType === 'DOCTOR'
    ? resolveDoctorTenantContext({ user: input.user })
    : resolvePatientTenantContext({
        user: input.user,
        memberId: input.member.id,
      });
}

export async function resolveAgentSessionContext(input: {
  request: NextRequest;
  deviceId: string;
  memberId?: string;
  memberSnapshot?: MemberSnapshotInput;
}) {
  const authenticated = await tryGetAuthenticatedUser(input.request);
  const accountTypeFromSession = authenticated?.session.accountType as 'PATIENT' | 'DOCTOR' | undefined;

  if (authenticated) {
    const resolved = await ensureMemberForAuthenticatedUser({
      user: authenticated.user,
      memberId: input.memberId,
      memberSnapshot: input.memberSnapshot,
    });
    const activeAccountType = accountTypeFromSession || 'PATIENT';
    const tenant = await resolveAgentTenantContext({
      user: resolved.user,
      member: resolved.member,
      activeAccountType,
    });

    return {
      ...resolved,
      activeAccountType,
      ...tenant,
    };
  }

  const guestContext = await ensureMemberForDevice({
    deviceId: input.deviceId,
    memberId: input.memberId,
    memberSnapshot: input.memberSnapshot,
  });

  const hydratedUser = await prisma.user.findUnique({
    where: { id: guestContext.user.id },
    include: {
      doctorProfile: true,
      profiles: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const user =
    hydratedUser || { ...guestContext.user, doctorProfile: null, profiles: guestContext.profiles };
  const activeAccountType = (hydratedUser?.accountType || 'PATIENT') as 'PATIENT' | 'DOCTOR';
  const tenant = await resolveAgentTenantContext({
    user,
    member: guestContext.member,
    activeAccountType,
  });

  return {
    user,
    member: guestContext.member,
    profiles: guestContext.profiles,
    activeAccountType,
    ...tenant,
  };
}

export function resolveAgentChannel(input: {
  channel?: string | null;
  clientKind?: 'app' | 'ai_toy' | null;
  entrypoint?: 'app' | 'agent' | null;
  accountType?: 'PATIENT' | 'DOCTOR' | null;
}): AgentChannel {
  const explicitChannel = String(input.channel || '').trim() as AgentChannel;
  if (explicitChannel && KNOWN_AGENT_CHANNELS.has(explicitChannel)) {
    return explicitChannel;
  }

  if (input.clientKind === 'ai_toy') {
    return 'ai_toy';
  }

  if (input.accountType === 'DOCTOR') {
    return 'doctor_workspace';
  }

  if (input.entrypoint === 'agent') {
    return 'agent_web';
  }

  return 'app_web';
}

export function getAgentToolCapabilities(input: {
  accountType?: 'PATIENT' | 'DOCTOR';
  doctorProfileId?: string | null;
}) {
  const baseTools = [
    'assessment.recommend',
    'assessment.session.start',
    'assessment.session.answer',
    'assessment.session.cancel',
    'profile.read',
    'profile.export_v1',
    'profile.rebuild',
  ];

  if (input.accountType === 'DOCTOR' && input.doctorProfileId) {
    return [...baseTools, 'doctor.invites.create', 'doctor.invites.list'];
  }

  return baseTools;
}
