import { NextResponse, type NextRequest } from 'next/server';
import { resolveVisitorGeo } from '@/lib/promo-slide-header/geo';
import {
  buildGeoPromoTags,
  resolveGeoPromoAdminConfig,
  resolveKitDiscountPctSafe,
} from '@/lib/promo-slide-header/config';
import { formatPromoDates, renderPromoTemplate } from '@/lib/promo-slide-header/template';
import type { GeoPromoLocationPayload } from '@/lib/promo-slide-header/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_HEADERS = {
  'cache-control': 'private, no-store',
  vary: 'CF-IPCity, CF-IPCountry, CF-Region',
};

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const config = await resolveGeoPromoAdminConfig();
    if (!config.enabled) {
      return NextResponse.json({ enabled: false }, { headers: RESPONSE_HEADERS });
    }

    const [discountPct, dates] = await Promise.all([
      resolveKitDiscountPctSafe(),
      Promise.resolve(formatPromoDates()),
    ]);
    const geo = resolveVisitorGeo(request);
    const country = geo.countryCode ?? 'MA';
    const message = renderPromoTemplate(
      config.messageTemplate,
      config.fallbackMessageTemplate,
      {
        date: dates.date,
        dateShort: dates.dateShort,
        city: geo.cityLabel,
        region: geo.regionLabel,
        country,
      },
    );

    const payload: GeoPromoLocationPayload = {
      enabled: true,
      dateLabel: dates.date,
      dateShort: dates.dateShort,
      cityLabel: geo.cityLabel,
      regionLabel: geo.regionLabel,
      countryCode: country,
      message,
      tags: buildGeoPromoTags(config, discountPct),
      discountPct,
      ctaLabel: config.ctaLabel,
      ctaHref: config.ctaHref,
      ariaLabel: config.ariaLabel,
      theme: config.theme,
      density: config.density,
      motion: config.motion,
      dismissible: config.dismissible,
      dismissMode: config.dismissMode,
      campaignKey: config.campaignKey,
    };

    return NextResponse.json(payload, { headers: RESPONSE_HEADERS });
  } catch {
    return NextResponse.json({ enabled: false }, { headers: RESPONSE_HEADERS });
  }
}
