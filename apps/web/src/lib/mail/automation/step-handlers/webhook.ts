/**
 * webhook step handler — POST/PUT à un endpoint externe (M5.5).
 *
 * Anti-SSRF : on n'autorise que HTTPS + on rejette les domaines internes
 * (localhost, *.local, 10.*, 192.168.*). Pour V1, on s'appuie sur le
 * format URL validé en Zod (https://...) — la liste internes est checkée
 * ici en runtime.
 */
import 'server-only';
import { logger } from '@/lib/logging/logger';

export type WebhookStep = {
  kind: 'webhook';
  url: string;
  method: 'POST' | 'PUT';
  body?: Record<string, unknown>;
};

const INTERNAL_HOSTS = [
  /^localhost$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
];

function isInternalHost(host: string): boolean {
  return INTERNAL_HOSTS.some((re) => re.test(host));
}

export async function handleWebhookStep(
  step: WebhookStep,
  recipientEmail: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status?: number; reason?: string }> {
  let url: URL;
  try {
    url = new URL(step.url);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'https_only' };
  }
  if (isInternalHost(url.hostname)) {
    return { ok: false, reason: 'internal_host_blocked' };
  }

  const payload = {
    ...(step.body ?? {}),
    _automation: {
      recipientEmail,
      timestamp: new Date().toISOString(),
    },
  };

  try {
    const res = await fetchImpl(step.url, {
      method: step.method,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'FemiGlow-Automation/1.0',
      },
      body: JSON.stringify(payload),
      // Pas de redirect automatique (anti-SSRF redirect bypass)
      redirect: 'error',
    });
    logger.info('automation.webhook.dispatched', {
      url: step.url,
      method: step.method,
      status: res.status,
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    logger.error('automation.webhook.failed', { url: step.url, error: String(err) });
    return { ok: false, reason: 'fetch_error' };
  }
}
