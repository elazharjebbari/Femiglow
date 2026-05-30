import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock functions (Drizzle chain)
// ---------------------------------------------------------------------------
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectLimit = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockDeleteWhere = vi.fn();
const mockDeleteReturning = vi.fn();

const now = new Date('2026-01-15T12:00:00Z');

const baseApiKeyRow = {
  id: 'key-1',
  providerType: 'openai',
  label: 'My OpenAI Key',
  encryptedKey: 'encrypted:data:here',
  keyPrefix: 'sk-proj-',
  keyLastFour: 'abcd',
  baseUrl: null,
  isActive: true,
  lastTestedAt: null,
  lastTestResult: null,
  createdAt: now,
  updatedAt: now,
};

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------
const mockDb = {
  insert: vi.fn(() => ({
    values: mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
    }),
  })),
  select: vi.fn(() => ({
    from: mockSelectFrom.mockReturnValue({
      where: mockSelectWhere.mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([baseApiKeyRow]),
        limit: mockSelectLimit.mockResolvedValue([baseApiKeyRow]),
      }),
    }),
  })),
  update: vi.fn(() => ({
    set: mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere.mockResolvedValue(undefined),
    }),
  })),
  delete: vi.fn(() => ({
    where: mockDeleteWhere.mockReturnValue({
      returning: mockDeleteReturning,
    }),
  })),
};

// ---------------------------------------------------------------------------
// Mock encryption service
// ---------------------------------------------------------------------------
const mockEncryptionService = {
  encrypt: vi.fn((plain: string) => `enc:${plain}`),
  decrypt: vi.fn((enc: string) => enc.replace('enc:', '')),
  mask: vi.fn((key: string) => ({
    prefix: key.slice(0, 6),
    lastFour: key.slice(-4),
    masked: `${key.slice(0, 6)}****${key.slice(-4)}`,
  })),
  isAvailable: vi.fn(() => true),
};

// ---------------------------------------------------------------------------
// Mock validateApiKey
// ---------------------------------------------------------------------------
const mockValidateApiKey = vi.fn();

// ---------------------------------------------------------------------------
// vi.mock declarations
// ---------------------------------------------------------------------------
vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => mockDb),
}));

vi.mock('./encryption-service', () => ({
  getEncryptionService: vi.fn(() => mockEncryptionService),
}));

vi.mock('./api-key-validator', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineApiKeys: {
    id: 'id',
    providerType: 'provider_type',
    label: 'label',
    encryptedKey: 'encrypted_key',
    keyPrefix: 'key_prefix',
    keyLastFour: 'key_last_four',
    baseUrl: 'base_url',
    isActive: 'is_active',
    lastTestedAt: 'last_tested_at',
    lastTestResult: 'last_test_result',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import {
  listApiKeys,
  saveApiKey,
  deleteApiKey,
  testApiKey,
  resolveApiKey,
  invalidateCache,
} from './api-key-manager';
import { db } from '@/lib/db/client';
import { getEncryptionService } from './encryption-service';

// ---------------------------------------------------------------------------
// Env vars we set during tests
// ---------------------------------------------------------------------------
const ENV_KEYS_TO_CLEAN = [
  'AI_ENGINE_OPENAI_API_KEY',
  'CONTENT_STUDIO_OPENAI_API_KEY',
  'CHAT_OPENAI_API_KEY',
  'OPENAI_API_KEY',
  'AI_ENGINE_ANTHROPIC_API_KEY',
  'CHAT_ANTHROPIC_API_KEY',
  'AI_ENGINE_GOOGLE_API_KEY',
  'CHAT_GEMINI_API_KEY',
  'AI_ENGINE_ELEVENLABS_API_KEY',
  'AI_ENGINE_OLLAMA_BASE_URL',
  'CHAT_OLLAMA_BASE_URL',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resetDbChain() {
  // select chain
  mockSelectLimit.mockResolvedValue([baseApiKeyRow]);
  mockSelectWhere.mockReturnValue({
    orderBy: vi.fn().mockResolvedValue([baseApiKeyRow]),
    limit: mockSelectLimit,
  });
  mockSelectFrom.mockReturnValue({
    where: mockSelectWhere,
    orderBy: vi.fn().mockResolvedValue([baseApiKeyRow]),
  });
  mockDb.select.mockReturnValue({ from: mockSelectFrom });

  // insert chain
  mockInsertReturning.mockResolvedValue([baseApiKeyRow]);
  mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
  mockDb.insert.mockReturnValue({ values: mockInsertValues });

  // update chain
  mockUpdateWhere.mockResolvedValue(undefined);
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockDb.update.mockReturnValue({ set: mockUpdateSet });

  // delete chain
  mockDeleteReturning.mockResolvedValue([baseApiKeyRow]);
  mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning });
  mockDb.delete.mockReturnValue({ where: mockDeleteWhere });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('api-key-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateCache(); // clear the module-level cache
    (db as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
    (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(mockEncryptionService);

    // Reset encryption mock implementations (clearAllMocks only clears calls, not impl)
    mockEncryptionService.encrypt.mockImplementation((plain: string) => `enc:${plain}`);
    mockEncryptionService.decrypt.mockImplementation((enc: string) => enc.replace('enc:', ''));
    mockEncryptionService.mask.mockImplementation((key: string) => ({
      prefix: key.slice(0, 6),
      lastFour: key.slice(-4),
      masked: `${key.slice(0, 6)}****${key.slice(-4)}`,
    }));

    resetDbChain();
  });

  afterEach(() => {
    for (const key of ENV_KEYS_TO_CLEAN) {
      delete process.env[key];
    }
    vi.useRealTimers();
  });

  // =========================================================================
  // resolveEnvKey (tested indirectly via resolveApiKey)
  // =========================================================================
  describe('resolveEnvKey (via resolveApiKey)', () => {
    it('1 - prioritises AI_ENGINE_ key before CHAT_ key before generic', async () => {
      // No DB, no encryption — force env-only path
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(null);

      process.env.OPENAI_API_KEY = 'generic-key';
      process.env.CHAT_OPENAI_API_KEY = 'chat-key';
      process.env.AI_ENGINE_OPENAI_API_KEY = 'ai-engine-key';

      const result = await resolveApiKey('openai');
      expect(result).toBe('ai-engine-key');
    });

    it('2 - returns undefined when no env var is set', async () => {
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const result = await resolveApiKey('openai');
      expect(result).toBeUndefined();
    });

    it('3 - returns undefined for unknown provider', async () => {
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const result = await resolveApiKey('unknown-provider');
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // listApiKeys
  // =========================================================================
  describe('listApiKeys', () => {
    it('4 - returns all 6 providers with correct source types', async () => {
      // DB returns one active key for openai only
      const openaiRow = { ...baseApiKeyRow, providerType: 'openai' };
      mockSelectWhere.mockResolvedValue([openaiRow]);

      // Set env key for anthropic
      process.env.AI_ENGINE_ANTHROPIC_API_KEY = 'sk-ant-test1234567890';

      const keys = await listApiKeys();
      expect(keys).toHaveLength(6);

      const providers = keys.map((k) => k.providerType);
      expect(providers).toEqual(['openai', 'anthropic', 'google', 'elevenlabs', 'higgsfield', 'ollama']);

      const openai = keys.find((k) => k.providerType === 'openai')!;
      expect(openai.source).toBe('database');

      const anthropic = keys.find((k) => k.providerType === 'anthropic')!;
      expect(anthropic.source).toBe('env');

      const google = keys.find((k) => k.providerType === 'google')!;
      expect(google.source).toBe('none');
    });

    it('5 - DB key returns source=database with correctly masked format', async () => {
      const row = { ...baseApiKeyRow, providerType: 'openai', keyPrefix: 'sk-proj-', keyLastFour: 'xyzw' };
      mockSelectWhere.mockResolvedValue([row]);

      const keys = await listApiKeys();
      const openai = keys.find((k) => k.providerType === 'openai')!;

      expect(openai.source).toBe('database');
      expect(openai.masked).toBe('sk-proj-********xyzw');
      expect(openai.keyPrefix).toBe('sk-proj-');
      expect(openai.keyLastFour).toBe('xyzw');
    });

    it('6 - env key found (no DB row) returns source=env', async () => {
      mockSelectWhere.mockResolvedValue([]);
      process.env.AI_ENGINE_OPENAI_API_KEY = 'sk-proj-abcdefghijklmnop';

      const keys = await listApiKeys();
      const openai = keys.find((k) => k.providerType === 'openai')!;
      expect(openai.source).toBe('env');
      expect(openai.id).toBeNull();
      expect(openai.isActive).toBe(true);
    });

    it('7 - no key anywhere returns source=none', async () => {
      mockSelectWhere.mockResolvedValue([]);

      const keys = await listApiKeys();
      const openai = keys.find((k) => k.providerType === 'openai')!;
      expect(openai.source).toBe('none');
      expect(openai.isActive).toBe(false);
      expect(openai.masked).toBe('');
    });

    it('8 - DB is null falls back to env-only', async () => {
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);
      process.env.AI_ENGINE_OPENAI_API_KEY = 'sk-proj-abcdefghijklmnop';

      const keys = await listApiKeys();
      expect(keys).toHaveLength(6);
      const openai = keys.find((k) => k.providerType === 'openai')!;
      expect(openai.source).toBe('env');
    });

    it('9 - Ollama special handling (prefix=8 chars, baseUrl=envKey)', async () => {
      mockSelectWhere.mockResolvedValue([]);
      process.env.AI_ENGINE_OLLAMA_BASE_URL = 'http://localhost:11434';

      const keys = await listApiKeys();
      const ollama = keys.find((k) => k.providerType === 'ollama')!;
      expect(ollama.source).toBe('env');
      expect(ollama.keyPrefix).toBe('http://l'); // 8 chars for ollama
      expect(ollama.baseUrl).toBe('http://localhost:11434');
    });

    it('10 - NEVER returns encryptedKey field', async () => {
      const row = { ...baseApiKeyRow, providerType: 'openai' };
      mockSelectWhere.mockResolvedValue([row]);

      const keys = await listApiKeys();
      for (const k of keys) {
        expect(k).not.toHaveProperty('encryptedKey');
      }
    });
  });

  // =========================================================================
  // saveApiKey
  // =========================================================================
  describe('saveApiKey', () => {
    it('11 - happy path: encrypts, deactivates old, inserts new, invalidates cache', async () => {
      const insertedRow = {
        ...baseApiKeyRow,
        id: 'key-new',
        providerType: 'openai',
        label: 'Custom label',
        baseUrl: null,
        createdAt: now,
        updatedAt: now,
      };
      mockInsertReturning.mockResolvedValue([insertedRow]);

      const result = await saveApiKey('openai', 'sk-proj-testkey1234', 'Custom label');

      // Encryption called
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('sk-proj-testkey1234');
      expect(mockEncryptionService.mask).toHaveBeenCalledWith('sk-proj-testkey1234');

      // Deactivate old key
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalled();

      // Insert new key
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalled();

      expect(result.source).toBe('database');
      expect(result.id).toBe('key-new');
    });

    it('12 - no DB throws "Database connection required"', async () => {
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await expect(saveApiKey('openai', 'sk-test')).rejects.toThrow('Database connection required');
    });

    it('13 - no encryption service throws with message about configuring env vars', async () => {
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await expect(saveApiKey('openai', 'sk-test')).rejects.toThrow(
        'Encryption service not available',
      );
    });

    it('14 - invalidates cache after successful save', async () => {
      // Pre-populate cache via resolveApiKey
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(null);
      process.env.AI_ENGINE_OPENAI_API_KEY = 'old-key';
      await resolveApiKey('openai');

      // Restore mocks for saveApiKey
      (db as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(mockEncryptionService);
      resetDbChain();

      await saveApiKey('openai', 'sk-new-key');

      // After save, cache should be invalidated.
      // Resolve again — if cache was invalidated, it will re-query (or fall back to env)
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(null);
      process.env.AI_ENGINE_OPENAI_API_KEY = 'new-env-key';
      const resolved = await resolveApiKey('openai');
      expect(resolved).toBe('new-env-key'); // would have been 'old-key' if cache wasn't invalidated
    });

    it('15 - uses default label when none provided', async () => {
      mockInsertReturning.mockResolvedValue([{ ...baseApiKeyRow, label: 'OpenAI API Key' }]);

      await saveApiKey('openai', 'sk-test');

      const valuesArg = mockInsertValues.mock.calls[0]![0] as Record<string, unknown>;
      expect(valuesArg.label).toBe('OpenAI API Key');
    });
  });

  // =========================================================================
  // deleteApiKey
  // =========================================================================
  describe('deleteApiKey', () => {
    it('16 - happy path: deletes, invalidates cache, returns fallback info', async () => {
      mockDeleteReturning.mockResolvedValue([baseApiKeyRow]);
      process.env.AI_ENGINE_OPENAI_API_KEY = 'fallback-env-key';

      const result = await deleteApiKey('key-1');

      expect(result.success).toBe(true);
      expect(result.fallbackToEnv).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('17 - key not found throws "API key not found"', async () => {
      mockDeleteReturning.mockResolvedValue([]);

      await expect(deleteApiKey('non-existent')).rejects.toThrow('API key not found');
    });

    it('18 - no DB throws', async () => {
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);

      await expect(deleteApiKey('key-1')).rejects.toThrow('Database connection required');
    });

    it('19 - fallbackToEnv=true when env var exists for that provider', async () => {
      mockDeleteReturning.mockResolvedValue([{ ...baseApiKeyRow, providerType: 'anthropic' }]);
      process.env.AI_ENGINE_ANTHROPIC_API_KEY = 'sk-ant-fallback';

      const result = await deleteApiKey('key-1');
      expect(result.fallbackToEnv).toBe(true);
    });

    it('20 - fallbackToEnv=false when no env var', async () => {
      mockDeleteReturning.mockResolvedValue([{ ...baseApiKeyRow, providerType: 'anthropic' }]);
      // No env vars set for anthropic

      const result = await deleteApiKey('key-1');
      expect(result.fallbackToEnv).toBe(false);
    });
  });

  // =========================================================================
  // testApiKey
  // =========================================================================
  describe('testApiKey', () => {
    it('21 - with explicit apiKey parameter calls validateApiKey directly', async () => {
      mockValidateApiKey.mockResolvedValue({ valid: true, provider: 'openai', latencyMs: 42 });

      const result = await testApiKey('openai', 'sk-explicit-key');

      expect(result.valid).toBe(true);
      expect(mockValidateApiKey).toHaveBeenCalledWith('openai', 'sk-explicit-key', undefined);
    });

    it('22 - without apiKey resolves from DB/env first', async () => {
      // resolveApiKey will hit DB and decrypt
      mockSelectWhere.mockReturnValue({
        limit: mockSelectLimit.mockResolvedValue([{ encryptedKey: 'enc:resolved-key' }]),
      });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockDb.select.mockReturnValue({ from: mockSelectFrom });

      mockValidateApiKey.mockResolvedValue({ valid: true, provider: 'openai', latencyMs: 30 });

      const result = await testApiKey('openai');

      expect(result.valid).toBe(true);
      expect(mockValidateApiKey).toHaveBeenCalledWith('openai', 'resolved-key', undefined);
    });

    it('23 - no key available returns {valid: false, error: "No API key configured"}', async () => {
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(null);
      // No env vars set

      const result = await testApiKey('openai');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No API key configured');
    });

    it('24 - updates DB test result when key is from DB (not explicit)', async () => {
      // resolveApiKey returns a key from DB
      mockSelectWhere.mockReturnValue({
        limit: mockSelectLimit.mockResolvedValue([{ encryptedKey: 'enc:db-key' }]),
      });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockDb.select.mockReturnValue({ from: mockSelectFrom });

      mockValidateApiKey.mockResolvedValue({ valid: true, provider: 'openai', latencyMs: 10 });

      // Reset update chain for tracking
      mockUpdateWhere.mockResolvedValue(undefined);
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
      mockDb.update.mockReturnValue({ set: mockUpdateSet });

      await testApiKey('openai');

      // Should have called update to store test result
      expect(mockDb.update).toHaveBeenCalled();
      const setArg = mockUpdateSet.mock.calls[0]![0] as Record<string, unknown>;
      expect(setArg).toHaveProperty('lastTestedAt');
      expect(setArg.lastTestResult).toBe('valid');
    });

    it('25 - does NOT update DB when apiKey was passed explicitly', async () => {
      mockValidateApiKey.mockResolvedValue({ valid: true, provider: 'openai', latencyMs: 5 });

      await testApiKey('openai', 'sk-explicit-key');

      // update should NOT be called
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // resolveApiKey
  // =========================================================================
  describe('resolveApiKey', () => {
    it('26 - returns from cache when not expired', async () => {
      // First call: DB resolves
      mockSelectWhere.mockReturnValue({
        limit: mockSelectLimit.mockResolvedValue([{ encryptedKey: 'enc:cached-key' }]),
      });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockDb.select.mockReturnValue({ from: mockSelectFrom });

      const first = await resolveApiKey('openai');
      expect(first).toBe('cached-key');

      // Reset spy counters
      mockDb.select.mockClear();

      // Second call: should use cache, not DB
      const second = await resolveApiKey('openai');
      expect(second).toBe('cached-key');
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('27 - cache expired re-fetches from DB', async () => {
      vi.useFakeTimers();

      mockSelectWhere.mockReturnValue({
        limit: mockSelectLimit.mockResolvedValue([{ encryptedKey: 'enc:first-key' }]),
      });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockDb.select.mockReturnValue({ from: mockSelectFrom });

      const first = await resolveApiKey('openai');
      expect(first).toBe('first-key');

      // Advance past the 5-minute TTL
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      // Reconfigure DB to return new key
      mockSelectLimit.mockResolvedValue([{ encryptedKey: 'enc:second-key' }]);
      mockSelectWhere.mockReturnValue({
        limit: mockSelectLimit,
      });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockDb.select.mockReturnValue({ from: mockSelectFrom });

      const second = await resolveApiKey('openai');
      expect(second).toBe('second-key');
      // DB was queried again
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('28 - decrypts DB key successfully and caches result', async () => {
      mockSelectWhere.mockReturnValue({
        limit: mockSelectLimit.mockResolvedValue([{ encryptedKey: 'enc:my-secret-key' }]),
      });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockDb.select.mockReturnValue({ from: mockSelectFrom });

      const result = await resolveApiKey('openai');
      expect(result).toBe('my-secret-key');
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('enc:my-secret-key');

      // Verify cached — second call should not query DB
      mockDb.select.mockClear();
      const second = await resolveApiKey('openai');
      expect(second).toBe('my-secret-key');
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('29 - decrypt failure falls back to env silently', async () => {
      mockEncryptionService.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      mockSelectWhere.mockReturnValue({
        limit: mockSelectLimit.mockResolvedValue([{ encryptedKey: 'corrupted-data' }]),
      });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockDb.select.mockReturnValue({ from: mockSelectFrom });

      process.env.AI_ENGINE_OPENAI_API_KEY = 'env-fallback-key';

      const result = await resolveApiKey('openai');
      expect(result).toBe('env-fallback-key');
    });

    it('30 - no DB/encryption falls back to env', async () => {
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(null);

      process.env.AI_ENGINE_OPENAI_API_KEY = 'env-only-key';

      const result = await resolveApiKey('openai');
      expect(result).toBe('env-only-key');
    });

    it('31 - no key anywhere returns undefined', async () => {
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const result = await resolveApiKey('openai');
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // invalidateCache
  // =========================================================================
  describe('invalidateCache', () => {
    /** Helper: wire mock DB to return a specific encrypted key for resolveApiKey */
    function wireSelectForResolve(encryptedKey: string) {
      const limitFn = vi.fn().mockResolvedValue([{ encryptedKey }]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select.mockReturnValue({ from: fromFn });
    }

    /** Helper: wire mock DB to return empty result for resolveApiKey */
    function wireSelectEmpty() {
      const limitFn = vi.fn().mockResolvedValue([]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select.mockReturnValue({ from: fromFn });
    }

    it('32 - single provider invalidation', async () => {
      // Populate cache for openai via DB
      wireSelectForResolve('enc:key-a');
      await resolveApiKey('openai');

      // Populate cache for anthropic via env
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(null);
      process.env.AI_ENGINE_ANTHROPIC_API_KEY = 'sk-ant-key';
      await resolveApiKey('anthropic');

      // Restore mocks for DB path
      (db as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(mockEncryptionService);

      // Invalidate only openai
      invalidateCache('openai');

      // openai should re-fetch from DB
      mockDb.select.mockClear();
      wireSelectForResolve('enc:key-b');

      const openaiResult = await resolveApiKey('openai');
      expect(openaiResult).toBe('key-b');
      expect(mockDb.select).toHaveBeenCalled(); // re-fetched

      // anthropic should still be cached (not invalidated)
      mockDb.select.mockClear();
      const anthropicResult = await resolveApiKey('anthropic');
      expect(anthropicResult).toBe('sk-ant-key');
      expect(mockDb.select).not.toHaveBeenCalled(); // still cached
    });

    it('33 - all providers invalidation (no argument)', async () => {
      // Populate cache for openai via DB
      wireSelectForResolve('enc:key-openai');
      await resolveApiKey('openai');

      // Populate cache for anthropic via env
      (db as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(null);
      process.env.AI_ENGINE_ANTHROPIC_API_KEY = 'sk-ant-cached';
      await resolveApiKey('anthropic');

      // Restore mocks
      (db as ReturnType<typeof vi.fn>).mockReturnValue(mockDb);
      (getEncryptionService as ReturnType<typeof vi.fn>).mockReturnValue(mockEncryptionService);

      // Invalidate all
      invalidateCache();

      // openai should re-fetch
      mockDb.select.mockClear();
      wireSelectForResolve('enc:key-openai-new');

      const openaiResult = await resolveApiKey('openai');
      expect(openaiResult).toBe('key-openai-new');
      expect(mockDb.select).toHaveBeenCalled();

      // anthropic also re-fetches (cache was cleared)
      mockDb.select.mockClear();
      wireSelectEmpty();

      const anthropicResult = await resolveApiKey('anthropic');
      // DB returns nothing now, falls back to env
      expect(anthropicResult).toBe('sk-ant-cached');
      expect(mockDb.select).toHaveBeenCalled(); // re-fetched (not cached)
    });
  });
});
