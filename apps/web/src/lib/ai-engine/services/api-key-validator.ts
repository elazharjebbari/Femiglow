import { createLogger } from '../utils/logger';

const log = createLogger('services:api-key-validator');

const TIMEOUT_MS = 10_000;

export interface ValidationResult {
  valid: boolean;
  provider: string;
  latencyMs: number;
  error?: string;
}

export async function validateApiKey(
  providerType: string,
  apiKey: string,
  baseUrl?: string,
): Promise<ValidationResult> {
  const start = Date.now();

  try {
    switch (providerType) {
      case 'openai':
        return await testOpenAI(apiKey, start);
      case 'anthropic':
        return await testAnthropic(apiKey, start);
      case 'google':
        return await testGoogle(apiKey, start);
      case 'elevenlabs':
        return await testElevenLabs(apiKey, start);
      case 'higgsfield':
        return await testHiggsfield(apiKey, start);
      case 'ollama':
        return await testOllama(apiKey, baseUrl ?? 'http://localhost:11434', start);
      default:
        return { valid: false, provider: providerType, latencyMs: Date.now() - start, error: `Unknown provider: ${providerType}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error('API key validation failed', { provider: providerType, error: message });
    return { valid: false, provider: providerType, latencyMs: Date.now() - start, error: message };
  }
}

async function testOpenAI(apiKey: string, start: number): Promise<ValidationResult> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return { valid: true, provider: 'openai', latencyMs: Date.now() - start };
  const body = await res.text().catch(() => '');
  return { valid: false, provider: 'openai', latencyMs: Date.now() - start, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
}

async function testAnthropic(apiKey: string, start: number): Promise<ValidationResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok || res.status === 200) return { valid: true, provider: 'anthropic', latencyMs: Date.now() - start };
  if (res.status === 401) return { valid: false, provider: 'anthropic', latencyMs: Date.now() - start, error: 'Invalid API key' };
  // 400/429 means the key is valid but the request was bad or rate limited
  if (res.status === 400 || res.status === 429) return { valid: true, provider: 'anthropic', latencyMs: Date.now() - start };
  return { valid: false, provider: 'anthropic', latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
}

async function testGoogle(apiKey: string, start: number): Promise<ValidationResult> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return { valid: true, provider: 'google', latencyMs: Date.now() - start };
  return { valid: false, provider: 'google', latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
}

async function testElevenLabs(apiKey: string, start: number): Promise<ValidationResult> {
  const res = await fetch('https://api.elevenlabs.io/v1/user', {
    headers: { 'xi-api-key': apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return { valid: true, provider: 'elevenlabs', latencyMs: Date.now() - start };
  return { valid: false, provider: 'elevenlabs', latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
}

async function testHiggsfield(apiKey: string, start: number): Promise<ValidationResult> {
  const res = await fetch('https://api.higgsfield.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return { valid: true, provider: 'higgsfield', latencyMs: Date.now() - start };
  if (res.status === 429 || res.status === 400) return { valid: true, provider: 'higgsfield', latencyMs: Date.now() - start };
  return { valid: false, provider: 'higgsfield', latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
}

async function testOllama(apiKey: string, baseUrl: string, start: number): Promise<ValidationResult> {
  const headers: Record<string, string> = {};
  if (apiKey && !apiKey.startsWith('http')) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  const res = await fetch(`${baseUrl}/api/tags`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return { valid: true, provider: 'ollama', latencyMs: Date.now() - start };
  return { valid: false, provider: 'ollama', latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
}
