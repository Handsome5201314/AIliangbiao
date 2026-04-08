export const NO_INPUT_TIMEOUT_MS = 5000;
export const MAX_REPROMPTS = 3;
export const MAX_FALLBACKS = 2;
export const HIGH_CONFIDENCE_THRESHOLD = 0.85;
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.55;
export const BARGE_IN_MIN_DURATION_MS = 150;

export function shouldAutoAccept(confidence: number): boolean {
  return confidence >= HIGH_CONFIDENCE_THRESHOLD;
}

export function shouldConfirm(confidence: number): boolean {
  return confidence >= MEDIUM_CONFIDENCE_THRESHOLD && confidence < HIGH_CONFIDENCE_THRESHOLD;
}

export function shouldFallback(confidence: number): boolean {
  return confidence < MEDIUM_CONFIDENCE_THRESHOLD;
}

export function shouldPauseSession(repromptCount: number, fallbackCount: number): boolean {
  return repromptCount >= MAX_REPROMPTS || fallbackCount >= MAX_FALLBACKS;
}
