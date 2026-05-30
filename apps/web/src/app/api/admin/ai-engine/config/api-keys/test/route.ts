import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { testApiKey } from '@/lib/ai-engine/services/api-key-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const VALID_PROVIDERS = ['openai', 'anthropic', 'google', 'elevenlabs', 'ollama'] as const;

const testApiKeySchema = z.object({
  providerType: z.enum(VALID_PROVIDERS),
  apiKey: z.string().min(1).max(500).optional(),
  baseUrl: z.string().url().optional(),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAdminApi();
    const sessionId = (session as { email?: string }).email ?? 'anonymous';

    // Rate limiting
    const now = Date.now();
    const limiter = rateLimitMap.get(sessionId);
    if (limiter && limiter.resetAt > now) {
      if (limiter.count >= RATE_LIMIT_MAX) {
        return NextResponse.json(
          { error: 'Trop de tentatives. Réessayez dans 1 minute.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((limiter.resetAt - now) / 1000)),
              'Cache-Control': 'no-store',
            },
          },
        );
      }
      limiter.count++;
    } else {
      rateLimitMap.set(sessionId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }

    const body = await request.json();
    const parsed = testApiKeySchema.parse(body);

    const result = await testApiKey(parsed.providerType, parsed.apiKey, parsed.baseUrl);

    return NextResponse.json(
      { result },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    );
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
