import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { getEngineConfig } from '@/lib/ai-engine/config';
import { db } from '@/lib/db/client';
import { aiEngineProviderConfigs } from '@/lib/db/schema-ai-engine';
import { desc, eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- Types ---------- */

interface ProviderConfigResponse {
  id: string;
  providerType: string;
  name: string;
  apiKeyEnvVar: string;
  baseUrl: string | null;
  capabilities: string[];
  models: unknown;
  rateLimitRpm: number | null;
  dailyBudgetCents: number | null;
  circuitBreakerConfig: unknown;
  priority: number;
  isFallback: boolean;
  isEnabled: boolean;
  healthStatus: string;
  lastHealthCheck: string | null;
  configured: boolean;
}

/* ---------- Build from env vars (fallback when DB empty) ---------- */

function getDefaultProviders(): ProviderConfigResponse[] {
  const config = getEngineConfig();
  const now = new Date().toISOString();

  return [
    {
      id: 'default-openai',
      providerType: 'openai',
      name: 'OpenAI',
      apiKeyEnvVar: 'AI_ENGINE_OPENAI_API_KEY',
      baseUrl: null,
      capabilities: ['text', 'image', 'tts', 'embedding', 'moderation', 'vision'],
      models: [
        { name: 'gpt-4o', capability: 'text', costPer1MInput: 250, costPer1MOutput: 1000 },
        { name: 'gpt-4o-mini', capability: 'text', costPer1MInput: 15, costPer1MOutput: 60 },
        { name: 'dall-e-3', capability: 'image', costPerUnit: 4000 },
        { name: 'tts-1', capability: 'tts', costPerUnit: 1500 },
        { name: 'text-embedding-3-small', capability: 'embedding', costPer1MInput: 2 },
      ],
      rateLimitRpm: 500,
      dailyBudgetCents: Math.round(config.budget.dailyCents * 0.5),
      circuitBreakerConfig: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
      priority: 10,
      isFallback: false,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: now,
      configured: !!config.apiKeys.openai,
    },
    {
      id: 'default-anthropic',
      providerType: 'anthropic',
      name: 'Anthropic',
      apiKeyEnvVar: 'AI_ENGINE_ANTHROPIC_API_KEY',
      baseUrl: null,
      capabilities: ['text', 'vision'],
      models: [
        { name: 'claude-sonnet-4-20250514', capability: 'text', costPer1MInput: 300, costPer1MOutput: 1500 },
        { name: 'claude-haiku-4-20250514', capability: 'text', costPer1MInput: 80, costPer1MOutput: 400 },
      ],
      rateLimitRpm: 100,
      dailyBudgetCents: Math.round(config.budget.dailyCents * 0.3),
      circuitBreakerConfig: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
      priority: 20,
      isFallback: true,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: now,
      configured: !!config.apiKeys.anthropic,
    },
    {
      id: 'default-google',
      providerType: 'google',
      name: 'Google AI (Gemini)',
      apiKeyEnvVar: 'AI_ENGINE_GOOGLE_API_KEY',
      baseUrl: null,
      capabilities: ['text', 'image', 'video', 'embedding', 'vision'],
      models: [
        { name: 'gemini-2.5-flash', capability: 'text', costPer1MInput: 15, costPer1MOutput: 60 },
        { name: 'gemini-2.5-pro', capability: 'text', costPer1MInput: 125, costPer1MOutput: 1000 },
        { name: 'imagen-3', capability: 'image', costPerUnit: 2000 },
      ],
      rateLimitRpm: 60,
      dailyBudgetCents: Math.round(config.budget.dailyCents * 0.15),
      circuitBreakerConfig: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
      priority: 30,
      isFallback: true,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: now,
      configured: !!config.apiKeys.google,
    },
    {
      id: 'default-elevenlabs',
      providerType: 'elevenlabs',
      name: 'ElevenLabs',
      apiKeyEnvVar: 'AI_ENGINE_ELEVENLABS_API_KEY',
      baseUrl: null,
      capabilities: ['tts'],
      models: [
        { name: 'eleven_multilingual_v2', capability: 'tts', costPerUnit: 3000 },
      ],
      rateLimitRpm: 30,
      dailyBudgetCents: Math.round(config.budget.dailyCents * 0.05),
      circuitBreakerConfig: { failureThreshold: 3, resetTimeoutMs: 120000, halfOpenMaxCalls: 1 },
      priority: 40,
      isFallback: false,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: now,
      configured: !!config.apiKeys.elevenlabs,
    },
    {
      id: 'default-ollama',
      providerType: 'ollama',
      name: 'Ollama',
      apiKeyEnvVar: 'OLLAMA_PROVIDER_KEY',
      baseUrl: config.apiKeys.ollamaBaseUrl ?? 'http://localhost:11434',
      capabilities: ['text', 'embedding'],
      models: [
        { name: 'glm-5.1:cloud', capability: 'text', costPer1MInput: 0, costPer1MOutput: 0 },
        { name: 'llama3.1:8b', capability: 'text', costPer1MInput: 0, costPer1MOutput: 0 },
        { name: 'nomic-embed-text', capability: 'embedding', costPer1MInput: 0 },
      ],
      rateLimitRpm: 1000,
      dailyBudgetCents: 0,
      circuitBreakerConfig: { failureThreshold: 3, resetTimeoutMs: 30000, halfOpenMaxCalls: 1 },
      priority: 99,
      isFallback: true,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: now,
      configured: !!(config.apiKeys.ollamaBaseUrl || process.env.OLLAMA_PROVIDER_KEY),
    },
    {
      id: 'default-higgsfield',
      providerType: 'higgsfield',
      name: 'Higgsfield AI',
      apiKeyEnvVar: 'AI_ENGINE_HIGGSFIELD_API_KEY',
      baseUrl: 'https://api.higgsfield.ai',
      capabilities: ['image', 'video'],
      models: [
        { name: 'flux_2', capability: 'image', costPerUnit: 100 },
        { name: 'flux_kontext', capability: 'image', costPerUnit: 100 },
        { name: 'cinematic_studio_2_5', capability: 'image', costPerUnit: 200 },
        { name: 'image_auto', capability: 'image', costPerUnit: 100 },
        { name: 'cinematic_studio_3_0', capability: 'video', costPerUnit: 500 },
        { name: 'veo3_1', capability: 'video', costPerUnit: 800 },
        { name: 'kling3_0', capability: 'video', costPerUnit: 500 },
        { name: 'wan2_7', capability: 'video', costPerUnit: 400 },
      ],
      rateLimitRpm: 60,
      dailyBudgetCents: Math.round(config.budget.dailyCents * 0.15),
      circuitBreakerConfig: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
      priority: 15,
      isFallback: false,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: now,
      configured: !!process.env.AI_ENGINE_HIGGSFIELD_API_KEY,
    },
  ];
}

/* ---------- GET: list all providers ---------- */

export async function GET(): Promise<Response> {
  try {
    await requireAdminApi();

    const database = db();
    if (database) {
      const rows = await database
        .select()
        .from(aiEngineProviderConfigs)
        .orderBy(desc(aiEngineProviderConfigs.priority));

      if (rows.length > 0) {
        const config = getEngineConfig();
        const envKeyMap: Record<string, string | undefined> = {
          AI_ENGINE_OPENAI_API_KEY: config.apiKeys.openai,
          AI_ENGINE_ANTHROPIC_API_KEY: config.apiKeys.anthropic,
          AI_ENGINE_GOOGLE_API_KEY: config.apiKeys.google,
          AI_ENGINE_ELEVENLABS_API_KEY: config.apiKeys.elevenlabs,
          AI_ENGINE_HIGGSFIELD_API_KEY: config.apiKeys.higgsfield,
          AI_ENGINE_OLLAMA_BASE_URL: config.apiKeys.ollamaBaseUrl,
          OLLAMA_PROVIDER_KEY: config.apiKeys.ollamaBaseUrl || process.env.OLLAMA_PROVIDER_KEY,
        };

        const mapped: ProviderConfigResponse[] = rows.map((r) => ({
          id: r.id,
          providerType: r.providerType,
          name: r.name,
          apiKeyEnvVar: r.apiKeyEnvVar,
          baseUrl: r.baseUrl,
          capabilities: r.capabilities,
          models: r.models,
          rateLimitRpm: r.rateLimitRpm,
          dailyBudgetCents: r.dailyBudgetCents,
          circuitBreakerConfig: r.circuitBreakerConfig,
          priority: r.priority,
          isFallback: r.isFallback,
          isEnabled: r.isEnabled,
          healthStatus: r.healthStatus,
          lastHealthCheck: r.lastHealthCheck?.toISOString() ?? null,
          configured: !!envKeyMap[r.apiKeyEnvVar],
        }));
        return NextResponse.json({ providers: mapped });
      }
    }

    return NextResponse.json({ providers: getDefaultProviders() });
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}

/* ---------- POST: update provider configuration ---------- */

const providerUpdateSchema = z.object({
  id: z.string(),
  isEnabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  isFallback: z.boolean().optional(),
  dailyBudgetCents: z.number().int().nonnegative().optional(),
  rateLimitRpm: z.number().int().positive().optional(),
  circuitBreakerConfig: z.object({
    failureThreshold: z.number().int().positive(),
    resetTimeoutMs: z.number().int().positive(),
    halfOpenMaxCalls: z.number().int().positive(),
  }).optional(),
  baseUrl: z.string().url().nullish(),
  models: z.array(z.object({
    name: z.string().min(1),
    capability: z.enum(['text', 'image', 'video', 'tts', 'stt', 'embedding', 'music', 'moderation', 'vision']),
    costPer1MInput: z.number().nonnegative().optional(),
    costPer1MOutput: z.number().nonnegative().optional(),
    costPerUnit: z.number().nonnegative().optional(),
    maxTokens: z.number().int().positive().optional(),
    supportsStructuredOutput: z.boolean().optional(),
    supportsVision: z.boolean().optional(),
  })).optional(),
});

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdminApi();

    const body = await request.json();
    const parsed = providerUpdateSchema.parse(body);

    const database = db();
    if (!database) {
      return NextResponse.json(
        { error: 'Database non disponible. Mode memoire uniquement.' },
        { status: 503 },
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.isEnabled !== undefined) updateData.isEnabled = parsed.isEnabled;
    if (parsed.priority !== undefined) updateData.priority = parsed.priority;
    if (parsed.isFallback !== undefined) updateData.isFallback = parsed.isFallback;
    if (parsed.dailyBudgetCents !== undefined) updateData.dailyBudgetCents = parsed.dailyBudgetCents;
    if (parsed.rateLimitRpm !== undefined) updateData.rateLimitRpm = parsed.rateLimitRpm;
    if (parsed.circuitBreakerConfig !== undefined) updateData.circuitBreakerConfig = parsed.circuitBreakerConfig;
    if (parsed.baseUrl !== undefined) updateData.baseUrl = parsed.baseUrl;
    if (parsed.models !== undefined) updateData.models = parsed.models;

    const [updated] = await database
      .update(aiEngineProviderConfigs)
      .set(updateData)
      .where(eq(aiEngineProviderConfigs.id, parsed.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 });
    }

    return NextResponse.json({ provider: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.errors },
        { status: 400 },
      );
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
