import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import { decryptSecret, encryptSecret } from '@/lib/utils/secretCrypto';

type AssessmentCallbackResultPayload = {
  scaleId: string;
  totalScore: number;
  conclusion: string;
  details?: {
    description?: string;
    [key: string]: unknown;
  };
  assessmentHistoryId?: string | null;
};

type AssessmentCallbackPayload = {
  eventType: 'assessment.completed';
  sessionId: string;
  deviceId: string | null;
  scaleId: string;
  result: AssessmentCallbackResultPayload;
  assessmentHistoryId: string | null;
  submittedAt: string;
  callbackMetadata?: Record<string, unknown> | null;
};

const MAX_CALLBACK_ATTEMPTS = 3;
const CALLBACK_RETRY_DELAYS_MS = [0, 1000, 3000] as const;
const CALLBACK_TIMEOUT_MS = 10_000;

function assessmentCallbackDeliveryModel() {
  return (prisma as any).assessmentCallbackDelivery;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCallbackUrl(input: string) {
  const url = new URL(input.trim());
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error('callbackUrl must start with http or https');
  }

  return url.toString();
}

function buildCallbackSignature(timestamp: string, payloadText: string, secret: string) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payloadText}`)
    .digest('hex');

  return `sha256=${digest}`;
}

export async function registerAssessmentCompletionCallback(input: {
  assessmentSessionId: string;
  deviceId?: string;
  callbackUrl: string;
  callbackSecret?: string;
  callbackMetadata?: Record<string, unknown>;
}) {
  const normalizedUrl = normalizeCallbackUrl(input.callbackUrl);
  const encryptedSecret = input.callbackSecret?.trim()
    ? encryptSecret(input.callbackSecret.trim())
    : null;

  return assessmentCallbackDeliveryModel().upsert({
    where: { assessmentSessionId: input.assessmentSessionId },
    update: {
      deviceId: input.deviceId || null,
      callbackUrl: normalizedUrl,
      callbackSecretEncrypted: encryptedSecret,
      callbackMetadata: input.callbackMetadata || null,
      status: 'PENDING',
      deliveredAt: null,
      lastError: null,
      payload: null,
      attemptCount: 0,
      lastAttemptAt: null,
    },
    create: {
      assessmentSessionId: input.assessmentSessionId,
      deviceId: input.deviceId || null,
      callbackUrl: normalizedUrl,
      callbackSecretEncrypted: encryptedSecret,
      callbackMetadata: input.callbackMetadata || null,
      eventType: 'assessment.completed',
      status: 'PENDING',
    },
  });
}

export async function getAssessmentCompletionCallbackStatus(assessmentSessionId: string) {
  const delivery = await assessmentCallbackDeliveryModel().findUnique({
    where: { assessmentSessionId },
  });

  if (!delivery) {
    return null;
  }

  return {
    callbackUrl: delivery.callbackUrl,
    status: delivery.status,
    attemptCount: delivery.attemptCount,
    lastAttemptAt: delivery.lastAttemptAt,
    deliveredAt: delivery.deliveredAt,
    lastError: delivery.lastError,
  };
}

function buildAssessmentCallbackPayload(input: {
  sessionId: string;
  deviceId: string | null;
  scaleId: string;
  result: AssessmentCallbackResultPayload;
  submittedAt?: string | null;
  callbackMetadata?: Record<string, unknown> | null;
}): AssessmentCallbackPayload {
  return {
    eventType: 'assessment.completed',
    sessionId: input.sessionId,
    deviceId: input.deviceId,
    scaleId: input.scaleId,
    result: input.result,
    assessmentHistoryId: input.result.assessmentHistoryId || null,
    submittedAt: input.submittedAt || new Date().toISOString(),
    callbackMetadata: input.callbackMetadata || null,
  };
}

export async function dispatchAssessmentCompletionCallback(input: {
  assessmentSessionId: string;
  sessionId: string;
  scaleId: string;
  result: AssessmentCallbackResultPayload;
  submittedAt?: string | null;
}) {
  const delivery = await assessmentCallbackDeliveryModel().findUnique({
    where: { assessmentSessionId: input.assessmentSessionId },
  });

  if (!delivery) {
    return { delivered: false, skipped: true, reason: 'not_registered' as const };
  }

  if (delivery.status === 'DELIVERED') {
    return { delivered: true, skipped: true, reason: 'already_delivered' as const };
  }

  if (delivery.attemptCount >= MAX_CALLBACK_ATTEMPTS) {
    await assessmentCallbackDeliveryModel().update({
      where: { assessmentSessionId: input.assessmentSessionId },
      data: {
        status: 'DEAD_LETTER',
      },
    });
    return { delivered: false, skipped: true, reason: 'max_attempts_reached' as const };
  }

  const callbackMetadata =
    delivery.callbackMetadata && typeof delivery.callbackMetadata === 'object'
      ? (delivery.callbackMetadata as Record<string, unknown>)
      : null;
  const payload = buildAssessmentCallbackPayload({
    sessionId: input.sessionId,
    deviceId: delivery.deviceId || null,
    scaleId: input.scaleId,
    result: input.result,
    submittedAt: input.submittedAt,
    callbackMetadata,
  });
  const payloadText = JSON.stringify(payload);
  const secret = delivery.callbackSecretEncrypted
    ? decryptSecret(delivery.callbackSecretEncrypted)
    : null;

  let attemptCount = delivery.attemptCount;
  let lastError = '';

  for (let index = attemptCount; index < MAX_CALLBACK_ATTEMPTS; index += 1) {
    const delay = CALLBACK_RETRY_DELAYS_MS[index] || 0;
    if (delay > 0) {
      await sleep(delay);
    }

    attemptCount += 1;
    const lastAttemptAt = new Date();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Ailiangbiao-Timestamp': String(lastAttemptAt.getTime()),
      };

      if (secret) {
        headers['X-Ailiangbiao-Signature'] = buildCallbackSignature(
          headers['X-Ailiangbiao-Timestamp'],
          payloadText,
          secret
        );
      }

      const response = await fetch(delivery.callbackUrl, {
        method: 'POST',
        headers,
        body: payloadText,
        signal: AbortSignal.timeout(CALLBACK_TIMEOUT_MS),
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => '');
        throw new Error(responseText || `Callback failed with status ${response.status}`);
      }

      await assessmentCallbackDeliveryModel().update({
        where: { assessmentSessionId: input.assessmentSessionId },
        data: {
          status: 'DELIVERED',
          attemptCount,
          lastAttemptAt,
          deliveredAt: new Date(),
          lastError: null,
          payload: JSON.parse(payloadText),
        },
      });

      return { delivered: true, skipped: false, reason: 'delivered' as const };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown callback error';
      const exhausted = attemptCount >= MAX_CALLBACK_ATTEMPTS;

      await assessmentCallbackDeliveryModel().update({
        where: { assessmentSessionId: input.assessmentSessionId },
        data: {
          status: exhausted ? 'DEAD_LETTER' : 'PENDING',
          attemptCount,
          lastAttemptAt,
          lastError,
          payload: JSON.parse(payloadText),
        },
      });
    }
  }

  return {
    delivered: false,
    skipped: false,
    reason: 'dead_letter' as const,
    error: lastError,
  };
}
