import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const encryptionPrefix = 'enc:v1';

function getEncryptionSecret() {
  const secret = process.env.DATA_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('DATA_ENCRYPTION_KEY or JWT_SECRET is required for field encryption.');
  }

  return createHash('sha256').update(secret).digest();
}

export function encryptField(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith(`${encryptionPrefix}:`)) {
    return value;
  }

  const iv = randomBytes(12);
  const key = getEncryptionSecret();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${encryptionPrefix}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptField(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (!value.startsWith(`${encryptionPrefix}:`)) {
    return value;
  }

  const [, ivB64, tagB64, payloadB64] = value.split(':');
  if (!ivB64 || !tagB64 || !payloadB64) {
    throw new Error('Encrypted field payload is malformed.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionSecret(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadB64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
