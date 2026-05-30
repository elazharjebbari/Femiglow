import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { listApiKeys, saveApiKey } from '@/lib/ai-engine/services/api-key-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_PROVIDERS = ['openai', 'anthropic', 'google', 'elevenlabs', 'ollama'] as const;

const createApiKeySchema = z.object({
  providerType: z.enum(VALID_PROVIDERS),
  apiKey: z.string().min(1).max(500),
  label: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().optional(),
});

export async function GET(): Promise<Response> {
  try {
    await requireAdminApi();

    const keys = await listApiKeys();

    return NextResponse.json(
      { apiKeys: keys },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    );
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdminApi();

    const body = await request.json();
    const parsed = createApiKeySchema.parse(body);

    const saved = await saveApiKey(
      parsed.providerType,
      parsed.apiKey,
      parsed.label,
      parsed.baseUrl,
    );

    return NextResponse.json(
      { apiKey: saved },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.errors },
        { status: 400 },
      );
    }
    if (err instanceof Error && err.message.includes('Encryption service not available')) {
      return NextResponse.json(
        { error: 'Le chiffrement n\'est pas configuré. Ajoutez AI_ENGINE_ENCRYPTION_KEY et AI_ENGINE_ENCRYPTION_SALT.' },
        { status: 503 },
      );
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
