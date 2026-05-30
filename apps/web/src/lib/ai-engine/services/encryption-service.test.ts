import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EncryptionService, getEncryptionService, resetEncryptionService } from './encryption-service';

const TEST_KEY = 'test-master-key-for-unit-tests-only-32chars!';
const TEST_SALT = 'test-salt-16chars!';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService(TEST_KEY, TEST_SALT);
  });

  it('isAvailable returns true when initialized', () => {
    expect(service.isAvailable()).toBe(true);
  });

  it('encrypts and decrypts correctly', () => {
    const plaintext = 'sk-proj-abc123def456';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const plaintext = 'same-input';
    const enc1 = service.encrypt(plaintext);
    const enc2 = service.encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
    expect(service.decrypt(enc1)).toBe(plaintext);
    expect(service.decrypt(enc2)).toBe(plaintext);
  });

  it('encrypted format is iv:authTag:ciphertext in base64', () => {
    const encrypted = service.encrypt('test');
    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);
    expect(() => Buffer.from(parts[0]!, 'base64')).not.toThrow();
    expect(() => Buffer.from(parts[1]!, 'base64')).not.toThrow();
    expect(() => Buffer.from(parts[2]!, 'base64')).not.toThrow();
  });

  it('throws on invalid encrypted format', () => {
    expect(() => service.decrypt('invalid')).toThrow('Invalid encrypted format');
    expect(() => service.decrypt('a:b')).toThrow('Invalid encrypted format');
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = service.encrypt('sensitive-data');
    const parts = encrypted.split(':');
    const tampered = `${parts[0]}:${parts[1]}:${Buffer.from('tampered').toString('base64')}`;
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('handles empty string', () => {
    const encrypted = service.encrypt('');
    expect(service.decrypt(encrypted)).toBe('');
  });

  it('handles long API keys', () => {
    const longKey = 'sk-proj-' + 'a'.repeat(200);
    const encrypted = service.encrypt(longKey);
    expect(service.decrypt(encrypted)).toBe(longKey);
  });

  it('handles unicode characters', () => {
    const unicode = 'clé-avec-des-accents-éàü';
    const encrypted = service.encrypt(unicode);
    expect(service.decrypt(encrypted)).toBe(unicode);
  });

  it('data encrypted with key A cannot be decrypted with key B', () => {
    const serviceA = new EncryptionService('master-key-AAAA-32-chars-long!!', 'salt-A-16chars!!');
    const serviceB = new EncryptionService('master-key-BBBB-32-chars-long!!', 'salt-B-16chars!!');
    const encrypted = serviceA.encrypt('top-secret-api-key');
    expect(() => serviceB.decrypt(encrypted)).toThrow();
  });

  it('tampered IV causes decryption failure', () => {
    const encrypted = service.encrypt('sensitive-data');
    const parts = encrypted.split(':');
    const ivBytes = Buffer.from(parts[0]!, 'base64');
    ivBytes[0] = ivBytes[0]! ^ 0xff;
    const tampered = `${ivBytes.toString('base64')}:${parts[1]}:${parts[2]}`;
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('tampered auth tag causes decryption failure', () => {
    const encrypted = service.encrypt('sensitive-data');
    const parts = encrypted.split(':');
    const authTagBytes = Buffer.from(parts[1]!, 'base64');
    authTagBytes[0] = authTagBytes[0]! ^ 0xff;
    const tampered = `${parts[0]}:${authTagBytes.toString('base64')}:${parts[2]}`;
    expect(() => service.decrypt(tampered)).toThrow();
  });

  describe('mask', () => {
    it('masks OpenAI key correctly', () => {
      const result = service.mask('sk-proj-abc123def456ghi789');
      expect(result.prefix).toBe('sk-proj-');
      expect(result.lastFour).toBe('i789');
      expect(result.masked).toMatch(/^sk-proj-\*+i789$/);
    });

    it('masks Anthropic key correctly', () => {
      const result = service.mask('sk-ant-abc123def456');
      expect(result.prefix).toBe('sk-ant-');
      expect(result.lastFour).toBe('f456');
    });

    it('masks Google key correctly', () => {
      const result = service.mask('AIzaSyAbc123def456');
      expect(result.prefix).toBe('AIzaSy');
      expect(result.lastFour).toBe('f456');
    });

    it('masks generic key', () => {
      const result = service.mask('some-api-key-here');
      expect(result.prefix).toBe('some');
      expect(result.lastFour).toBe('here');
    });

    it('masks plain sk- prefix (not sk-proj- or sk-ant-)', () => {
      const result = service.mask('sk-1234567890abcdef');
      expect(result.prefix).toBe('sk-');
      expect(result.lastFour).toBe('cdef');
      expect(result.masked).toMatch(/^sk-\*+cdef$/);
    });

    it('handles very short key (< 4 chars) without negative repeat', () => {
      const result = service.mask('ab');
      expect(result.lastFour).toBe('ab');
      expect(result.prefix).toBe('ab');
      expect(result.masked).toBe('abab');
      expect(result.masked.includes('*')).toBe(false);
    });
  });
});

describe('getEncryptionService singleton', () => {
  afterEach(() => {
    resetEncryptionService();
    delete process.env.AI_ENGINE_ENCRYPTION_KEY;
    delete process.env.AI_ENGINE_ENCRYPTION_SALT;
  });

  it('returns null when env vars not set', () => {
    resetEncryptionService();
    const svc = getEncryptionService();
    expect(svc).toBeNull();
  });

  it('returns service when env vars are set', () => {
    process.env.AI_ENGINE_ENCRYPTION_KEY = TEST_KEY;
    process.env.AI_ENGINE_ENCRYPTION_SALT = TEST_SALT;
    resetEncryptionService();
    const svc = getEncryptionService();
    expect(svc).not.toBeNull();
    expect(svc!.isAvailable()).toBe(true);
  });

  it('returns same instance on subsequent calls', () => {
    process.env.AI_ENGINE_ENCRYPTION_KEY = TEST_KEY;
    process.env.AI_ENGINE_ENCRYPTION_SALT = TEST_SALT;
    resetEncryptionService();
    const svc1 = getEncryptionService();
    const svc2 = getEncryptionService();
    expect(svc1).toBe(svc2);
  });

  it('resetEncryptionService clears singleton', () => {
    process.env.AI_ENGINE_ENCRYPTION_KEY = TEST_KEY;
    process.env.AI_ENGINE_ENCRYPTION_SALT = TEST_SALT;
    resetEncryptionService();
    const svc1 = getEncryptionService();
    resetEncryptionService();
    delete process.env.AI_ENGINE_ENCRYPTION_KEY;
    const svc2 = getEncryptionService();
    expect(svc2).toBeNull();
    expect(svc1).not.toBe(svc2);
  });

  it('returns null when only masterKey is set and salt is missing', () => {
    process.env.AI_ENGINE_ENCRYPTION_KEY = TEST_KEY;
    delete process.env.AI_ENGINE_ENCRYPTION_SALT;
    resetEncryptionService();
    expect(getEncryptionService()).toBeNull();
  });

  it('returns null when only salt is set and masterKey is missing', () => {
    delete process.env.AI_ENGINE_ENCRYPTION_KEY;
    process.env.AI_ENGINE_ENCRYPTION_SALT = TEST_SALT;
    resetEncryptionService();
    expect(getEncryptionService()).toBeNull();
  });
});
