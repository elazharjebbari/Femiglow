import type { TrackingProvider, TrackingProviderResult } from '@/lib/db/types';
import type { DispatchContext, ProviderAdapter } from './types';

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bdocument\.cookie\b/i,
  /\beval\s*\(/i,
  /\bfunction\s+constructor\b/i,
  /\bxmlhttprequest\b/i,
  /\bnew\s+function\b/i,
  /\bsrcdoc\b/i,
  /\bjavascript:/i,
];
const ALLOWED_HOST_PATTERNS = [
  /^https:\/\/[a-z0-9.-]+\/[\w./?=&%-]*$/i,
];
const MAX_LENGTH = 50_000;

export interface CustomCodeValidation {
  ok: boolean;
  errors: string[];
}

export function validateCustomCode(code: string): CustomCodeValidation {
  const errors: string[] = [];
  if (!code || typeof code !== 'string') errors.push('empty');
  if (code.length > MAX_LENGTH) errors.push('too_long');
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(code)) errors.push(`forbidden:${pattern.source}`);
  }
  const urls = code.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
  for (const url of urls) {
    if (!ALLOWED_HOST_PATTERNS.some((p) => p.test(url))) {
      errors.push(`unsafe_url:${url.slice(0, 64)}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export const customAdapter: ProviderAdapter = {
  kind: 'custom',
  supports(): boolean {
    return true;
  },
  async dispatch(provider: TrackingProvider): Promise<TrackingProviderResult> {
    if (provider.status !== 'enabled') {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'provider_disabled' };
    }
    return {
      status: 'skipped',
      latencyMs: 0,
      attempts: 0,
      error: 'client_only',
    };
  },
  clientSnippet(provider: TrackingProvider): string | null {
    if (provider.status !== 'enabled') return null;
    const head = provider.customHead ?? '';
    const body = provider.customBody ?? '';
    const combined = `${head}\n${body}`.trim();
    if (!combined) return null;
    const validation = validateCustomCode(combined);
    if (!validation.ok) return null;
    return combined;
  },
  cspHosts() {
    return { scriptSrc: [], connectSrc: [] };
  },
};

export function customAdapterContext(_ctx: DispatchContext): void {
  // pas d'effet serveur
}
