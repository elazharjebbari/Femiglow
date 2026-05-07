import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { env } from '@/lib/env';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, 'femiglow-encryption-salt', KEY_LEN);
}

export function encryptSecret(plaintext: string): string {
  const masterKey = env.WEBHOOK_SECRET_KEY;
  if (!masterKey) throw new Error('WEBHOOK_SECRET_KEY non défini');
  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const masterKey = env.WEBHOOK_SECRET_KEY;
  if (!masterKey) throw new Error('WEBHOOK_SECRET_KEY non défini');
  const key = deriveKey(masterKey);
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString('base64url');
}
