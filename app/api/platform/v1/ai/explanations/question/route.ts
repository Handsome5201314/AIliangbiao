import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  extractBearerToken,
  requireAgentScope,
  verifyAgentSessionToken,
} from '@/lib/assessment-skill/auth';
import { resolveAgentSessionContext } from '@/lib/services/agent-session';
import {
  getQuestionExplanation,
  recordQuestionExplanationAudit,
} from '@/lib/services/platform-knowledge';

const requestSchema = z.object({
  deviceId: z.string().min(1),
  memberId: z.string().optional(),
  scaleId: z.string().min(1),
  questionId: z.number().int().positive(),
  language: z.enum(['zh', 'en']).optional(),
  memberSnapshot: z
    .object({
      nickname: z.string().optional(),
      gender: z.string().optional(),
      ageMonths: z.number().optional(),
      relation: z.string().optional(),
      languagePreference: z.string().optional(),
      interests: z.array(z.string()).optional(),
      fears: z.array(z.string()).optional(),
      avatarConfig: z.unknown().optional(),
    })
    .optional(),
});

const getRequestSchema = z.object({
  scaleId: z.string().min(1),
  questionId: z.coerce.number().int().positive(),
  memberId: z.string().optional(),
  language: z.enum(['zh', 'en']).optional(),
});

async function buildQuestionExplanationResponse(input: {
  scaleId: string;
  questionId: number;
  language: 'zh' | 'en';
  organizationId: string | null;
  actorType: 'USER' | 'DOCTOR';
  actorUserId: string;
  actorDoctorProfileId: string | null;
  memberProfileId: string;
  doctorProfileId: string | null;
  attendingDoctorProfileId: string | null;
}) {
  const explanation = await getQuestionExplanation({
    scaleId: input.scaleId,
    questionId: input.questionId,
    language: input.language,
    organizationId: input.organizationId,
    doctorProfileId: input.doctorProfileId,
    attendingDoctorProfileId: input.attendingDoctorProfileId,
  });

  await recordQuestionExplanationAudit({
    organizationId: input.organizationId,
    actorType: input.actorType,
      actorUserId: input.actorUserId,
      actorDoctorProfileId: input.actorDoctorProfileId,
      memberProfileId: input.memberProfileId,
      scaleId: input.scaleId,
      questionId: input.questionId,
      customExplanationIds: [
        ...explanation.exact.organization.map((item) => item.id),
        ...explanation.exact.doctor.map((item) => item.id),
      ],
    });

  return NextResponse.json({
    success: true,
    explanation,
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = verifyAgentSessionToken(extractBearerToken(request));
    requireAgentScope(session, 'skill:member:read');

    const payload = getRequestSchema.parse({
      scaleId: request.nextUrl.searchParams.get('scaleId'),
      questionId: request.nextUrl.searchParams.get('questionId'),
      memberId: request.nextUrl.searchParams.get('memberId') || undefined,
      language:
        request.nextUrl.searchParams.get('language') ||
        request.nextUrl.searchParams.get('lang') ||
        undefined,
    });

    if (payload.memberId && payload.memberId !== session.member_id) {
      return NextResponse.json({ error: 'Agent token cannot access another member' }, { status: 403 });
    }

    return buildQuestionExplanationResponse({
      scaleId: payload.scaleId,
      questionId: payload.questionId,
      language: payload.language || 'zh',
      organizationId: session.organization_id || null,
      actorType: session.account_type === 'DOCTOR' ? 'DOCTOR' : 'USER',
      actorUserId: session.sub,
      actorDoctorProfileId: session.account_type === 'DOCTOR' ? session.doctor_profile_id || null : null,
      memberProfileId: session.member_id,
      doctorProfileId: session.account_type === 'DOCTOR' ? session.doctor_profile_id || null : null,
      attendingDoctorProfileId:
        session.account_type === 'DOCTOR' ? null : session.doctor_profile_id || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load question explanation';
    const status =
      error instanceof z.ZodError
        ? 400
        : /Missing Bearer token|Invalid agent session|signature|expired|required scope/i.test(message)
          ? 401
          : 422;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const context = await resolveAgentSessionContext({
      request,
      deviceId: body.deviceId,
      memberId: body.memberId,
      memberSnapshot: body.memberSnapshot,
    });
    const language = body.language || 'zh';
    return buildQuestionExplanationResponse({
      scaleId: body.scaleId,
      questionId: body.questionId,
      language,
      organizationId: context.organization?.id || null,
      actorType: context.activeAccountType === 'DOCTOR' ? 'DOCTOR' : 'USER',
      actorUserId: context.user.id,
      actorDoctorProfileId:
        context.activeAccountType === 'DOCTOR' ? context.activeDoctorProfile?.id || null : null,
      memberProfileId: context.member.id,
      doctorProfileId:
        context.activeAccountType === 'DOCTOR' ? context.activeDoctorProfile?.id || null : null,
      attendingDoctorProfileId:
        context.activeAccountType === 'DOCTOR' ? null : context.activeDoctorProfile?.id || null,
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 422;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load question explanation' },
      { status }
    );
  }
}
