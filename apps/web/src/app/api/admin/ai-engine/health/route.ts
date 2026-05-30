import { NextResponse } from 'next/server';
import { getEngineConfig } from '@/lib/ai-engine/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const config = getEngineConfig();

  const providers: Record<string, { configured: boolean; provider: string }> = {
    text: {
      configured: !!config.apiKeys.openai || !!config.apiKeys.anthropic || !!config.apiKeys.google,
      provider: config.providers.text.default,
    },
    image: {
      configured: config.providers.image.default === 'mock' || !!config.apiKeys.openai || !!config.apiKeys.google,
      provider: config.providers.image.default,
    },
    video: {
      configured: config.providers.video.default === 'mock',
      provider: config.providers.video.default,
    },
    tts: {
      configured: config.providers.tts.default === 'mock' || !!config.apiKeys.elevenlabs,
      provider: config.providers.tts.default,
    },
  };

  return NextResponse.json({
    enabled: config.enabled,
    providers,
    budget: config.budget,
    quality: config.quality,
    version: '1.0.0-mvp',
    timestamp: new Date().toISOString(),
  });
}
