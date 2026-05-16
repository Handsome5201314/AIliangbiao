import bcrypt from 'bcryptjs';

export function buildLocalSeedPlan() {
  const now = new Date('2026-05-05T00:00:00.000Z');

  return {
    admin: {
      username: 'admin',
      password: 'admin987654321',
      email: 'admin@example.com',
      role: 'superadmin',
    },
    doctor: {
      user: {
        email: 'doctor@example.com',
        phone: '13800138000',
        password: 'doctor123456',
        accountType: 'DOCTOR',
      },
      profile: {
        realName: '王医生',
        hospitalName: '本地演示医院',
        departmentName: '儿童保健科',
        title: '主治医师',
        licenseNo: 'LOCAL-DOCTOR-0001',
      },
    },
    patient: {
      user: {
        email: 'parent@example.com',
        phone: '13900139000',
        password: 'patient123456',
        accountType: 'PATIENT',
      },
      member: {
        nickname: '小明',
        relation: 'CHILD',
        gender: 'male',
        ageMonths: 48,
        languagePreference: 'ZH',
      },
    },
    assessments: [
      {
        scaleId: 'PHQ-9',
        totalScore: 12,
        conclusion: '中度抑郁风险',
        profileKey: 'patient',
      },
      {
        scaleId: 'GAD-7',
        totalScore: 9,
        conclusion: '中度焦虑风险',
        profileKey: 'patient',
      },
    ],
    systemConfigs: {
      guestDailyLimit: '5',
      registeredDailyLimit: '10',
      vipDailyLimit: '999',
      defaultDailyLimit: '10',
      agentWorkspaceConfig: JSON.stringify({
        models: {
          textProvider: 'qwen',
          textModel: 'qwen-max',
          speechProvider: 'siliconflow',
          speechModel: 'FunAudioLLM/SenseVoiceSmall',
          allowFallbackToSystemDefault: true,
        },
        quota: {
          guestAgentDailyLimit: 5,
          registeredAgentDailyLimit: 20,
          vipAgentDailyLimit: 999,
          warnAtRemaining: 1,
        },
      }),
    },
    now,
  };
}

export async function hashSeedPassword(password) {
  return bcrypt.hash(password, 10);
}
