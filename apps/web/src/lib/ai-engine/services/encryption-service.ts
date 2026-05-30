import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;

let _instance: EncryptionService | null = null;

export class EncryptionService {
  private derivedKey: Buffer | null = null;

  constructor(masterKey: string, salt: string) {
    this.derivedKey = pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
  }

  isAvailable(): boolean {
    return this.derivedKey !== null;
  }

  encrypt(plaintext: string): string {
    if (!this.derivedKey) throw new Error('Encryption service not initialized');

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.derivedKey, iv, { authTagLength: AUTH_TAG_LENGTH });

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(encryptedString: string): string {
    if (!this.derivedKey) throw new Error('Encryption service not initialized');

    const parts = encryptedString.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');

    const iv = Buffer.from(parts[0]!, 'base64');
    const authTag = Buffer.from(parts[1]!, 'base64');
    const encrypted = Buffer.from(parts[2]!, 'base64');

    const decipher = createDecipheriv(ALGORITHM, this.derivedKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  mask(apiKey: string): { prefix: string; lastFour: string; masked: string } {
    const lastFour = apiKey.slice(-4);
    let prefix = '';

    if (apiKey.startsWith('sk-proj-')) prefix = 'sk-proj-';
    else if (apiKey.startsWith('sk-ant-')) prefix = 'sk-ant-';
    else if (apiKey.startsWith('sk-')) prefix = 'sk-';
    else if (apiKey.startsWith('AIzaSy')) prefix = 'AIzaSy';
    else prefix = apiKey.slice(0, 4);

    const masked = `${prefix}${'*'.repeat(Math.max(0, apiKey.length - prefix.length - 4))}${lastFour}`;
    return { prefix, lastFour, masked };
  }
}

export function getEncryptionService(): EncryptionService | null {
  if (_instance) return _instance;

  const masterKey = process.env.AI_ENGINE_ENCRYPTION_KEY;
  const salt = process.env.AI_ENGINE_ENCRYPTION_SALT;

  if (!masterKey || !salt) return null;

  _instance = new EncryptionService(masterKey, salt);
  return _instance;
}

export function resetEncryptionService(): void {
  _instance = null;
}
