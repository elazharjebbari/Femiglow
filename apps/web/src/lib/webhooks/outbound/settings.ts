import {
  getTrackingSetting,
  TRACKING_SETTING_KEYS,
} from '@/lib/db/queries/tracking/settings';

export interface LeadWebhookSettings {
  step2WebhookEnabled: boolean;
  step1AbandonEnabled: boolean;
  step1AbandonTimeoutMinutes: number;
  conversationEnabled: boolean;
  conversationMaxMessages: number;
  conversationMaxBytes: number;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function getLeadWebhookSettings(): Promise<LeadWebhookSettings> {
  const [
    step2WebhookEnabled,
    step1AbandonEnabled,
    timeout,
    conversationEnabled,
    maxMessages,
    maxBytes,
  ] = await Promise.all([
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.LEAD_STEP2_WEBHOOK_ENABLED, true),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.LEAD_STEP1_ABANDON_ENABLED, true),
    getTrackingSetting<number>(TRACKING_SETTING_KEYS.LEAD_STEP1_ABANDON_TIMEOUT_MINUTES, 5),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.LEAD_WEBHOOK_CONVERSATION_ENABLED, true),
    getTrackingSetting<number>(TRACKING_SETTING_KEYS.LEAD_WEBHOOK_CONVERSATION_MAX_MESSAGES, 50),
    getTrackingSetting<number>(TRACKING_SETTING_KEYS.LEAD_WEBHOOK_CONVERSATION_MAX_BYTES, 30_000),
  ]);

  return {
    step2WebhookEnabled: Boolean(step2WebhookEnabled),
    step1AbandonEnabled: Boolean(step1AbandonEnabled),
    step1AbandonTimeoutMinutes: clampInt(timeout, 5, 1, 60),
    conversationEnabled: Boolean(conversationEnabled),
    conversationMaxMessages: clampInt(maxMessages, 50, 1, 50),
    conversationMaxBytes: clampInt(maxBytes, 30_000, 1_000, 50_000),
  };
}
