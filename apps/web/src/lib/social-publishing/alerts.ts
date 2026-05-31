/**
 * S3.2 — Slack-compatible webhook for social-publishing alerts.
 *
 * Mirrors the chat alerts pattern (`lib/chat/services/slack-notify.ts`) so
 * operators can plug either a dedicated Slack/Discord channel for social
 * pipeline failures via `SOCIAL_ALERTS_WEBHOOK_URL`, or fall back to the
 * existing `CHAT_ALERTS_WEBHOOK_URL` when they don't want a second channel.
 *
 * Non-blocking by design: 5s timeout, no retry. Losing a single alert is
 * preferable to slowing down a publish worker.
 */
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';

export interface SocialAlertPayload {
  title: string;
  detail?: string;
  fields?: Array<{ label: string; value: string }>;
  severity?: 'info' | 'warning' | 'critical';
}

const COLOR_BY_SEVERITY: Record<NonNullable<SocialAlertPayload['severity']>, string> = {
  info: '#3b82f6',
  warning: '#f59e0b',
  critical: '#dc2626',
};

const DEFAULT_TIMEOUT_MS = 5_000;

export async function sendSocialAlert(
  payload: SocialAlertPayload,
  opts: { webhookUrl?: string | undefined; timeoutMs?: number } = {},
): Promise<boolean> {
  const url =
    opts.webhookUrl ??
    env.SOCIAL_ALERTS_WEBHOOK_URL ??
    env.CHAT_ALERTS_WEBHOOK_URL;
  if (!url) {
    logger.debug('social.alert.skipped_no_webhook', { title: payload.title });
    return false;
  }

  const severity = payload.severity ?? 'warning';
  const body = {
    text: payload.title,
    attachments: [
      {
        color: COLOR_BY_SEVERITY[severity],
        title: payload.title,
        text: payload.detail ?? '',
        fields: (payload.fields ?? []).map((f) => ({
          title: f.label,
          value: f.value,
          short: true,
        })),
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn('social.alert.webhook_failed', { status: res.status, title: payload.title });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('social.alert.webhook_error', {
      reason: (err as Error).message,
      title: payload.title,
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
