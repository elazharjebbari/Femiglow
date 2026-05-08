# 07 — Refresh & orchestration

> *Cron, toggle, dernière MAJ, gestion d'erreurs, locks*

---

## 1. Stratégie

Refresh **récurrent**, pas temps réel. **Activable / désactivable**
côté admin. **Déclenchable manuellement**. **Idempotent**.

Trois déclencheurs :
1. **Cron Vercel** : `*/15 * * * *` par défaut, configurable.
2. **Manuel** : bouton dans `<InsightsRefreshIndicator>`.
3. **API** : POST `/api/admin/analytics/insights/refresh` (rare,
   utilisé par scripts ou tests).

## 2. Toggle ON/OFF

Stocké dans `tracking_settings` :

```jsonc
{
  "key": "insights.refresh_enabled",
  "value": true
}
{
  "key": "insights.refresh_interval_minutes",
  "value": 15
}
```

Quand `OFF` :
- Le cron Vercel s'exécute mais retourne 200 immédiatement avec
  `{ skipped: true, reason: 'disabled' }`.
- Le bouton "Manuel" reste actif (override admin).
- L'indicateur affiche "Refresh désactivé · Manuel uniquement".

## 3. Lock pessimiste

Mécanisme : ligne `insights_refresh_run` avec `status = 'running'`.

```sql
-- Acquérir le lock
INSERT INTO insights_refresh_run (id, trigger, status, started_at, triggered_by)
VALUES ($1, $2, 'running', NOW(), $3)
RETURNING id;

-- Vérifier qu'aucune autre run n'est active < 5 min
SELECT count(*) FROM insights_refresh_run
WHERE status = 'running'
  AND started_at > NOW() - INTERVAL '5 minutes'
  AND id != $1;
```

Si une autre run est active < 5 min, on supprime la nôtre et on
retourne 409 `refresh_in_progress`.

Au-delà de 5 min, le lock orphelin est écrasé (probablement crash
Vercel).

## 4. Pipeline d'agrégation

5 étapes, exécutées séquentiellement :

```
[start lock]
    ▼
1. refreshEventDaily()         — 30s max, 100k rows/30j
    ▼
2. refreshPageDaily()          — 5s max, 1.8k rows
    ▼
3. refreshComponentDaily()     — 20s max, 100k rows
    ▼
4. refreshSectionDaily()       — 8s max, 30k rows
    ▼
5. refreshFunnelDaily()        — 2s max, 30 rows
    ▼
[mark success + release lock]
```

Total cible : **< 30 secondes**.

### 4.1 Pattern incrémental

Chaque étape utilise le pattern :

```ts
async function refreshEventDaily(): Promise<number> {
  const lastBound = await db
    .select({ max: max(insightsEventDaily.refreshedAt) })
    .from(insightsEventDaily);
  const since = lastBound[0]?.max
    ? new Date(lastBound[0].max.getTime() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // backfill 90j initial

  const result = await db.execute(sql`
    INSERT INTO insights_event_daily
      (id, date, event_name, event_category, env, device, locale,
       count, unique_sessions, conversion_count)
    SELECT
      'iev_' || substr(md5(random()::text), 1, 14),
      date_trunc('day', received_at AT TIME ZONE 'Africa/Casablanca')::date,
      event_name,
      event_category,
      coalesce(env, 'unknown'),
      device,
      locale,
      count(*)::int,
      count(distinct session_id)::int,
      count(*) filter (where is_conversion)::int
    FROM tracking_events_log
    WHERE received_at >= ${since}
    GROUP BY 1, 2, 3, 4, 5, 6, 7
    ON CONFLICT (date, event_name, env, device, locale) DO UPDATE
      SET count = EXCLUDED.count,
          unique_sessions = EXCLUDED.unique_sessions,
          conversion_count = EXCLUDED.conversion_count,
          refreshed_at = NOW()
  `);

  return result.rowCount ?? 0;
}
```

### 4.2 Backfill initial

Au tout premier run (table vide), on remonte 90 jours en arrière.
Coût : ~ 60 secondes une fois.

## 5. État `<InsightsRefreshIndicator>`

```tsx
interface RefreshState {
  lastRun: {
    id: string;
    status: 'success' | 'failed' | 'running';
    startedAt: string;
    finishedAt?: string;
    counts?: Record<string, number>;
    durations?: Record<string, number>;
    errorMessage?: string;
  } | null;
  lockHeld: boolean;
  enabled: boolean;
  intervalMinutes: number;
}
```

Affichage :

```
┌──── Refresh status ─────────────────────────────────────────┐
│                                                              │
│ ✓ Dernière mise à jour : il y a 7 min                       │
│   Auto activé · toutes les 15 min                            │
│                                                              │
│ [Refresh maintenant] [Désactiver auto]                       │
└──────────────────────────────────────────────────────────────┘
```

Variantes :
- `running` → spinner discret + "Calcul en cours…"
- `failed` → bannière rouge + détails repliables + "Réessayer"
- `disabled` → "Refresh désactivé · Manuel uniquement"
- `firstRun` → "Premier calcul en cours, reviens dans qq min"

## 6. Cron Vercel

`vercel.json` (extrait) :

```jsonc
{
  "crons": [
    {
      "path": "/api/admin/analytics/insights/refresh",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/insights-purge",
      "schedule": "30 3 1 * *"
    }
  ]
}
```

Auth : `Bearer ${env.CRON_SECRET}`.

## 7. Gestion d'erreurs

| Cas                                              | Comportement                                                |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `refresh_in_progress` (409)                      | Retourner immédiatement, log info                           |
| Erreur SQL sur étape 3                           | `mark failed`, status 500, audit log avec stack trace          |
| Timeout Vercel (60s max)                         | Vercel kill, lock orphelin écrasé au prochain cron          |
| Toggle OFF                                       | Skip immédiatement avec `{ skipped: true }`                  |
| Bearer absent                                    | 401                                                          |
| Bearer invalide                                  | 403                                                          |

## 8. Audit log

Chaque run produit une entrée audit :

```ts
await auditTrackingChange({
  action: 'sync',
  resource: 'tracking_inventory',
  actorId: opts.actorId ?? null,
  meta: {
    domain: 'insights',
    runId,
    trigger: opts.trigger,
    status: 'success' | 'failed',
    durations,
    counts,
    error: errMessage ?? null,
  },
});
```

## 9. Settings admin

```
GET /api/admin/analytics/insights/settings
→ { enabled: true, intervalMinutes: 15, lastRun: {...} }

PATCH /api/admin/analytics/insights/settings
{ "enabled": false } | { "intervalMinutes": 30 }
→ 200 OK
```

Validation Zod stricte. `intervalMinutes` ∈ {5, 10, 15, 30, 60}.

## 10. Performance

| Étape                    | Cible p95 | Lignes affectées |
| ------------------------ | --------- | ---------------- |
| `refreshEventDaily`      | 8 s       | 50k              |
| `refreshPageDaily`       | 1 s       | 1.8k             |
| `refreshComponentDaily`  | 12 s      | 100k             |
| `refreshSectionDaily`    | 3 s       | 30k              |
| `refreshFunnelDaily`     | 0.5 s     | 30               |
| **Total**                | **< 30 s** |                  |

## 11. Robustesse

- **Idempotence** : `INSERT … ON CONFLICT DO UPDATE` → safe à re-run
- **Atomicity** : pas de transaction globale (chaque étape commit
  séparément, pour isoler les échecs)
- **Reprise** : si une étape rate, les précédentes sont conservées,
  l'admin peut relancer
- **Observabilité** : durations + counts persistés par run
- **Pas de SPOF** : si le cron casse, le bouton manuel reste actif

## 12. Lecture suivante

- [02 — Couche data](02-data.md) pour les schémas SQL exacts.
- [03 — Backend](03-backend.md) pour les services qui consomment.
- [09 — Tests](09-tests.md) pour les scénarios de test refresh.
