import { NextResponse } from 'next/server';
import {
  getTrackingSetting,
  TRACKING_SETTING_KEYS,
} from '@/lib/db/queries/tracking/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Endpoint public (no auth) consommé par le `<ConsentBanner />` au premier
 * rendu pour savoir s'il doit s'afficher (certains pays comme MA / US où
 * le bandeau n'est pas obligatoire). Retourne un payload minimal pour ne
 * fuiter aucune info sensible.
 */
export async function GET(): Promise<Response> {
  const [bannerEnabled, defaultGranted] = await Promise.all([
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_BANNER_ENABLED, true),
    getTrackingSetting<boolean>(TRACKING_SETTING_KEYS.CONSENT_DEFAULT_GRANTED, false),
  ]);
  return NextResponse.json(
    {
      bannerEnabled,
      defaultGranted,
    },
    {
      headers: {
        // Cache court côté CDN/edge pour éviter de tabasser la DB,
        // mais court car le réglage peut changer en admin.
        'cache-control': 'public, max-age=30, s-maxage=60',
      },
    },
  );
}
