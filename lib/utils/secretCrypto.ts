import crypto from 'node:crypto';

function getSecret() {
  return (
    process.env.DOCTOR_BOT_SECRET ||
    process.env.FASTGPT_EMBED_TOKEN_SECRET ||
    process.env.SESSION_SECRET ||
    'local-dev-doctor-bot-secret'
  );
}

function getKey() {
  return crypto.createHash('sha256').update(getSecret()).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decryptSecret(value: string) {
  const [ivPart, encryptedPart, tagPart] = value.split('.');
  if (!ivPart || !encryptedPart || !tagPart) {
    throw new Error('Invalid encrypted secret payload');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
