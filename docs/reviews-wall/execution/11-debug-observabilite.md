# 11 — Debug et observabilité

Outils, conventions et procédures pour diagnostiquer rapidement les anomalies en dev, en preview et en production. Vise à rendre le composant **diagnosticable en < 5 min** lorsqu'une initiée signale un problème.

## 1. Niveaux d'observation

```
┌──────────────────────────────────────────────────┐
│  Production                                       │
│  ─ Vercel logs (1 jour live, 7 j archive)         │
│  ─ Sentry traces + erreurs                        │
│  ─ Vercel Analytics (Web Vitals RUM)              │
│  ─ Dashboard insights admin                       │
│  ─ Webhooks Slack (incidents)                     │
├──────────────────────────────────────────────────┤
│  Preview                                          │
│  ─ Mêmes outils que prod, marqués env=preview     │
├──────────────────────────────────────────────────┤
│  Dev                                              │
│  ─ Logs console structurés                         │
│  ─ DevTools réseau                                 │
│  ─ React Query Devtools                            │
│  ─ Drizzle Studio (DB inspection)                  │
└──────────────────────────────────────────────────┘
```

## 2. Logging structuré

### 2.1 Lib

`lib/logging/` Pino existant. Structure standard :

```ts
import { logger } from '@/lib/logging';

logger.info('ritual_submitted', {
  testimonial_id: 'ce6f...',
  source: 'email_j45',
  auto_flags: ['emoji_detected'],
  photo_count: 1,
  body_length: 142,
  ip_hashed: hash(ip),
  has_email_token: true,
});
```

### 2.2 Conventions

- **Pas de PII** : pas d'email, pas de nom complet, pas d'IP en clair (hash si nécessaire).
- **Niveaux** :
  - `debug` : exécution détaillée (uniquement en dev).
  - `info` : événement métier réussi.
  - `warn` : signal anormal mais non bloquant (auto-flag critique, latence > seuil).
  - `error` : exception 5xx, échec de job, échec d'envoi e-mail.
- **Champs canoniques** : toujours `event_name` (snake_case), `testimonial_id`, `actor_id` (si admin), `correlation_id`.
- **JSON sortie** : Pino default `json` en prod, `pretty` en dev.

### 2.3 Catalogue des events de logs

| Événement log | Niveau | Champs |
| --- | --- | --- |
| `ritual_submitted` | info | testimonial_id, source, auto_flags, photo_count, body_length, has_email_token |
| `ritual_approved` | info | testimonial_id, actor_id, time_in_queue_hours |
| `ritual_rejected` | info | testimonial_id, actor_id, reason_template, internal_note (truncated) |
| `ritual_face_detected` | warn | testimonial_id, photo_id, faces_count, status |
| `ritual_auto_flag` | warn | testimonial_id, flag, body_length |
| `ritual_vision_ml_timeout` | warn | photo_id, timeout_ms |
| `ritual_vision_ml_error` | error | photo_id, error_class, error_message |
| `ritual_email_sent` | info | testimonial_id, template, recipient_hash |
| `ritual_email_failed` | error | testimonial_id, template, error_class |
| `ritual_aggregate_refreshed` | info | duration_ms, refreshed_at |
| `ritual_email_j45_cron` | info | orders_count, sent_count, failed_count, duration_ms |
| `ritual_rate_limited` | warn | bucket_key, ip_hashed |
| `ritual_invalid_email_token` | warn | token_prefix (4 first chars), reason |
| `ritual_admin_action` | info | testimonial_id, actor_id, action, has_note |
| `ritual_admin_unauthorized` | warn | actor_id, action, role |

## 3. Sentry — erreurs et traces

### 3.1 Setup existant

Sentry est déjà câblé dans le projet (`apps/web/instrumentation.ts`). Vérifier que `dsn` est configuré pour preview et prod.

### 3.2 Tags rituals

À tout `Sentry.captureException` lié au composant, ajouter :

```ts
Sentry.withScope((scope) => {
  scope.setTag('feature', 'rituals');
  scope.setTag('subfeature', 'wizard'); // ou 'admin', 'drawer', 'vision-ml', 'email', 'aggregate'
  scope.setContext('testimonial', { id: testimonialId, status, autoFlags });
  Sentry.captureException(error);
});
```

### 3.3 Traces de performance

Trace les routes API critiques :

```ts
const transaction = Sentry.startTransaction({ name: 'POST /api/rituals/submit' });
try {
  // ...
} finally {
  transaction.finish();
}
```

Cible : p95 < 800 ms pour `submit`, < 200 ms pour `list`.

### 3.4 Alertes Sentry

| Alerte | Seuil | Notification |
| --- | --- | --- |
| `ritual_submit_error` rate | > 5 % en 5 min | Slack #incidents |
| Vision ML timeout | > 20 % en 1 h | Slack #incidents |
| Email J+45 failure rate | > 10 % en 24 h | Slack #incidents |
| Sentry erreur nouvelle (no fingerprint match) | 1 occurrence | Slack #incidents |

## 4. Webhooks Slack pour incidents

### 4.1 Configuration

Webhook URL stocké dans `app_config.webhook_incidents_url`. Lib `lib/webhooks/` envoie un message HMAC-signé.

### 4.2 Payload type

```json
{
  "type": "ritual_incident",
  "severity": "warn",
  "event": "ritual_face_detected",
  "context": {
    "testimonial_id": "ce6f...",
    "photo_id": "abc...",
    "faces_count": 1
  },
  "links": {
    "admin": "https://femiglow-maroc.com/admin/rituals/ce6f..."
  },
  "timestamp": "2026-05-11T16:00:00Z"
}
```

## 5. Dashboard insights admin

Onglet `/admin/rituals/insights` (cf. `↗ 06-admin-plan-action.md § 6`) sert aussi de tableau de bord opérationnel :

- **SLA dépassé** : alerte visible si > 0 témoignages en queue > 48 h.
- **Taux d'erreur submit** : visible en bas de page (sourcé `tracking_events_log`).
- **Latence médiane vision ML** : graphique 7 jours.

## 6. React Query DevTools

En dev :

```tsx
'use client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function Devtools() {
  if (process.env.NODE_ENV !== 'development') return null;
  return <ReactQueryDevtools initialIsOpen={false} />;
}
```

Permet d'inspecter les queries actives, leur cache, leur état (`fetching`, `stale`, `error`).

## 7. Drizzle Studio

```bash
pnpm --filter @femiglow/web db:studio
```

Ouvre une UI web pour inspecter les tables `ritual_testimonials`, `ritual_testimonial_photos`, `ritual_audit_log`, `ritual_aggregate`. Pratique pour les vérifications manuelles.

## 8. Console structurée côté client

### 8.1 Hook `useTrackRitual`

Le hook qui émet vers le dataLayer ET vers les logs server-side :

```ts
export function useTrackRitual() {
  return (event: string, payload?: Record<string, any>) => {
    // dataLayer
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer ?? [];
      window.dataLayer.push({ event, ritual: payload });
    }
    // Server log (fire and forget)
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload }),
      keepalive: true,
    });
  };
}
```

### 8.2 Console.log conventions (dev only)

En dev :

```ts
if (process.env.NODE_ENV === 'development') {
  console.log('[ritual]', event, payload);
}
```

Préfixe `[ritual]` permet de filtrer dans la console.

## 9. Procédures de diagnostic

### 9.1 « Une initiée a soumis un rituel mais ne le voit pas publié »

1. Récupérer `customer_hash` ou `order_id`.
2. Drizzle Studio → `ritual_testimonials WHERE customer_hash = ...`.
3. Vérifier `status` :
   - `PENDING` → en queue, encore dans le SLA → attendre ou prioriser.
   - `REJECTED` → vérifier `moderation_note` et e-mail envoyé.
   - `HIDDEN` → vérifier raison du masquage.
4. `audit_log` pour comprendre la séquence.

### 9.2 « Le module compact n'apparaît pas sur /kit »

1. DevTools network → vérifier `/api/rituals/summary` et `/api/rituals/list?featured=1`.
2. Si réponse vide → vérifier `featured = true` count en BDD.
3. Si réponse 500 → Sentry.
4. Si module rendu mais 0 cards → fallback non activé, vérifier logique `RitualsModuleBound`.

### 9.3 « L'upload photo échoue »

1. DevTools network → vérifier `/api/rituals/upload-photo` payload + statut.
2. Si 413 → photo > 5 Mo, vérifier compression côté client.
3. Si 500 → Sentry, probablement Sharp ou Vercel Blob.
4. Si timeout → vision ML bloque, vérifier `MEDIAPIPE_MODEL_PATH` env var.

### 9.4 « La modératrice ne voit pas les visages détectés »

1. Vérifier `faces_status` sur `ritual_testimonial_photos`.
2. Si `PENDING_CHECK` depuis > 1 h → CRON `rituals-faces-recheck-stale` ne tourne pas.
3. Forcer recheck via `POST /api/admin/rituals/[id]/photos/[photoId]/recheck`.

### 9.5 « Le compteur insights est faux »

1. `REFRESH MATERIALIZED VIEW CONCURRENTLY ritual_aggregate;` manuel.
2. Vérifier dernière exécution CRON `rituals-refresh-aggregate` dans Vercel logs.
3. Si CRON OK mais désynchro → vérifier triggers ou contrainte de filtre.

## 10. Health check endpoint

Créer `apps/web/src/app/api/health/rituals/route.ts` :

```ts
export async function GET() {
  try {
    const summary = await getRitualSummary('pack-femiglow');
    const lastAggregateRefresh = await getLastAggregateRefresh();
    const visionMLReady = await checkVisionMLHealth();
    return NextResponse.json({
      status: 'ok',
      summary: { totalCount: summary.totalCount, lastPublished: summary.lastPublishedAt },
      aggregateLastRefreshed: lastAggregateRefresh,
      visionMLReady,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ status: 'degraded', error: e.message }, { status: 503 });
  }
}
```

Appelable depuis :

- Uptime Robot ou Pingdom toutes les 5 min.
- Slack `/health rituals` slash command (si configuré).

## 11. Profiling performance

### 11.1 React Profiler (composants front)

Mode dev :

```tsx
import { Profiler } from 'react';

<Profiler id="rituals-wall" onRender={(id, phase, actualDuration) => {
  if (actualDuration > 50) console.warn(`[profiler] ${id} ${phase} ${actualDuration}ms`);
}}>
  <RitualsWallDrawer />
</Profiler>
```

### 11.2 Vercel Analytics RUM

Web Vitals collectés automatiquement. Filtrer par route `/kit`. Comparer avant/après ajout du module.

### 11.3 k6 charge tests

`apps/web/k6/rituals-load.js` (cf. `↗ 15-performance-loading.md § 11.1`).

Lancer manuellement avant chaque release majeure :

```bash
k6 run apps/web/k6/rituals-load.js
```

## 12. Runbook incident « le wall ne charge plus »

```
0:00 — Constat : utilisateur reporte page bloquée sur /kit
0:01 — Vérifier Vercel Analytics : pic d'erreur 500 sur /api/rituals/list ?
0:02 — Sentry : nouvelle exception non fingerprintée ?
0:03 — Drizzle Studio : table ritual_testimonials accessible ? COUNT(*) raisonnable ?
0:05 — Si DB OK et Sentry vide : vérifier health endpoint /api/health/rituals
0:06 — Si health degraded : suivre l'indication
0:08 — Si rien d'évident : rollback déploiement précédent via Vercel
0:10 — Communiquer sur Slack #incidents
```

## 13. Synthèse — règles d'or observabilité

1. **Logs structurés JSON** pour toutes les routes API et services métier.
2. **Pas de PII dans les logs.**
3. **Sentry tagué `feature=rituals`** pour filtrer rapidement.
4. **Health endpoint /api/health/rituals** monitoré toutes les 5 min.
5. **Slack #incidents** câblé sur alertes Sentry et webhooks.
6. **Dashboard insights admin = tableau de bord ops** (SLA, taux d'erreur).
7. **Drizzle Studio + React Query Devtools** pour le diagnostic local.
8. **Runbook incident écrit** pour les 3 pannes les plus probables.
9. **Profilage régulier** via Profiler React + Vercel Analytics.
10. **Pas d'alerte sans seuil clair** (éviter le bruit qui désensibilise).
