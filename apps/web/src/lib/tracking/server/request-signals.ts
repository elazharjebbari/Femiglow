/**
 * Extraction des signaux d'attribution depuis une requête HTTP server-side.
 *
 * Source : cookies set par le `middleware.ts` au premier hit du visiteur
 *  (UTM dans `_fg_landing_qs`, click IDs dans `_fg_<plateforme>`, `_fbc`/`_fbp`).
 *
 * Pure function — testable sans mock NextRequest complexe.
 *
 * Référence : `docs/attribution-fix-2026-05/02-vision-architecture.md`.
 */
import 'server-only';

/**
 * Interface compacte abstraite des cookies (compatible avec Next.js
 * `RequestCookies` et `ReadonlyRequestCookies` et un objet de test).
 */
export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export interface RequestSignals {
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  clickIds: {
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    fbclid?: string;
    ttclid?: string;
    msclkid?: string;
    sccid?: string;
    epik?: string;
  };
  /** `_fbp` Meta browser ID (set par Meta Pixel). */
  fbp: string | null;
  /** `_fbc` Meta click ID enrichi (set par middleware ou Meta Pixel). */
  fbc: string | null;
  /** Referrer HTTP (depuis header `referer`). */
  referrer: string | null;
  /** Path du landing first-touch (depuis `_fg_landing_qs`). */
  landingPath: string | null;
  /** Timestamp first-touch (depuis `_fg_landing_qs`). */
  landingTs: number | null;
}

const EMPTY_SIGNALS: RequestSignals = {
  utm: {},
  clickIds: {},
  fbp: null,
  fbc: null,
  referrer: null,
  landingPath: null,
  landingTs: null,
};

interface LandingPayload {
  utm?: Record<string, string>;
  path?: string;
  ts?: number;
}

function safeJsonParse<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Extrait tous les signaux d'attribution disponibles dans la requête.
 *
 * Comportement défensif : aucune lecture cookies ne throw, valeurs absentes
 * → undefined/null. La function est safe à appeler sur des requêtes
 * minimalistes (tests, edge cases).
 */
export function extractRequestSignals(input: {
  cookies: CookieReader;
  referrer?: string | null;
}): RequestSignals {
  if (!input?.cookies) return { ...EMPTY_SIGNALS, referrer: input?.referrer ?? null };

  const get = (name: string): string | undefined =>
    input.cookies.get(name)?.value;

  // Click IDs — un cookie par plateforme (cf. middleware.ts)
  const clickIds: RequestSignals['clickIds'] = {};
  const clickIdMap: Array<[keyof RequestSignals['clickIds'], string]> = [
    ['gclid', '_fg_gclid'],
    ['gbraid', '_fg_gbraid'],
    ['wbraid', '_fg_wbraid'],
    ['fbclid', '_fg_fbclid'],
    ['ttclid', '_fg_ttclid'],
    ['msclkid', '_fg_msclkid'],
    ['sccid', '_fg_sccid'],
    ['epik', '_fg_epik'],
  ];
  for (const [key, cookieName] of clickIdMap) {
    const v = get(cookieName);
    if (v) clickIds[key] = v;
  }

  // UTM — payload JSON unique en `_fg_landing_qs`
  const landingRaw = get('_fg_landing_qs');
  const landing = safeJsonParse<LandingPayload>(landingRaw);
  const utm: RequestSignals['utm'] = {};
  if (landing?.utm) {
    if (landing.utm.utm_source) utm.source = landing.utm.utm_source;
    if (landing.utm.utm_medium) utm.medium = landing.utm.utm_medium;
    if (landing.utm.utm_campaign) utm.campaign = landing.utm.utm_campaign;
    if (landing.utm.utm_content) utm.content = landing.utm.utm_content;
    if (landing.utm.utm_term) utm.term = landing.utm.utm_term;
  }

  return {
    utm,
    clickIds,
    fbp: get('_fbp') ?? null,
    fbc: get('_fbc') ?? null,
    referrer: input.referrer ?? null,
    landingPath: landing?.path ?? null,
    landingTs: landing?.ts ?? null,
  };
}

/**
 * True si au moins UN signal d'attribution est présent. Utile pour
 * decider si on tombe sur `direct` ou si on persiste une row enrichie.
 */
export function hasAnySignal(signals: RequestSignals): boolean {
  if (signals.referrer) return true;
  if (Object.keys(signals.utm).length > 0) return true;
  if (Object.keys(signals.clickIds).length > 0) return true;
  if (signals.fbp || signals.fbc) return true;
  return false;
}
