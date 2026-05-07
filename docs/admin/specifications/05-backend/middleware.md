# Middleware Next.js

`apps/web/src/middleware.ts` exécute deux missions :

1. **Auth gate** sur toutes les routes `/admin/*` (page) et `/api/admin/*`.
2. **Headers de sécurité** sur l'ensemble du domaine.

## Matcher

```ts
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

## Auth gate

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type AdminSession } from '@/lib/auth/session';

const PUBLIC_ADMIN_ROUTES = new Set(['/admin/login']);

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const isAdminPage = url.pathname.startsWith('/admin');
  const isAdminApi = url.pathname.startsWith('/api/admin');
  const isLoginEndpoint = url.pathname === '/api/admin/login';
  const isPublicAdminPage = PUBLIC_ADMIN_ROUTES.has(url.pathname);

  if (!isAdminPage && !isAdminApi) {
    return applySecurityHeaders(NextResponse.next());
  }

  const res = NextResponse.next();
  const session = await getIronSession<AdminSession>(req, res, sessionOptions);

  if (isAdminApi && !isLoginEndpoint && !session.user) {
    return jsonError('unauthorized', 401);
  }

  if (isAdminPage && !isPublicAdminPage && !session.user) {
    const next = encodeURIComponent(url.pathname + url.search);
    return NextResponse.redirect(new URL(`/admin/login?next=${next}`, req.url));
  }

  if (url.pathname === '/admin/login' && session.user) {
    return NextResponse.redirect(new URL('/admin/dashboard', req.url));
  }

  return applySecurityHeaders(res);
}
```

## Headers de sécurité

| Header | Valeur |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |
| `Content-Security-Policy` | cf. [`../07-securite/headers-csp.md`](../07-securite/headers-csp.md) |

```ts
function applySecurityHeaders(res: NextResponse) {
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.headers.set('Content-Security-Policy', getCsp());
  return res;
}
```

## Détection d'IP cliente

Pour rate-limiting, on extrait l'IP en respectant les en-têtes Vercel :

```ts
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
```

L'IP est passée via header `X-FemiGlow-Client-Ip` aux routes en aval (uniquement
en interne — ce header est strippé en sortie). Cf. [`rate-limiting.md`](./rate-limiting.md).

## Pas de logique métier

Le middleware reste **mince**. Toute logique d'autorisation fine
(par exemple : "cette session peut-elle modifier ce webhook ?") vit
dans les route handlers, pas ici.

## Pas de mutation DB

Le middleware tourne sur **Edge runtime par défaut**. On ne peut pas
y appeler Drizzle. Toute interaction DB nécessaire à l'auth (lookup user)
est déjà absorbée par iron-session (cookie chiffré stateless).

## Tests

| Type | Fichier |
|---|---|
| Unit | `middleware.test.ts` (table de cas : connecté/non, public/privé, page/api) |
| E2E | `e2e/middleware-redirect.spec.ts` |
