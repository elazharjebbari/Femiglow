import { NextResponse, type NextRequest } from 'next/server';
import { decodeSession, SESSION_COOKIE } from '@/lib/auth/session';
import { buildChatCspExtensions } from '@/lib/chat/csp';
import { buildTrackingCspExtensions } from '@/lib/tracking/providers/csp';

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
    "frame-src 'self' https://www.youtube-nocookie.com",
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
  // T14 — Capture des Google Click IDs (gclid/gbraid/wbraid) en cookie persistant
  // pour Enhanced Conversions et attribution multi-pages. La capture est en
  // first-touch : on n'écrase pas un click ID antérieur déjà en cookie. Durée
  // 90 j (fenêtre d'attribution Google Ads par défaut).
  if (!isAdmin && !isAdminApi) {
    const sp = request.nextUrl.searchParams;
    const CLICK_ID_PARAMS: ReadonlyArray<['gclid' | 'gbraid' | 'wbraid', string]> = [
      ['gclid', '_fg_gclid'],
      ['gbraid', '_fg_gbraid'],
      ['wbraid', '_fg_wbraid'],
    ];
    for (const [param, cookieName] of CLICK_ID_PARAMS) {
      const value = sp.get(param);
      if (!value) continue;
      if (request.cookies.has(cookieName)) continue;
      res.cookies.set(cookieName, value, {
        maxAge: 60 * 60 * 24 * 90,
        httpOnly: false,
        sameSite: 'lax',
        secure: !isDev,
        path: '/',
      });
    }
  }
  return res;
}
