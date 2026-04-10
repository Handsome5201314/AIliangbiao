import { NextRequest } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { extractAppBearerToken, verifyAppSessionToken } from '@/lib/auth/app-session';

export async function requireAuthenticatedUser(request: NextRequest) {
  const token = extractAppBearerToken(request);
  const session = verifyAppSessionToken(token);
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      doctorProfile: true,
      profiles: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return { session, user };
}

export async function requirePatientUser(request: NextRequest) {
  const { session, user } = await requireAuthenticatedUser(request);
  if (user.accountType !== 'PATIENT') {
    throw new Error('Patient account required');
  }

  return { session, user };
}

export async function requireDoctorUser(request: NextRequest) {
  const { session, user } = await requireAuthenticatedUser(request);
  if (user.accountType !== 'DOCTOR') {
    throw new Error('Doctor account required');
  }
  if (!user.doctorProfile) {
    throw new Error('Doctor profile not found');
  }

  return { session, user, doctorProfile: user.doctorProfile };
}

export async function requireApprovedDoctorUser(request: NextRequest) {
  const { session, user, doctorProfile } = await requireDoctorUser(request);
  if (doctorProfile.verificationStatus !== 'APPROVED') {
    throw new Error('Doctor is not approved yet');
  }

  return { session, user, doctorProfile };
}
