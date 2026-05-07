# Monitoring & observabilité

## Stack

| Couche | Outil | Rôle |
|---|---|---|
| Erreurs applicatives | Sentry | exceptions runtime, stack traces sourcemap |
| Performance frontend | Vercel Analytics | Web Vitals (LCP, CLS, INP) |
| Logs structurés | Vercel Logs (1j) → drain Logtail (30j) | trail audit complet |
| Uptime externe | UptimeRobot | ping `/healthz` toutes les 5 min |
| Métier (cron, webhooks) | Tableau interne `/admin/dashboard` | KPI temps réel |
| Postgres | Neon dashboard | storage, compute, slow queries |

Pas de Datadog/Grafana en v1 (coût et complexité injustifiés vu le volume).

## Sentry

### Configuration

```ts
// apps/web/sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? 'development',
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0.1,        // 10 % des requêtes en trace
  profilesSampleRate: 0.0,      // pas de profiling v1
  beforeSend(event) {
    return scrubPii(event);     // strip emails/phones du payload
  },
});
```

`scrubPii` retire récursivement les champs `email`, `phone`, `password`,
`session.cookie`, `authorization` du payload Sentry. Lutte contre les
fuites accidentelles dans la console d'erreurs.

### Tags & contexte

À chaque requête, ajouter :

```ts
Sentry.setTag('route', request.url.pathname);
Sentry.setTag('admin_id', session?.adminId ?? 'anon');
Sentry.setContext('request', {
  method: request.method,
  ip_hash: hashIp(getClientIp(request)),
});
```

### Alertes Sentry

| Issue | Seuil | Canal |
|---|---|---|
| Nouvelle erreur P0 (5xx) | dès 1 occurrence prod | email + Slack `#alerts` |
| Erreur récurrente (>10/h) | seuil/heure | email |
| Régression (résolue puis revenue) | dès 1 occurrence | email |
| Spike global (>50 erreurs/min) | seuil/min | SMS fondatrice |

## Vercel Analytics

Activé par flag dans `next.config.js` :

```ts
module.exports = {
  experimental: { instrumentationHook: true },
};
```

| Métrique | Cible | Alerte |
|---|---|---|
| LCP p75 | < 2.5s | > 3s pendant 1h |
| CLS p75 | < 0.1 | > 0.15 |
| INP p75 | < 200ms | > 300ms |
| TTFB p75 | < 800ms | > 1.5s |

Les pages admin sont SSR, donc on optimise surtout TTFB côté serveur
(target Vercel fra1 < 200ms cold, < 50ms chaud).

## Logs structurés

### Format JSON

```json
{
  "ts": "2026-05-03T14:23:11.412Z",
  "level": "info",
  "event": "lead.status_changed",
  "request_id": "01HXX...",
  "admin_id": "u_abc",
  "lead_id": "l_xyz",
  "from": "new",
  "to": "qualified",
  "duration_ms": 42
}
```

Voir [`../05-backend/logging-observabilite.md`](../05-backend/logging-observabilite.md)
pour le détail (AsyncLocalStorage, redaction PII automatique).

### Drain Logtail

Configuration Vercel : Settings → Log Drains → Logtail HTTPS endpoint.
Rétention 30 jours. Permet recherche full-text et alerting via webhooks
Logtail.

### Recherches utiles

```
event:cron.tick.failed             # cron qui plante
event:webhook.delivery.permanent   # webhook abandonné
level:error                        # toutes erreurs serveur
admin_id:u_abc level:warn          # actions suspectes d'un admin
```

## Healthcheck

`/healthz` (public, sans auth, hors rate-limit) :

```ts
export async function GET() {
  const dbOk = await db.execute(sql`SELECT 1`).then(() => true).catch(() => false);
  return Response.json({
    ok: dbOk,
    time: new Date().toISOString(),
    sha: process.env.VERCEL_GIT_COMMIT_SHA,
  }, { status: dbOk ? 200 : 503 });
}
```

Pingé par UptimeRobot toutes les 5 minutes. Notification SMS si 2 checks
consécutifs en échec.

## Tableau de bord interne

`/admin/dashboard` agrège les KPI métier (rafraîchi à chaque chargement,
pas de polling) :

| KPI | Source | Période |
|---|---|---|
| Nouveaux leads | `leads` | 24h |
| Taux conversion | `leads.status='converted'` / total | 30j |
| Webhooks queue depth | `webhook_deliveries` pending | live |
| Webhook success rate | succeeded / (succeeded + permanent) | 24h |
| Cron last tick | `audit_events` action='system.cron_tick' | live |

## Alertes métier

Au-delà des erreurs Sentry, certaines situations méritent une alerte
fonctionnelle :

| Condition | Détection | Action |
|---|---|---|
| Cron pas tické > 5 min | absence d'audit `system.cron_tick` | email |
| Queue webhooks > 200 | requête SQL périodique | email |
| Webhook success rate < 90 % sur 1h | requête SQL | email |
| Login failures > 30/h | requête SQL `admin_login_attempts` | email + Slack |
| 5xx rate > 1 % sur 5 min | Sentry | SMS |

Les requêtes SQL périodiques tournent dans `/api/cron/tick` (chaque
minute, ajouter un step "alerts.evaluate").

## Synthèse mensuelle

Email automatisé le 1er du mois (cron `0 8 1 * *`) à la fondatrice :

- Nouveaux leads (volume, conversion)
- Disponibilité (uptime %)
- Erreurs (top 5 par fréquence)
- Webhooks (volume, succès, top consommateurs)
- Coûts (Vercel + Neon + Sentry)

Format : Markdown rendu en HTML, envoyé via SMTP transactional (à
définir au moment où on en aura besoin — pas v1).

## Tests

| Type | Vérification |
|---|---|
| Smoke | `/healthz` → 200 |
| Sentry | erreur volontaire dans staging → apparaît dans Sentry |
| Logs | grep d'un `event:cron.tick.completed` après 2 min uptime |
| Alerte | déclencher une fausse alerte preview → reçue dans Slack |
