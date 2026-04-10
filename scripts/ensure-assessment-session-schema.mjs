import { prisma } from '../lib/db/prisma.js';

async function main() {
  console.log('[schema] backfilling null accountType as PATIENT for non-doctor users');
  await prisma.$executeRawUnsafe(`
    update "User"
    set "accountType" = 'PATIENT'::"AccountType"
    where "accountType" is null
  `);

  console.log('[schema] backfilling null AssessmentSession.currentQuestionIndex to 0');
  await prisma.$executeRawUnsafe(`
    update "AssessmentSession"
    set "currentQuestionIndex" = 0
    where "currentQuestionIndex" is null
  `);

  console.log('[schema] ensuring additive AssessmentSession columns exist');
  await prisma.$executeRawUnsafe(`
    alter table "AssessmentSession"
      add column if not exists "scaleVersion" text default '1.0',
      add column if not exists "language" text default 'ZH',
      add column if not exists "totalScore" double precision,
      add column if not exists "conclusion" text,
      add column if not exists "resultDetails" jsonb,
      add column if not exists "assessmentHistoryId" text;
  `);

  console.log('[schema] done');
}

main()
  .catch((error) => {
    console.error('[schema] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
