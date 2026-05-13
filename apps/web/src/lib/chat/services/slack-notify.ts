/**
 * CHAT-068 — Notification webhook compatible Slack pour les alertes
 * runtime (provider désactivé, budget dépassé, etc.).
 *
 * Format
 * ──────
 * Slack accepte un POST JSON `{ text, attachments?, blocks? }` sur une
 * "Incoming Webhook" URL. On expose la même forme : si l'admin ne
 * configure pas `CHAT_ALERTS_WEBHOOK_URL`, l'appel est no-op (log debug).
 *
 * Robustesse
 * ──────────
 *  - Timeout 5 s (alertes non bloquantes — on ne veut pas ralentir un cron
 *    parce que Slack rame).
 *  - Pas de retry : on accepte la perte d'une alerte plutôt que de bloquer
 *    le caller. Les logs gardent la trace.
 *  - Aucun PII volontaire (label provider + montants OK, pas de session,
 *    ni d'email, ni d'IP).
 */
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';

export interface ChatAlertPayload {
  /** Court titre type "Provider disabled — OpenAI primary". */
  title: string;
  /** Description (1–3 phrases). */
  detail?: string;
  /** Champs structurés affichés en bas (label/value). */
  fields?: Array<{ label: string; value: string }>;
  /** Couleur de severity, mappée vers Slack `attachments.color`. */
  severity?: 'info' | 'warning' | 'critical';
}

const COLOR_BY_SEVERITY: Record<NonNullable<ChatAlertPayload['severity']>, string> = {
  info: '#3b82f6',
  warning: '#f59e0b',
  critical: '#dc2626',
};

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Envoie une alerte au webhook configuré. Retourne `true` si transmise,
 * `false` si pas de webhook configuré ou erreur.
 *
 * Le paramètre `webhookUrl` est extrait pour les tests.
 */
export async function sendChatAlert(
  payload: ChatAlertPayload,
  opts: { webhookUrl?: string | undefined; timeoutMs?: number } = {},
): Promise<boolean> {
  const url = opts.webhookUrl ?? env.CHAT_ALERTS_WEBHOOK_URL;
  if (!url) {
    logger.debug('chat.alert.skipped_no_webhook', { title: payload.title });
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
      logger.warn('chat.alert.webhook_failed', {
        status: res.status,
        title: payload.title,
      });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('chat.alert.webhook_error', {
      reason: (err as Error).message,
      title: payload.title,
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
