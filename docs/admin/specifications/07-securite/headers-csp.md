# Headers HTTP & Content-Security-Policy

Tous les headers ci-dessous sont posés par le middleware Next.js sur
**toutes** les réponses du domaine. Cf. [`../05-backend/middleware.md`](../05-backend/middleware.md).

## Catalogue des headers

| Header | Valeur | Justification |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | force HTTPS (2 ans) |
| `X-Content-Type-Options` | `nosniff` | empêche MIME sniffing |
| `X-Frame-Options` | `DENY` | anti-clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | limite fuite d'URL |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | désactive APIs non utilisées + opt-out FLoC |
| `Content-Security-Policy` | (cf. ci-dessous) | défense XSS / injection |
| `Cache-Control` | `no-store, max-age=0` (admin) | pas de cache PII |

## CSP — admin

```
default-src 'self';
script-src 'self' 'nonce-{nonce}';
style-src 'self' 'nonce-{nonce}';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self';
form-action 'self';
frame-ancestors 'none';
base-uri 'self';
object-src 'none';
upgrade-insecure-requests;
report-uri /api/csp-report;
```

### Détails

| Directive | Choix | Pourquoi |
|---|---|---|
| `default-src 'self'` | strict | tout ce qui n'est pas explicitement autorisé est refusé |
| `script-src 'self' 'nonce-{nonce}'` | pas d'`unsafe-inline` | requiert que Next.js inline scripts utilisent un nonce |
| `style-src 'self' 'nonce-{nonce}'` | strict | pareil pour CSS |
| `img-src 'self' data: blob:` | élargi | besoin pour avatars data: (initiales SVG) et blob: pour previews |
| `font-src 'self' data:` | self uniquement | les fonts sont auto-hébergées (Cormorant, Inter, Pinyon Script) |
| `connect-src 'self'` | strict | aucun XHR sortant vers tiers depuis l'admin |
| `frame-ancestors 'none'` | strict | redondance avec X-Frame-Options |
| `base-uri 'self'` | strict | empêche la pollution de base URL |
| `object-src 'none'` | strict | pas de plugins |
| `upgrade-insecure-requests` | actif | force HTTPS sur toute sous-ressource |
| `report-uri /api/csp-report` | actif | collecte les violations |

### Nonce CSP

Implémentation Next.js 14 avec middleware :

```ts
// middleware.ts
const nonce = crypto.randomUUID().replace(/-/g, '');
const csp = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}';
  style-src 'self' 'nonce-${nonce}';
  …
`.replace(/\n\s*/g, ' ').trim();

const reqHeaders = new Headers(req.headers);
reqHeaders.set('x-csp-nonce', nonce);

const res = NextResponse.next({ request: { headers: reqHeaders } });
res.headers.set('Content-Security-Policy', csp);
```

Côté layout/components :

```tsx
import { headers } from 'next/headers';

export default async function RootLayout({ children }) {
  const nonce = headers().get('x-csp-nonce') ?? undefined;
  return (
    <html lang="fr">
      <body>
        <Script id="ga" nonce={nonce}>{/* … */}</Script>
        {children}
      </body>
    </html>
  );
}
```

## Endpoint de report

```ts
// apps/web/src/app/api/csp-report/route.ts
export async function POST(req: NextRequest) {
  const report = await req.json().catch(() => null);
  logger.warn({ event: 'csp.violation', meta: report });
  return new Response(null, { status: 204 });
}
```

Pas de rate-limit — Vercel WAF gère les abus. Volume attendu très faible.

## CSP — site public

Légèrement plus permissive si les pages publiques utilisent des
ressources tierces (GA, fonts CDN). À adapter dans une PR séparée
avec audit explicite. Hors scope admin.

## Tests

```ts
// e2e/security-headers.spec.ts
test('admin pages set strict security headers', async ({ page }) => {
  const res = await page.goto('/admin/login');
  const headers = res!.headers();
  expect(headers['strict-transport-security']).toContain('max-age=63072000');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['content-security-policy']).toContain("default-src 'self'");
});
```

## Mode rapport (transition)

Pour un déploiement initial sans casser le site, on peut activer en
parallèle `Content-Security-Policy-Report-Only` durant 1-2 semaines,
puis basculer en mode appliqué après vérification que `csp.violation`
ne remonte plus rien d'illégitime.
