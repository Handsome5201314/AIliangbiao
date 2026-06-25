import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM_FLAG = '--confirm-reset-business-secrets';
const confirmed = process.argv.includes(CONFIRM_FLAG);

async function countTargets() {
  const [apiKeys, doctorBots, callbacks] = await Promise.all([
    prisma.apiKey.count(),
    prisma.doctorBotConfig.count({
      where: {
        fastgptApiKeyEncrypted: {
          not: null,
        },
      },
    }),
    prisma.assessmentCallbackDelivery.count({
      where: {
        callbackSecretEncrypted: {
          not: null,
        },
      },
    }),
  ]);

  return { apiKeys, doctorBots, callbacks };
}

async function resetBusinessSecrets() {
  const counts = await countTargets();
  console.log('[business-secrets] Target records:');
  console.log(`  ApiKey rows to delete: ${counts.apiKeys}`);
  console.log(`  Doctor bot FastGPT secrets to clear: ${counts.doctorBots}`);
  console.log(`  Callback signing secrets to clear: ${counts.callbacks}`);

  if (!confirmed) {
    console.log('');
    console.log('[business-secrets] Dry run only. No data changed.');
    console.log(`[business-secrets] Re-run with ${CONFIRM_FLAG} to reset and force re-entry.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.apiKey.deleteMany({});
    await tx.doctorBotConfig.updateMany({
      where: {
        fastgptApiKeyEncrypted: {
          not: null,
        },
      },
      data: {
        fastgptApiKeyEncrypted: null,
        status: 'draft',
        validationStatus: 'needs_rekey',
        lastValidationError: 'Business secret reset; please re-enter FastGPT API key.',
      },
    });
    await tx.assessmentCallbackDelivery.updateMany({
      where: {
        callbackSecretEncrypted: {
          not: null,
        },
      },
      data: {
        callbackSecretEncrypted: null,
      },
    });
  });

  console.log('[business-secrets] Reset complete. Re-enter AI, MCP, Doctor Bot, and callback secrets.');
}

resetBusinessSecrets()
  .catch((error) => {
    console.error('[business-secrets] Reset failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
