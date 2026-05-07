# Logging & observabilité

## Format

Une ligne JSON par log, sortie sur stdout (Vercel collecte
automatiquement). Schéma minimal :

```json
{
  "ts": "2026-05-03T14:32:18.187Z",
  "level": "info",
  "event": "lead.created",
  "requestId": "01HXY3K9...",
  "userId": "ckxy...",
  "msg": "Lead created",
  "meta": { "leadId": "ckab...", "type": "contact" }
}
```

| Champ | Toujours présent | Description |
|---|---|---|
| `ts` | oui | ISO-8601 UTC |
| `level` | oui | `debug` / `info` / `warn` / `error` |
| `event` | oui | nom snake_case stable |
| `requestId` | si dispo | corrélation par requête |
| `userId` | si dispo | id admin si session |
| `msg` | non | message lisible (optionnel) |
| `meta` | non | objet libre (sans PII brute) |

## Niveaux

| Niveau | Usage |
|---|---|
| `debug` | dev local uniquement (filtré en prod) |
| `info` | événements métier normaux (login, lead.created, cron.tick) |
| `warn` | dégradations (delivery failed, rate-limit hit) |
| `error` | exceptions inattendues (capture Sentry également) |

## Logger

```ts
// apps/web/src/lib/logging/logger.ts
type LogPayload = {
  event: string;
  msg?: string;
  requestId?: string;
  userId?: string;
  meta?: Record<string, unknown>;
};

function emit(level: string, payload: LogPayload) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...redact(payload),
  });
  process.stdout.write(line + '\n');
}

export const logger = {
  debug: (p: LogPayload) => process.env.LOG_LEVEL === 'debug' && emit('debug', p),
  info: (p: LogPayload) => emit('info', p),
  warn: (p: LogPayload) => emit('warn', p),
  error: (p: LogPayload) => emit('error', p),
};
```

## Redaction PII

Les champs suivants sont **toujours** masqués automatiquement :

| Pattern | Masquage |
|---|---|
| `email` | `l***@example.ma` |
| `phone` | `+212 6 ** ** ** **` |
| `password` | `[REDACTED]` |
| `secret` | `[REDACTED]` |
| `signature` | tronqué à 8 char |
| `passwordHash` | `[REDACTED]` |

```ts
// apps/web/src/lib/logging/redact.ts
const REDACTED_KEYS = new Set(['password', 'passwordHash', 'secret', 'authorization']);

export function redact(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(redact);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        if (REDACTED_KEYS.has(k)) return [k, '[REDACTED]'];
        if (k === 'email' && typeof v === 'string') return [k, maskEmail(v)];
        if (k === 'phone' && typeof v === 'string') return [k, maskPhone(v)];
        return [k, redact(v)];
      }),
    );
  }
  return obj;
}
```

## Corrélation par requête

Chaque requête entrante reçoit un `X-Request-Id` (Vercel en injecte
un, sinon on en génère un). Il est propagé :
1. En tag Sentry.
2. Dans tous les logs émis pendant la requête (via AsyncLocalStorage).
3. Renvoyé en header de réponse (debug user-side).

```ts
// apps/web/src/lib/logging/correlation.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export const requestContext = new AsyncLocalStorage<{
  requestId: string;
  userId?: string;
}>();

export function withRequestContext<T>(ctx: { requestId: string; userId?: string }, fn: () => T) {
  return requestContext.run(ctx, fn);
}
```

## Événements canoniques

Catalogue des `event` valides (à maintenir avec discipline) :

| Catégorie | Événements |
|---|---|
| auth | `admin.login`, `admin.login.failed`, `admin.login.rate_limited`, `admin.logout`, `admin.session.expired` |
| leads | `lead.created`, `lead.status_changed`, `lead.note_added`, `lead.exported_csv` |
| webhooks | `webhook.endpoint.created`, `webhook.endpoint.updated`, `webhook.endpoint.deleted`, `webhook.endpoint.toggled`, `webhook.secret.rotated`, `webhook.test.invoked` |
| deliveries | `webhook.delivery.enqueued`, `webhook.delivery.attempted`, `webhook.delivery.delivered`, `webhook.delivery.failed`, `webhook.delivery.dead`, `webhook.delivery.retried` |
| cron | `cron.tick.started`, `cron.tick.completed`, `cron.tick.unauthorized` |
| api | `api.error`, `api.request` |
| rate-limit | `rate_limit.exceeded` |

## Sentry

Initialisé dans `instrumentation.ts` (Next.js 14 hook).

| Aspect | Valeur |
|---|---|
| DSN | `SENTRY_DSN` (env) |
| Environnement | `process.env.VERCEL_ENV` |
| Release | `process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)` |
| Sample rate (errors) | 1.0 |
| Sample rate (perf) | 0.1 (production), 1.0 (preview) |
| Replay | désactivé v1 (perf budget) |

## Vercel Analytics

| Métrique | Source |
|---|---|
| `web-vitals` | client (auto Vercel) |
| `api_request_duration_ms` | tag custom dans route handlers |
| `webhook_delivery_duration_ms` | tag custom dans dispatch |
| `cron_tick_processed` | tag custom |

## Dashboard d'observabilité

Pas de dashboard custom v1. On exploite directement :
- **Vercel Logs** pour l'investigation ad hoc.
- **Sentry Issues** pour les exceptions.
- **Vercel Analytics** pour les tendances.

Évolution v2 : Grafana Cloud Free + Loki si volume justifie.

## Tests

| Type | Fichier |
|---|---|
| Unit | `redact.test.ts`, `logger.test.ts` |
| Integration | vérifier que `app.log` ne contient jamais d'email en clair |
