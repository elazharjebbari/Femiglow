import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { aiEngineApiKeys } from '@/lib/db/schema-ai-engine';
import { getEncryptionService } from './encryption-service';
import { validateApiKey, type ValidationResult } from './api-key-validator';
import { createLogger } from '../utils/logger';

const log = createLogger('services:api-key-manager');

const CACHE_TTL_MS = 5 * 60 * 1000;
const resolvedKeyCache = new Map<string, { key: string; expiresAt: number }>();

export type KeySource = 'database' | 'env' | 'none';

export interface ApiKeyInfo {
  id: string | null;
  providerType: string;
  providerName: string;
  label: string;
  source: KeySource;
  masked: string;
  keyPrefix: string;
  keyLastFour: string;
  isActive: boolean;
  baseUrl: string | null;
  lastTestedAt: string | null;
  lastTestResult: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI (Gemini)',
  elevenlabs: 'ElevenLabs',
  higgsfield: 'Higgsfield AI',
  ollama: 'Ollama (local)',
};

const ENV_KEY_MAP: Record<string, string[]> = {
  openai: ['AI_ENGINE_OPENAI_API_KEY', 'CONTENT_STUDIO_OPENAI_API_KEY', 'CHAT_OPENAI_API_KEY', 'OPENAI_API_KEY'],
  anthropic: ['AI_ENGINE_ANTHROPIC_API_KEY', 'CHAT_ANTHROPIC_API_KEY'],
  google: ['GOOGLE_AI_PROVIDER_KEY', 'AI_ENGINE_GOOGLE_API_KEY', 'CHAT_GEMINI_API_KEY'],
  elevenlabs: ['AI_ENGINE_ELEVENLABS_API_KEY'],
  higgsfield: ['AI_ENGINE_HIGGSFIELD_API_KEY'],
  ollama: ['OLLAMA_PROVIDER_KEY', 'AI_ENGINE_OLLAMA_API_KEY', 'AI_ENGINE_OLLAMA_BASE_URL', 'CHAT_OLLAMA_BASE_URL'],
};

function resolveEnvKey(providerType: string): string | undefined {
  const envVars = ENV_KEY_MAP[providerType] ?? [];
  for (const v of envVars) {
    const val = process.env[v];
    if (val) return val;
  }
  return undefined;
}

export async function listApiKeys(): Promise<ApiKeyInfo[]> {
  const drizzle = db();
  const encryption = getEncryptionService();
  const providers = ['openai', 'anthropic', 'google', 'elevenlabs', 'higgsfield', 'ollama'];
  const result: ApiKeyInfo[] = [];

  let dbKeys: (typeof aiEngineApiKeys.$inferSelect)[] = [];
  if (drizzle) {
    dbKeys = await drizzle
      .select()
      .from(aiEngineApiKeys)
      .where(eq(aiEngineApiKeys.isActive, true));
  }

  for (const provider of providers) {
    const dbKey = dbKeys.find((k) => k.providerType === provider);
    const envKey = resolveEnvKey(provider);

    if (dbKey) {
      result.push({
        id: dbKey.id,
        providerType: provider,
        providerName: PROVIDER_NAMES[provider] ?? provider,
        label: dbKey.label,
        source: 'database',
        masked: `${dbKey.keyPrefix}${'*'.repeat(8)}${dbKey.keyLastFour}`,
        keyPrefix: dbKey.keyPrefix,
        keyLastFour: dbKey.keyLastFour,
        isActive: dbKey.isActive,
        baseUrl: dbKey.baseUrl,
        lastTestedAt: dbKey.lastTestedAt?.toISOString() ?? null,
        lastTestResult: dbKey.lastTestResult,
        createdAt: dbKey.createdAt.toISOString(),
        updatedAt: dbKey.updatedAt.toISOString(),
      });
    } else if (envKey) {
      const isOllamaUrl = provider === 'ollama' && envKey.startsWith('http');
      const prefix = isOllamaUrl ? envKey.slice(0, 8) : envKey.slice(0, 6);
      const lastFour = envKey.slice(-4);
      result.push({
        id: null,
        providerType: provider,
        providerName: PROVIDER_NAMES[provider] ?? provider,
        label: `Variable d'environnement`,
        source: 'env',
        masked: `${prefix}${'*'.repeat(Math.max(0, envKey.length - prefix.length - 4))}${lastFour}`,
        keyPrefix: prefix,
        keyLastFour: lastFour,
        isActive: true,
        baseUrl: isOllamaUrl ? envKey : null,
        lastTestedAt: null,
        lastTestResult: null,
        createdAt: null,
        updatedAt: null,
      });
    } else {
      result.push({
        id: null,
        providerType: provider,
        providerName: PROVIDER_NAMES[provider] ?? provider,
        label: 'Non configuré',
        source: 'none',
        masked: '',
        keyPrefix: '',
        keyLastFour: '',
        isActive: false,
        baseUrl: null,
        lastTestedAt: null,
        lastTestResult: null,
        createdAt: null,
        updatedAt: null,
      });
    }
  }

  return result;
}

export async function saveApiKey(
  providerType: string,
  apiKey: string,
  label?: string,
  baseUrl?: string,
): Promise<ApiKeyInfo> {
  const drizzle = db();
  if (!drizzle) throw new Error('Database connection required');

  const encryption = getEncryptionService();
  if (!encryption) throw new Error('Encryption service not available — configure AI_ENGINE_ENCRYPTION_KEY and AI_ENGINE_ENCRYPTION_SALT');

  const encryptedKey = encryption.encrypt(apiKey);
  const { prefix, lastFour, masked } = encryption.mask(apiKey);

  // Deactivate existing key for this provider
  await drizzle
    .update(aiEngineApiKeys)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(aiEngineApiKeys.providerType, providerType),
        eq(aiEngineApiKeys.isActive, true),
      ),
    );

  const [inserted] = await drizzle
    .insert(aiEngineApiKeys)
    .values({
      providerType,
      label: label ?? `${PROVIDER_NAMES[providerType] ?? providerType} API Key`,
      encryptedKey,
      keyPrefix: prefix,
      keyLastFour: lastFour,
      baseUrl: baseUrl ?? null,
      isActive: true,
    })
    .returning();

  const row = inserted!;
  invalidateCache(providerType);

  log.info('API key saved', { providerType, id: row.id });

  return {
    id: row.id,
    providerType,
    providerName: PROVIDER_NAMES[providerType] ?? providerType,
    label: row.label,
    source: 'database',
    masked,
    keyPrefix: prefix,
    keyLastFour: lastFour,
    isActive: true,
    baseUrl: row.baseUrl,
    lastTestedAt: null,
    lastTestResult: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function deleteApiKey(keyId: string): Promise<{ success: boolean; fallbackToEnv: boolean }> {
  const drizzle = db();
  if (!drizzle) throw new Error('Database connection required');

  const [deleted] = await drizzle
    .delete(aiEngineApiKeys)
    .where(eq(aiEngineApiKeys.id, keyId))
    .returning();

  if (!deleted) throw new Error('API key not found');

  invalidateCache(deleted.providerType);

  const envKey = resolveEnvKey(deleted.providerType);
  log.info('API key deleted', { id: keyId, providerType: deleted.providerType, fallbackToEnv: !!envKey });

  return { success: true, fallbackToEnv: !!envKey };
}

export async function testApiKey(
  providerType: string,
  apiKey?: string,
  baseUrl?: string,
): Promise<ValidationResult> {
  let keyToTest = apiKey;

  if (!keyToTest) {
    keyToTest = await resolveApiKey(providerType);
    if (!keyToTest) {
      return { valid: false, provider: providerType, latencyMs: 0, error: 'No API key configured' };
    }
  }

  const result = await validateApiKey(providerType, keyToTest, baseUrl);

  // Update test result in DB if key is from DB
  const drizzle = db();
  if (drizzle && !apiKey) {
    await drizzle
      .update(aiEngineApiKeys)
      .set({
        lastTestedAt: new Date(),
        lastTestResult: result.valid ? 'valid' : (result.error ?? 'invalid'),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiEngineApiKeys.providerType, providerType),
          eq(aiEngineApiKeys.isActive, true),
        ),
      );
  }

  return result;
}

export async function resolveApiKey(providerType: string): Promise<string | undefined> {
  // Check cache first
  const cached = resolvedKeyCache.get(providerType);
  if (cached && cached.expiresAt > Date.now()) return cached.key;

  // Try DB first
  const drizzle = db();
  const encryption = getEncryptionService();

  if (drizzle && encryption) {
    const rows = await drizzle
      .select({ encryptedKey: aiEngineApiKeys.encryptedKey })
      .from(aiEngineApiKeys)
      .where(
        and(
          eq(aiEngineApiKeys.providerType, providerType),
          eq(aiEngineApiKeys.isActive, true),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (row) {
      try {
        const decrypted = encryption.decrypt(row.encryptedKey);
        resolvedKeyCache.set(providerType, { key: decrypted, expiresAt: Date.now() + CACHE_TTL_MS });
        return decrypted;
      } catch (err) {
        log.error('Failed to decrypt API key', { providerType, error: err instanceof Error ? err.message : 'unknown' });
      }
    }
  }

  // Fallback to env
  const envKey = resolveEnvKey(providerType);
  if (envKey) {
    resolvedKeyCache.set(providerType, { key: envKey, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return envKey;
}

export function invalidateCache(providerType?: string): void {
  if (providerType) {
    resolvedKeyCache.delete(providerType);
  } else {
    resolvedKeyCache.clear();
  }
}
