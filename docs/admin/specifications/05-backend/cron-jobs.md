# Jobs cron

V1 utilise **un seul cron** : le tick de dispatch des webhooks. Toute
autre tâche programmée (purges, agrégats) est listée comme évolution
post-v1.

## Configuration Vercel

`apps/web/vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/tick",
      "schedule": "* * * * *"
    }
  ]
}
```

| Aspect | Valeur |
|---|---|
| Fréquence | toutes les 60 secondes |
| Plan Vercel requis | Pro (Hobby plafonné à 1 cron/jour) |
| Timeout maximal | 60 secondes |
| Région d'exécution | unique (cdg1) |

## Authentification

Vercel Cron envoie le header :

```
Authorization: Bearer ${CRON_SECRET}
```

`CRON_SECRET` est une variable d'environnement à valeur aléatoire
≥ 32 caractères, gérée dans le dashboard Vercel.

```ts
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return formatError('unauthorized');
  }

  const { processed, failed, deadLettered } = await dispatchBatch();

  logger.info({
    event: 'cron.tick.completed',
    processed,
    failed,
    deadLettered,
  });

  return Response.json({ processed, failed, deadLettered });
}
```

## Idempotence

Le tick est naturellement idempotent : il consomme uniquement des
livraisons `pending` non encore prises (`FOR UPDATE SKIP LOCKED`).
Si Vercel relance accidentellement le même tick, aucune ligne n'est
traitée deux fois.

## Budget temps

- Ouverture connexion Postgres : < 100 ms (Neon serverless).
- Dispatch d'une livraison : 100 ms à 10 s (timeout HTTP).
- Batch size : 50 livraisons.
- Worst-case 50 × 10 s = 500 s ≫ 60 s : on **break** la boucle dès
  que le budget est dépassé. Les livraisons restantes seront prises
  au prochain tick.

```ts
const MAX_DURATION_MS = 50_000; // marge de 10s sous timeout Vercel
while (Date.now() - start < MAX_DURATION_MS) { … }
```

## Surveillance

Le résultat de chaque tick est :
1. Logué (JSON structuré) — niveau INFO.
2. Compté en métrique (Vercel Analytics).

Alerte si :
- `failed` ratio > 50 % sur 10 ticks consécutifs (probable incident
  côté consommateurs).
- `deadLettered` > 0 sur la dernière heure (cas anormal — chaque
  dead-letter doit être analysée).

Cf. [`../09-environnement/monitoring.md`](../09-environnement/monitoring.md).

## Test du cron en local

`apps/web/scripts/run-cron.ts` :

```ts
import { dispatchBatch } from '@/lib/webhooks/dispatch';

(async () => {
  const result = await dispatchBatch();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})();
```

Usage : `pnpm tsx scripts/run-cron.ts`.

## Évolutions post-v1

| Job | Fréquence | Objectif |
|---|---|---|
| `nightly-purge.ts` | quotidien 03:00 | suppression `admin_login_attempts > 24h` |
| `weekly-stats.ts` | dimanche 04:00 | matérialisation `webhook_endpoints_stats` |
| `monthly-archive.ts` | 1er du mois | archivage livraisons > 90j vers S3 cold |

## Tests

| Type | Fichier |
|---|---|
| Unit | `cron-tick.test.ts` (mocked dispatch) |
| MSW | `scenario-cron-tick-batch.md`, `scenario-cron-tick-empty.md`, `scenario-cron-tick-unauthorized.md` |
| E2E | `e2e/cron-flow.spec.ts` (insertion lead → simuler tick → delivery `delivered`) |
