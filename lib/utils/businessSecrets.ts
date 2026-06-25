import crypto from 'node:crypto';

const ENCRYPTION_PREFIX = 'bs:v1:';
const HMAC_PREFIX = 'bs:hmac:v1:';

function getKeyMaterial() {
  const configured = process.env.BUSINESS_SECRET_ENCRYPTION_KEY?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('BUSINESS_SECRET_ENCRYPTION_KEY is required in production');
  }

  return 'local-dev-business-secret-key';
}

function deriveKey(purpose: 'encrypt' | 'hmac') {
  return crypto
    .createHash('sha256')
    .update(`${purpose}:${getKeyMaterial()}`)
    .digest();
}

function timingSafeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function encryptBusinessSecret(value: string) {
  const plaintext = value.trim();
  if (!plaintext) {
    throw new Error('Business secret cannot be empty');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey('encrypt'), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decryptBusinessSecret(value: string) {
  if (!value.startsWith(ENCRYPTION_PREFIX)) {
    throw new Error('Unsupported business secret format');
  }

  const payload = value.slice(ENCRYPTION_PREFIX.length);
  const [ivPart, encryptedPart, tagPart] = payload.split('.');
  if (!ivPart || !encryptedPart || !tagPart) {
    throw new Error('Invalid business secret payload');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey('encrypt'),
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function hashBusinessSecret(value: string) {
  const plaintext = value.trim();
  if (!plaintext) {
    throw new Error('Business secret cannot be empty');
  }

  const digest = crypto
    .createHmac('sha256', deriveKey('hmac'))
    .update(plaintext)
    .digest('base64url');

  return `${HMAC_PREFIX}${digest}`;
}

export function verifyBusinessSecretHash(value: string, expectedHash: string | null | undefined) {
  if (!expectedHash?.startsWith(HMAC_PREFIX)) {
    return false;
  }

  return timingSafeEqualText(hashBusinessSecret(value), expectedHash);
}

export function maskBusinessSecret(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }

  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

export function isEncryptedBusinessSecret(value: string | null | undefined) {
  return Boolean(value?.startsWith(ENCRYPTION_PREFIX));
}

export const BUSINESS_SECRET_VERSION = 'bs:v1';
