import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  getTrackingSetting,
  setTrackingSetting,
  TRACKING_SETTING_KEYS,
} from '@/lib/db/queries/tracking/settings';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SettingsView {
  consentBannerEnabled: boolean;
  consentDefaultGranted: boolean;
  leadStep2WebhookEnabled: boolean;
  leadStep1AbandonEnabled: boolean;
  leadStep1AbandonTimeoutMinutes: number;
  leadWebhookConversationEnabled: boolean;
  leadWebhookConversationMaxMessages: number;
  leadWebhookConversationMaxBytes: number;
  leadInlineContactWebhookEnabled: boolean;
}

async function loadSettings(): Promise<SettingsView> {
  const [
    consentBannerEnabled,
    consentDefaultGranted,
    leadStep2WebhookEnabled,
    leadStep1AbandonEnabled,
    leadStep1AbandonTimeoutMinutes,
    leadWebhookConversationEnabled,
    leadWebhookConversationMaxMessages,
    leadWebhookConversationMaxBytes,
    leadInlineContactWebhookEnabled,
  ] = await Promise.all([
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_BANNER_ENABLED, true),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_DEFAULT_GRANTED, false),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.LEAD_STEP2_WEBHOOK_ENABLED, true),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.LEAD_STEP1_ABANDON_ENABLED, true),
    getTrackingSetting<number>(TRACKING_SETTING_KEYS.LEAD_STEP1_ABANDON_TIMEOUT_MINUTES, 5),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.LEAD_WEBHOOK_CONVERSATION_ENABLED, true),
    getTrackingSetting<number>(TRACKING_SETTING_KEYS.LEAD_WEBHOOK_CONVERSATION_MAX_MESSAGES, 50),
    getTrackingSetting<number>(TRACKING_SETTING_KEYS.LEAD_WEBHOOK_CONVERSATION_MAX_BYTES, 30_000),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.LEAD_INLINE_CONTACT_WEBHOOK_ENABLED, true),
  ]);
  return {
    consentBannerEnabled,
    consentDefaultGranted,
    leadStep2WebhookEnabled,
    leadStep1AbandonEnabled,
    leadStep1AbandonTimeoutMinutes,
    leadWebhookConversationEnabled,
    leadWebhookConversationMaxMessages,
    leadWebhookConversationMaxBytes,
    leadInlineContactWebhookEnabled,
  };
}

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const settings = await loadSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const patchSchema = z
  .object({
    consentBannerEnabled: z.boolean().optional(),
    consentDefaultGranted: z.boolean().optional(),
    leadStep2WebhookEnabled: z.boolean().optional(),
    leadStep1AbandonEnabled: z.boolean().optional(),
    leadStep1AbandonTimeoutMinutes: z.number().int().min(1).max(60).optional(),
    leadWebhookConversationEnabled: z.boolean().optional(),
    leadWebhookConversationMaxMessages: z.number().int().min(1).max(50).optional(),
    leadWebhookConversationMaxBytes: z.number().int().min(1000).max(50000).optional(),
    leadInlineContactWebhookEnabled: z.boolean().optional(),
  })
  .strict();

export async function PATCH(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }
    if (parsed.data.consentBannerEnabled !== undefined) {
      await setTrackingSetting<boolean>(
        TRACKING_SETTING_KEYS.CONSENT_BANNER_ENABLED,
        parsed.data.consentBannerEnabled,
        { actorId: session.adminId },
      );
    }
    if (parsed.data.consentDefaultGranted !== undefined) {
      await setTrackingSetting<boolean>(
        TRACKING_SETTING_KEYS.CONSENT_DEFAULT_GRANTED,
        parsed.data.consentDefaultGranted,
        { actorId: session.adminId },
      );
    }
    if (parsed.data.leadStep2WebhookEnabled !== undefined) {
      await setTrackingSetting<boolean>(
        TRACKING_SETTING_KEYS.LEAD_STEP2_WEBHOOK_ENABLED,
        parsed.data.leadStep2WebhookEnabled,
        { actorId: session.adminId },
      );
    }
    if (parsed.data.leadStep1AbandonEnabled !== undefined) {
      await setTrackingSetting<boolean>(
        TRACKING_SETTING_KEYS.LEAD_STEP1_ABANDON_ENABLED,
        parsed.data.leadStep1AbandonEnabled,
        { actorId: session.adminId },
      );
    }
    if (parsed.data.leadStep1AbandonTimeoutMinutes !== undefined) {
      await setTrackingSetting<number>(
        TRACKING_SETTING_KEYS.LEAD_STEP1_ABANDON_TIMEOUT_MINUTES,
        parsed.data.leadStep1AbandonTimeoutMinutes,
        { actorId: session.adminId },
      );
    }
    if (parsed.data.leadWebhookConversationEnabled !== undefined) {
      await setTrackingSetting<boolean>(
        TRACKING_SETTING_KEYS.LEAD_WEBHOOK_CONVERSATION_ENABLED,
        parsed.data.leadWebhookConversationEnabled,
        { actorId: session.adminId },
      );
    }
    if (parsed.data.leadWebhookConversationMaxMessages !== undefined) {
      await setTrackingSetting<number>(
        TRACKING_SETTING_KEYS.LEAD_WEBHOOK_CONVERSATION_MAX_MESSAGES,
        parsed.data.leadWebhookConversationMaxMessages,
        { actorId: session.adminId },
      );
    }
    if (parsed.data.leadWebhookConversationMaxBytes !== undefined) {
      await setTrackingSetting<number>(
        TRACKING_SETTING_KEYS.LEAD_WEBHOOK_CONVERSATION_MAX_BYTES,
        parsed.data.leadWebhookConversationMaxBytes,
        { actorId: session.adminId },
      );
    }
    if (parsed.data.leadInlineContactWebhookEnabled !== undefined) {
      await setTrackingSetting<boolean>(
        TRACKING_SETTING_KEYS.LEAD_INLINE_CONTACT_WEBHOOK_ENABLED,
        parsed.data.leadInlineContactWebhookEnabled,
        { actorId: session.adminId },
      );
    }
    await auditTrackingChange({
      action: 'update',
      resource: 'tracking_consent',
      resourceId: 'global',
      actorId: session.adminId,
      meta: parsed.data,
    });
    // Le `RootLayout` lit ces deux settings et les passe à `<TrackingProvider>`.
    // Toutes les pages (cachées par ISR) doivent être régénérées sinon les
    // visiteurs continuent de voir l'ancien état (bandeau visible / consent
    // denied) jusqu'au TTL `s-maxage=1800`. On invalide le layout entier
    // pour cascader sur l'ensemble des routes publiques.
    revalidatePath('/', 'layout');
    const settings = await loadSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
