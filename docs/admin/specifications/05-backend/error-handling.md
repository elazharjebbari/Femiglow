# Gestion d'erreurs

## Format unifié

Toute erreur retournée par l'API admin respecte ce contrat :

```ts
{
  error: 'unauthorized' | 'forbidden' | 'not_found' | 'validation_failed' |
         'rate_limited' | 'conflict' | 'endpoint_unreachable' |
         'persistence_unavailable' | 'internal_error',
  issues?: Array<{ path: string[], message: string }>
}
```

Les codes sont **stables** : front-end et tests peuvent matcher
explicitement. Pas de message libre côté API : la traduction
française est faite dans le front (i18n inline).

## Mapping HTTP

| Code interne | HTTP | Sens métier |
|---|---|---|
| `unauthorized` | 401 | Pas de session valide ou identifiants incorrects |
| `forbidden` | 403 | Session valide mais action refusée |
| `not_found` | 404 | Ressource inexistante (incl. soft-deleted) |
| `validation_failed` | 400 | Corps ou query invalide (avec `issues`) |
| `rate_limited` | 429 | Quota dépassé (avec header `Retry-After`) |
| `conflict` | 409 | Doublon, état incompatible, transition interdite |
| `endpoint_unreachable` | 502 | Webhook test : URL injoignable |
| `persistence_unavailable` | 503 | DB down (rare, déclenche pager) |
| `internal_error` | 500 | Erreur inconnue, body neutre, capture Sentry |

## Helper

```ts
// apps/web/src/lib/errors/format.ts
export class HttpError extends Error {
  constructor(
    public code: keyof typeof HTTP_MAP,
    public httpStatus: number,
    public issues?: Array<{ path: string[]; message: string }>,
  ) {
    super(code);
  }
}

export function formatErrorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json(
      { error: err.code, ...(err.issues && { issues: err.issues }) },
      { status: err.httpStatus, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (err instanceof ZodError) {
    return Response.json(
      {
        error: 'validation_failed',
        issues: err.issues.map((i) => ({ path: i.path.map(String), message: i.message })),
      },
      { status: 400 },
    );
  }

  // Erreur inattendue
  Sentry.captureException(err);
  logger.error({ event: 'route.unhandled_error', err });
  return Response.json({ error: 'internal_error' }, { status: 500 });
}
```

## Wrapper de route

Pour éviter le try/catch boilerplate :

```ts
// apps/web/src/lib/errors/handler.ts
export function withErrorHandler<T extends (req: NextRequest, ctx: any) => Promise<Response>>(
  handler: T,
): T {
  return (async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return formatErrorResponse(err);
    }
  }) as T;
}

// Usage
export const POST = withErrorHandler(async (req) => {
  await requireAdmin();
  const body = adminLoginSchema.parse(await req.json()); // throws ZodError
  …
});
```

## Sentry

Initialisé dans `instrumentation.ts` (Node + Edge).
Filtres :
- Capture **toutes** les erreurs `internal_error` (500).
- Capture **uniquement** `persistence_unavailable` parmi les non-500.
- **Ignore** : `validation_failed`, `unauthorized`, `not_found`,
  `rate_limited`, `conflict` (utilisateur — pas une bug).

```ts
beforeSend(event, hint) {
  const code = hint?.originalException?.code;
  if (code && SILENT_CODES.has(code)) return null;
  return event;
}
```

## Pas de stacktrace en prod

```ts
const isDev = process.env.NODE_ENV === 'development';
return Response.json(
  {
    error: 'internal_error',
    ...(isDev && { stack: err instanceof Error ? err.stack : undefined }),
  },
  { status: 500 },
);
```

## Logging

Chaque erreur passe par le logger structuré (cf. [`logging-observabilite.md`](./logging-observabilite.md)) :

```ts
logger.error({
  event: 'api.error',
  code: err.code,
  httpStatus: err.httpStatus,
  path: req.nextUrl.pathname,
  requestId: req.headers.get('x-request-id'),
  userId: session.user?.id,
});
```

## Tests

| Type | Fichier |
|---|---|
| Unit | `format.test.ts`, `handler.test.ts` |
| MSW | les scénarios couvrent chaque code (cf. matrice de couverture) |
