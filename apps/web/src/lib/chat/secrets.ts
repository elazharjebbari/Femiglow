/**
 * CHA-008 — Chiffrement AES-256-GCM des clés API providers.
 *
 * Stocke les clés tierces (OpenAI, Anthropic, Mistral…) chiffrées
 * en base. Décryptage uniquement au moment d'instancier l'adapter.
 *
 * Format en base : `apiKeyEncrypted` = base64(ciphertext+tag),
 * `apiKeyIv` = base64(iv 12 bytes).
 *
 * cf. docs/chat-assistant/13-securite-rgpd-moderation.md §4.1
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

import { env } from '@/lib/env';

const ALG = 'aes-256-gcm';
const IV_LEN = 12; // GCM standard
const AUTH_TAG_LEN = 16;

interface EncryptedSecret {
  ciphertext: string; // base64 (ciphertext || authTag)
  iv: string; // base64
}

function getKey(): Buffer {
  const raw = env.CHAT_PROVIDER_KEY;
  if (!raw) {
    throw new ChatSecretsConfigError(
      'CHAT_PROVIDER_KEY is required to encrypt provider credentials',
    );
  }
  // Dérive une clé 32 bytes (AES-256) à partir de la clé fournie via SHA-256.
  // Permet d'utiliser une phrase secrète sans contrainte de taille exacte.
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  if (!plaintext) {
    throw new ChatSecretsError('cannot encrypt empty secret');
  }
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

export function decryptSecret(input: EncryptedSecret): string {
  const key = getKey();
  const iv = Buffer.from(input.iv, 'base64');
  if (iv.length !== IV_LEN) {
    throw new ChatSecretsError(`invalid iv length: ${iv.length}`);
  }
  const all = Buffer.from(input.ciphertext, 'base64');
  if (all.length < AUTH_TAG_LEN + 1) {
    throw new ChatSecretsError('ciphertext too short');
  }
  const authTag = all.subarray(all.length - AUTH_TAG_LEN);
  const ciphertext = all.subarray(0, all.length - AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Helper safe pour ne JAMAIS leak la clé en logs. */
export function maskSecret(plaintext: string | null | undefined): string {
  if (!plaintext) return '';
  if (plaintext.length <= 8) return '••••';
  return `${plaintext.slice(0, 3)}…${plaintext.slice(-3)}`;
}

export class ChatSecretsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatSecretsError';
  }
}

export class ChatSecretsConfigError extends ChatSecretsError {
  constructor(message: string) {
    super(message);
    this.name = 'ChatSecretsConfigError';
  }
}
