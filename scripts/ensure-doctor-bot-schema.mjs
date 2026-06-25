import { prisma } from '../lib/db/prisma.js';

async function main() {
  console.log('[schema] ensuring DoctorBotConfig table exists');
  await prisma.$executeRawUnsafe(`
    create table if not exists "DoctorBotConfig" (
      "id" text primary key,
      "doctorProfileId" text not null unique references "DoctorProfile"("id") on delete cascade,
      "assistantName" text not null,
      "avatarUrl" text,
      "welcomeMessage" text,
      "publicSlug" text not null unique,
      "fastgptBaseUrl" text not null,
      "fastgptApiKeyEncrypted" text,
      "enabledScaleIds" jsonb not null default '[]'::jsonb,
      "status" text not null default 'draft',
      "lastValidatedAt" timestamp(3),
      "validationStatus" text,
      "lastValidationError" text,
      "createdAt" timestamp(3) not null default now(),
      "updatedAt" timestamp(3) not null default now()
    );
  `);

  console.log('[schema] ensuring DoctorBotChatSession table exists');
  await prisma.$executeRawUnsafe(`
    create table if not exists "DoctorBotChatSession" (
      "id" text primary key,
      "doctorBotId" text not null references "DoctorBotConfig"("id") on delete cascade,
      "visitorSessionId" text not null,
      "chatId" text not null unique,
      "deviceId" text not null,
      "memberProfileId" text references "ChildProfile"("id") on delete set null,
      "status" text not null default 'active',
      "messageCount" integer not null default 0,
      "lastError" text,
      "lastActiveAt" timestamp(3) not null default now(),
      "createdAt" timestamp(3) not null default now(),
      "updatedAt" timestamp(3) not null default now(),
      unique ("doctorBotId", "visitorSessionId")
    );
  `);

  console.log('[schema] ensuring DoctorBot indexes exist');
  await prisma.$executeRawUnsafe(`
    create index if not exists "DoctorBotConfig_status_updatedAt_idx"
    on "DoctorBotConfig" ("status", "updatedAt");
  `);
  await prisma.$executeRawUnsafe(`
    create index if not exists "DoctorBotChatSession_status_lastActiveAt_idx"
    on "DoctorBotChatSession" ("status", "lastActiveAt");
  `);
  await prisma.$executeRawUnsafe(`
    create index if not exists "DoctorBotChatSession_memberProfileId_lastActiveAt_idx"
    on "DoctorBotChatSession" ("memberProfileId", "lastActiveAt");
  `);

  console.log('[schema] aligning DoctorBotConfig secret column constraints');
  await prisma.$executeRawUnsafe(`
    alter table if exists "DoctorBotConfig"
    alter column "fastgptApiKeyEncrypted" drop not null;
  `);
}

main()
  .catch((error) => {
    console.error('[schema] doctor bot ensure failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
