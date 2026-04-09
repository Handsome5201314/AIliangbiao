import { prisma } from '@/lib/db/prisma';

export function memberProfileModel() {
  return (prisma as any).memberProfile ?? (prisma as any).childProfile;
}
