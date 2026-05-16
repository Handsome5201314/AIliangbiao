import { PrismaClient } from '@prisma/client';

import { buildLocalSeedPlan, hashSeedPassword } from './lib/local-dev-seed.mjs';

process.loadEnvFile?.('.env.local');
process.loadEnvFile?.('.env');

const prisma = new PrismaClient();

async function upsertSystemConfigs(plan) {
  await Promise.all(
    Object.entries(plan.systemConfigs).map(([configKey, configValue]) =>
      prisma.systemConfig.upsert({
        where: { configKey },
        update: { configValue: String(configValue) },
        create: {
          configKey,
          configValue: String(configValue),
          description: 'Local development seed',
        },
      })
    )
  );
}

async function upsertAdmin(plan) {
  const passwordHash = await hashSeedPassword(plan.admin.password);
  return prisma.admin.upsert({
    where: { username: plan.admin.username },
    update: {
      passwordHash,
      email: plan.admin.email,
      role: plan.admin.role,
    },
    create: {
      username: plan.admin.username,
      passwordHash,
      email: plan.admin.email,
      role: plan.admin.role,
    },
  });
}

async function upsertDoctor(plan, admin) {
  const passwordHash = await hashSeedPassword(plan.doctor.user.password);
  return prisma.user.upsert({
    where: { email: plan.doctor.user.email },
    update: {
      phone: plan.doctor.user.phone,
      passwordHash,
      isGuest: false,
      role: 'REGISTERED',
      accountType: 'DOCTOR',
      dailyLimit: 10,
      doctorProfile: {
        upsert: {
          update: {
            realName: plan.doctor.profile.realName,
            hospitalName: plan.doctor.profile.hospitalName,
            departmentName: plan.doctor.profile.departmentName,
            title: plan.doctor.profile.title,
            licenseNo: plan.doctor.profile.licenseNo,
            verificationStatus: 'APPROVED',
            approvedAt: plan.now,
            approvedByAdminId: admin.id,
          },
          create: {
            realName: plan.doctor.profile.realName,
            hospitalName: plan.doctor.profile.hospitalName,
            departmentName: plan.doctor.profile.departmentName,
            title: plan.doctor.profile.title,
            licenseNo: plan.doctor.profile.licenseNo,
            verificationStatus: 'APPROVED',
            approvedAt: plan.now,
            approvedByAdminId: admin.id,
          },
        },
      },
    },
    create: {
      email: plan.doctor.user.email,
      phone: plan.doctor.user.phone,
      passwordHash,
      isGuest: false,
      role: 'REGISTERED',
      accountType: 'DOCTOR',
      dailyLimit: 10,
      doctorProfile: {
        create: {
          realName: plan.doctor.profile.realName,
          hospitalName: plan.doctor.profile.hospitalName,
          departmentName: plan.doctor.profile.departmentName,
          title: plan.doctor.profile.title,
          licenseNo: plan.doctor.profile.licenseNo,
          verificationStatus: 'APPROVED',
          approvedAt: plan.now,
          approvedByAdminId: admin.id,
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });
}

async function upsertPatient(plan) {
  const passwordHash = await hashSeedPassword(plan.patient.user.password);
  const user = await prisma.user.upsert({
    where: { email: plan.patient.user.email },
    update: {
      phone: plan.patient.user.phone,
      passwordHash,
      isGuest: false,
      role: 'REGISTERED',
      accountType: 'PATIENT',
      dailyLimit: 10,
    },
    create: {
      email: plan.patient.user.email,
      phone: plan.patient.user.phone,
      passwordHash,
      isGuest: false,
      role: 'REGISTERED',
      accountType: 'PATIENT',
      dailyLimit: 10,
    },
  });

  const existingMember = await prisma.memberProfile.findFirst({
    where: {
      userId: user.id,
      nickname: plan.patient.member.nickname,
    },
  });

  const member = existingMember
    ? await prisma.memberProfile.update({
        where: { id: existingMember.id },
        data: {
          relation: plan.patient.member.relation,
          languagePreference: plan.patient.member.languagePreference,
          gender: plan.patient.member.gender,
          ageMonths: plan.patient.member.ageMonths,
          realName: plan.patient.member.nickname,
          traits: {
            interests: ['拼图', '画画'],
            fears: ['陌生环境'],
          },
          avatarConfig: {},
        },
      })
    : await prisma.memberProfile.create({
        data: {
          userId: user.id,
          relation: plan.patient.member.relation,
          languagePreference: plan.patient.member.languagePreference,
          nickname: plan.patient.member.nickname,
          realName: plan.patient.member.nickname,
          gender: plan.patient.member.gender,
          ageMonths: plan.patient.member.ageMonths,
          pendingClaim: false,
          traits: {
            interests: ['拼图', '画画'],
            fears: ['陌生环境'],
          },
          avatarConfig: {},
        },
      });

  return { user, member };
}

async function seedAssessments(plan, patient) {
  for (const assessment of plan.assessments) {
    const existing = await prisma.assessmentHistory.findFirst({
      where: {
        userId: patient.user.id,
        profileId: patient.member.id,
        scaleId: assessment.scaleId,
      },
    });

    if (existing) {
      await prisma.assessmentHistory.update({
        where: { id: existing.id },
        data: {
          totalScore: assessment.totalScore,
          conclusion: assessment.conclusion,
          answers: [],
          source: 'DIRECT',
          respondentRealName: patient.member.nickname,
          respondentGender: patient.member.gender,
          respondentAgeMonths: patient.member.ageMonths,
        },
      });
      continue;
    }

    await prisma.assessmentHistory.create({
      data: {
        userId: patient.user.id,
        profileId: patient.member.id,
        scaleId: assessment.scaleId,
        totalScore: assessment.totalScore,
        conclusion: assessment.conclusion,
        answers: [],
        source: 'DIRECT',
        respondentRealName: patient.member.nickname,
        respondentGender: patient.member.gender,
        respondentAgeMonths: patient.member.ageMonths,
        createdAt: plan.now,
      },
    });
  }
}

async function main() {
  const plan = buildLocalSeedPlan();
  await upsertSystemConfigs(plan);
  const admin = await upsertAdmin(plan);
  const doctor = await upsertDoctor(plan, admin);
  const patient = await upsertPatient(plan);
  await seedAssessments(plan, patient);

  console.log(
    JSON.stringify(
      {
        seeded: true,
        admin: plan.admin.username,
        doctor: doctor.doctorProfile?.realName,
        patient: patient.member.nickname,
        assessments: plan.assessments.map((item) => item.scaleId),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
