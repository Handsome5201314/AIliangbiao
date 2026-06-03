import { prisma } from "@/lib/db/prisma";
import { ensureMemberForDevice } from "@/lib/assessment-skill/member-service";

export const AI_TOY_VOICE_SCALE_WHITELIST = [
  "PHQ-9",
  "GAD-7",
  "SSS",
  "M_CHAT_R",
  "SNAP-IV",
] as const;

export type AiToyVoiceScaleId = (typeof AI_TOY_VOICE_SCALE_WHITELIST)[number];

type AiToyDeviceBindingRecord = {
  id: string;
  deviceId: string;
  userId: string;
  memberProfileId: string;
  status: string;
  boundAt: Date;
  unboundAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

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

export class AiToyPartnerAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiToyPartnerAuthError";
  }
}

function bindingModel() {
  return (prisma as any).aiToyDeviceBinding;
}

function memberProfileModel() {
  return (prisma as any).memberProfile ?? (prisma as any).childProfile;
}

function normalizeDeviceId(deviceId: string) {
  const normalized = deviceId.trim();
  if (!normalized) {
    throw new Error("deviceId is required");
  }
  return normalized;
}

async function assertMemberOwnedByUser(userId: string, memberProfileId: string) {
  const member = await memberProfileModel().findFirst({
    where: {
      id: memberProfileId,
      userId,
    },
  });

  if (!member) {
    throw new Error("Member not found or not accessible");
  }

  return member;
}

function extractBearerToken(authHeader: string | null | undefined) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
}

export function assertAiToyPartnerToken(authHeader: string | null | undefined) {
  const expectedToken = process.env.AI_TOY_PARTNER_TOKEN?.trim();

  if (!expectedToken) {
    throw new AiToyPartnerAuthError("AI toy partner token is not configured");
  }

  const actualToken = extractBearerToken(authHeader);
  if (!actualToken) {
    throw new AiToyPartnerAuthError("Missing AI toy partner token");
  }

  if (actualToken !== expectedToken) {
    throw new AiToyPartnerAuthError("Invalid AI toy partner token");
  }
}

export async function bindAiToyDevice(input: {
  deviceId: string;
  userId: string;
  memberProfileId: string;
}) {
  const deviceId = normalizeDeviceId(input.deviceId);
  await assertMemberOwnedByUser(input.userId, input.memberProfileId);

  const existing = (await bindingModel().findUnique({
    where: { deviceId },
  })) as AiToyDeviceBindingRecord | null;

  if (
    existing &&
    existing.status === "ACTIVE" &&
    (existing.userId !== input.userId || existing.memberProfileId !== input.memberProfileId)
  ) {
    throw new Error("AI toy device is already bound to another member");
  }

  const binding = existing
    ? await bindingModel().update({
        where: { deviceId },
        data: {
          userId: input.userId,
          memberProfileId: input.memberProfileId,
          status: "ACTIVE",
          boundAt: new Date(),
          unboundAt: null,
        },
      })
    : await bindingModel().create({
        data: {
          deviceId,
          userId: input.userId,
          memberProfileId: input.memberProfileId,
          status: "ACTIVE",
        },
      });

  return binding as AiToyDeviceBindingRecord;
}

export async function resolveAiToyDeviceBinding(deviceId: string) {
  return (await bindingModel().findUnique({
    where: { deviceId: normalizeDeviceId(deviceId) },
  })) as AiToyDeviceBindingRecord | null;
}

export async function unbindAiToyDevice(input: {
  deviceId: string;
  userId: string;
}) {
  const binding = await resolveAiToyDeviceBinding(input.deviceId);

  if (!binding || binding.status !== "ACTIVE") {
    throw new Error("AI toy device binding not found");
  }

  if (binding.userId !== input.userId) {
    throw new Error("AI toy device binding is not owned by this account");
  }

  return (await bindingModel().update({
    where: { deviceId: normalizeDeviceId(input.deviceId) },
    data: {
      status: "UNBOUND",
      unboundAt: new Date(),
    },
  })) as AiToyDeviceBindingRecord;
}

export async function assertAiToyDeviceBinding(input: {
  deviceId: string;
  userId: string;
  memberId: string;
}) {
  const binding = await resolveAiToyDeviceBinding(input.deviceId);

  if (!binding || binding.status !== "ACTIVE") {
    throw new Error("AI toy device is not bound");
  }

  if (binding.userId !== input.userId || binding.memberProfileId !== input.memberId) {
    throw new Error("AI toy device binding does not match this account member");
  }

  return binding;
}

async function loadBindingContext(binding: AiToyDeviceBindingRecord) {
  const user = await prisma.user.findUnique({
    where: { id: binding.userId },
    include: {
      doctorProfile: true,
      profiles: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) {
    throw new Error("AI toy device binding user not found");
  }

  const profiles = user.profiles || [];
  const member = profiles.find((profile: any) => profile.id === binding.memberProfileId);

  if (!member) {
    throw new Error("AI toy device binding member not found");
  }

  return {
    binding,
    user,
    member,
    profiles,
    activeAccountType: (user.accountType || "PATIENT") as "PATIENT" | "DOCTOR",
  };
}

export async function ensureAiToyDeviceBindingForDevice(input: {
  deviceId: string;
  memberSnapshot?: MemberSnapshotInput;
}) {
  const deviceId = normalizeDeviceId(input.deviceId);
  const existing = await resolveAiToyDeviceBinding(deviceId);

  if (existing?.status === "ACTIVE") {
    return loadBindingContext(existing);
  }

  const guestContext = await ensureMemberForDevice({
    deviceId,
    memberSnapshot: input.memberSnapshot,
  });

  const binding = existing
    ? await bindingModel().update({
        where: { deviceId },
        data: {
          userId: guestContext.user.id,
          memberProfileId: guestContext.member.id,
          status: "ACTIVE",
          boundAt: new Date(),
          unboundAt: null,
        },
      })
    : await bindingModel().create({
        data: {
          deviceId,
          userId: guestContext.user.id,
          memberProfileId: guestContext.member.id,
          status: "ACTIVE",
        },
      });

  return loadBindingContext(binding as AiToyDeviceBindingRecord);
}

export function isAiToyVoiceScale(scaleId: string) {
  const normalized = scaleId.toUpperCase();
  const canonicalId =
    normalized === "M-CHAT-R"
      ? "M_CHAT_R"
      : normalized === "SNAP"
        ? "SNAP-IV"
        : normalized;

  return AI_TOY_VOICE_SCALE_WHITELIST.includes(canonicalId as AiToyVoiceScaleId);
}
