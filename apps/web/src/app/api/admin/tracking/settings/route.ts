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
}

async function loadSettings(): Promise<SettingsView> {
  const [consentBannerEnabled, consentDefaultGranted] = await Promise.all([
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_BANNER_ENABLED, true),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_DEFAULT_GRANTED, false),
  ]);
  return { consentBannerEnabled, consentDefaultGranted };
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
    await auditTrackingChange({
      action: 'update',
      resource: 'tracking_consent',
      resourceId: 'global',
      actorId: session.adminId,
      meta: parsed.data,
    });
    const settings = await loadSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
