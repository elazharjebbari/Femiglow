import { NextResponse, type NextRequest } from 'next/server';
import { decodeSession, SESSION_COOKIE } from '@/lib/auth/session';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE_NAME } from '@/i18n.config';
import { buildChatCspExtensions } from '@/lib/chat/csp';
import { buildTrackingCspExtensions } from '@/lib/tracking/providers/csp';
import { legacyRedirectIfNeeded } from '@/lib/tracking/plan/legacy-redirect';
import { isI18nEnabled } from '@/lib/i18n/feature-flag';
import { resolveLegacyLocaleRedirect } from '@/lib/i18n/legacy-locale-redirect';

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf statiques Next.js et favicon.
     * On applique CSP/HSTS partout, et l'auth uniquement sur /admin/*.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2?)$).*)',
  ],
};

const PUBLIC_ADMIN_PATHS = new Set<string>(['/admin/login']);

function buildCsp(
  nonce: string,
  isDev: boolean,
  opts?: { allowSelfFraming?: boolean },
): string {
  const trackingExtensions = buildTrackingCspExtensions();
  const chatExtensions = buildChatCspExtensions();
  const scriptHosts = trackingExtensions.scriptSrc.join(' ');
  const connectHosts = [...trackingExtensions.connectSrc, ...chatExtensions.connectSrc]
    .filter(Boolean)
    .join(' ');
  const frameHosts = trackingExtensions.frameSrc.filter(Boolean).join(' ');
  // Pourquoi `'unsafe-inline'` au lieu de `'nonce-X' 'strict-dynamic'` :
  // Next.js 14 n'injecte pas automatiquement le nonce sur ses propres balises
  // <script> (RSC payload, hydratation) malgré le `x-nonce` posé sur la
  // requête. Avec `'strict-dynamic'`, le navigateur bloquait alors *tous* les
  // scripts (y compris l'hydratation React → boutons inertes, menu Sommaire
  // bloqué). On retombe donc sur `'self' 'unsafe-inline' [hosts]` : sécurité
  // standard pour un site dont les inputs sont déjà sanitizés côté serveur.
  // `nonce` reste exposé via `x-nonce` pour les composants qui veulent
  // l'utiliser explicitement (ex. <Script nonce={…}/>).
  void nonce;
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval' ${scriptHosts}`.trim()
    : `'self' 'unsafe-inline' ${scriptHosts}`.trim();
  // style-src-elem explicite : sans cela, certains navigateurs (Firefox)
  // appliquent style-src en fallback strict et bloquent les feuilles
  // tierces (GTM Tag Assistant, debug overlays, Google Fonts injectées
  // par scripts tiers). On autorise les hôtes Google standards + self.
  const styleSrcElem =
    "'self' 'unsafe-inline' https://fonts.googleapis.com https://tagassistant.google.com";
  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `style-src-elem ${styleSrcElem}`,
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' https://*.sentry.io https://plausible.io ${connectHosts}`.trim(),
    // CHA-243 — Framing sortant : autoriser l'embed YouTube privacy-friendly
    // sur `/kit`. Sans `frame-src` explicite, le navigateur retombe sur
    // `default-src 'self'` et bloque l'iframe `youtube-nocookie.com`.
    // On limite strictement au sous-domaine `nocookie` (pas de
    // `youtube.com` direct qui poserait des cookies).
    // `listmonk.femiglow-maroc.com` est le sous-domaine dédié Listmonk
    // (vhost LiteSpeed → 127.0.0.1:9000). On l'autorise comme frame-src
    // pour /admin/emails/listmonk. Si LISTMONK_PUBLIC_URL n'est pas
    // configuré, l'iframe retombe sur same-origin via le proxy
    // /api/listmonk/* (couvert par `'self'`).
    // Frames tierces des balises (conversion/remarketing Google Ads via
    // doubleclick, GTM, Meta) — sinon GTM « Qualité du conteneur » signale
    // un CSP bloquant la mesure. Cf. lib/tracking/providers/csp-hosts.ts.
    `frame-src 'self' https://www.youtube-nocookie.com https://listmonk.femiglow-maroc.com ${frameHosts}`.trim(),
    // Live preview admin : on tolère le framing same-origin pour la
    // page `/admin/components/[key]/preview` (servie en iframe). Partout
    // ailleurs on garde 'none' (durci par défaut).
    opts?.allowSelfFraming ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ];
  // En dev (HTTP localhost), `upgrade-insecure-requests` casse toutes les
  // sous-ressources (assets, _next/*, /api/*) car le navigateur tente du HTTPS.
  if (!isDev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

function generateNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/api/admin');

  // TP2 — Redirige les pages tracking legacy vers la nouvelle UI unifiée
  // dès lors que `TRACKING_LEGACY_REDIRECT=on`. Géré avant l'auth pour
  // que le 302 prenne effet même sans session (les pages cibles forceront
  // ensuite la login si besoin).
  const legacy = legacyRedirectIfNeeded(request);
  if (legacy) return legacy;

  // L8 — Quand l'i18n est activée, l'entrée par défaut bascule sur l'arbre
  // localisé : `/` → `/fr`, `/kit` → `/fr/kit`… (cookie NEXT_LOCALE respecté).
  // Seules les racines disposant d'un miroir `[locale]/` sont redirigées ;
  // les routes legacy sans équivalent restent servies telles quelles.
  // La query (UTM inclus) est préservée par le clone de `nextUrl` (INV-4).
  if (isI18nEnabled()) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
    const target = resolveLegacyLocaleRedirect(pathname, cookieLocale);
    if (target) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      return NextResponse.redirect(url);
    }
  }

  if (isAdmin && !PUBLIC_ADMIN_PATHS.has(pathname)) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    let session = null;
    try {
      session = await decodeSession(token);
    } catch {
      session = null;
    }
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('next', pathname);
      // Derrière un reverse-proxy (LiteSpeed → 127.0.0.1:8011), `request.nextUrl`
      // reflète l'host de bind interne. On respecte le host/proto public via
      // les en-têtes X-Forwarded-* envoyés par le proxy.
      const forwardedHost = request.headers.get('x-forwarded-host');
      const forwardedProto = request.headers.get('x-forwarded-proto');
      if (forwardedHost) {
        url.host = forwardedHost;
        if (!forwardedHost.includes(':')) url.port = '';
      }
      if (forwardedProto) url.protocol = `${forwardedProto}:`;
      return NextResponse.redirect(url);
    }
  }

  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== 'production';
  // Les routes admin de live-preview sont chargées en iframe par
  // `/admin/components/[key]` → frame-ancestors 'self' + X-Frame-Options
  // SAMEORIGIN. Partout ailleurs on garde le durcissement complet.
  const isAdminPreview =
    pathname.startsWith('/admin/components/') && pathname.endsWith('/preview');
  const csp = buildCsp(nonce, isDev, { allowSelfFraming: isAdminPreview });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  // i18n SSR — expose la locale active (1er segment d'URL) au root layout
  // pour qu'il rende `<html lang/dir>` côté serveur. Source unique partagée
  // serveur+client ⇒ zéro mismatch d'hydratation, zéro flash LTR avant paint.
  // Routes legacy sans préfixe ⇒ DEFAULT_LOCALE (cohérent avec l'ancien "fr").
  const firstSegment = pathname.split('/')[1];
  requestHeaders.set(
    'x-locale',
    isLocale(firstSegment) ? firstSegment : DEFAULT_LOCALE,
  );

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('content-security-policy', csp);
  // HSTS uniquement en prod : sur localhost HTTP en dev, le pin HSTS empêche
  // ensuite tout accès non-TLS pendant la durée du max-age (2 ans).
  if (!isDev) {
    res.headers.set(
      'strict-transport-security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }
  res.headers.set('x-content-type-options', 'nosniff');
  res.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  res.headers.set('x-frame-options', isAdminPreview ? 'SAMEORIGIN' : 'DENY');
  if (isAdmin || isAdminApi) {
    res.headers.set('x-robots-tag', 'noindex, nofollow');
    res.headers.set('cache-control', 'no-store, max-age=0');
  }
  // T14+ — Capture exhaustive des signaux d'acquisition (refonte attribution
  // 2026-05). En first-touch (on n'écrase pas un cookie antérieur). Durée 90 j.
  //
  // Surfaces captées :
  //   1. Click IDs (8) : gclid/gbraid/wbraid (Google), fbclid (Meta),
  //      ttclid (TikTok), msclkid (Bing), sccid (Snap), epik (Pinterest)
  //   2. UTM standard (5) : utm_source, utm_medium, utm_campaign,
  //      utm_content, utm_term — captés dans _fg_landing_qs en JSON
  //   3. Cookie de reconstruction `_fbc` Meta : si fbclid présent et `_fbc`
  //      absent, on reconstruit `fb.1.<ts>.<fbclid>` (format Meta officiel
  //      pour matching CAPI Phase 2 — débloquera 80%+ du gap Meta).
  //
  // Référence : `docs/attribution-fix-2026-05/02-vision-architecture.md`.
  if (!isAdmin && !isAdminApi) {
    const sp = request.nextUrl.searchParams;
    const COOKIE_OPTS = {
      maxAge: 60 * 60 * 24 * 90, // 90 jours
      httpOnly: false, // lisible côté client pour debug + bridges
      sameSite: 'lax' as const,
      secure: !isDev,
      path: '/',
    };

    // 1. Click IDs — un cookie par plateforme (granularité utile au debug)
    const CLICK_ID_PARAMS: ReadonlyArray<[string, string]> = [
      ['gclid', '_fg_gclid'],
      ['gbraid', '_fg_gbraid'],
      ['wbraid', '_fg_wbraid'],
      ['fbclid', '_fg_fbclid'],
      ['ttclid', '_fg_ttclid'],
      ['msclkid', '_fg_msclkid'],
      ['sccid', '_fg_sccid'],
      ['epik', '_fg_epik'],
    ];
    for (const [param, cookieName] of CLICK_ID_PARAMS) {
      const value = sp.get(param);
      if (!value) continue;
      if (request.cookies.has(cookieName)) continue;
      res.cookies.set(cookieName, value, COOKIE_OPTS);
    }

    // 2. UTM snapshot — payload JSON unique en _fg_landing_qs (économise
    //    5 cookies). First-touch only.
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
    const utm: Record<string, string> = {};
    for (const k of utmKeys) {
      const v = sp.get(k);
      if (v) utm[k] = v;
    }
    if (Object.keys(utm).length > 0 && !request.cookies.has('_fg_landing_qs')) {
      const payload = JSON.stringify({
        utm,
        path: request.nextUrl.pathname,
        ts: Date.now(),
      });
      res.cookies.set('_fg_landing_qs', payload, COOKIE_OPTS);
    }

    // 3. Reconstruction `_fbc` Meta depuis fbclid — débloque le matching CAPI.
    //    Format officiel Meta : `fb.1.<unix_ts_ms>.<fbclid>`
    //    Source : https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc
    const fbclid = sp.get('fbclid');
    if (fbclid && !request.cookies.has('_fbc')) {
      const fbc = `fb.1.${Date.now()}.${fbclid}`;
      res.cookies.set('_fbc', fbc, COOKIE_OPTS);
    }
  }
  return res;
}
