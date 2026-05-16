export function looksLikeEmail(value: string) {
  return value.includes('@');
}

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  let normalized = trimmed.replace(/[^\d+]/g, '');

  if (normalized.startsWith('0086')) {
    normalized = normalized.slice(4);
  } else if (normalized.startsWith('+86')) {
    normalized = normalized.slice(3);
  }

  return normalized;
}

export function normalizeOptionalPhone(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = normalizePhone(value);
  return normalized || undefined;
}
