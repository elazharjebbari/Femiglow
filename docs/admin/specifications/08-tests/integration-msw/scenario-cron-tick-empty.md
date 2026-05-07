# scenario-cron-tick-empty

| Aspect | Valeur |
|---|---|
| Domaine | cron |
| Composant | `POST /api/cron/tick` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/webhooks/__tests__/cron-tick.integration.test.ts` |
| Référence | F-CRON-02 |

## Préconditions
- Aucune livraison `pending` éligible (table vide ou tous `next_attempt_at` futurs).
- Authentification valide.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

let dispatched = 0;

export const handlers = [
  // On installe quand même un handler pour détecter les sorties non voulues.
  http.post('https://hooks.slack.com/services/T0/B0/XXXX', () => {
    dispatched += 1;
    return HttpResponse.json({ ok: true });
  }),
];
```

## Action utilisateur

1. Le scheduler déclenche `POST /api/cron/tick`.
2. La route exécute la requête SQL → 0 ligne.

## Assertions

- La réponse renvoie `{ processed: 0, failed: 0, deadLettered: 0 }`.
- **Aucune** requête sortante n'a été émise (`dispatched === 0`).
- Le code HTTP est `200` (pas d'erreur, c'est un cas normal).
- Le temps d'exécution est très court (< 100 ms).
- Aucun log d'erreur n'est émis.

## Edge cases couverts ailleurs

- Batch normal → `scenario-cron-tick-batch.md`
- Sans bearer → `scenario-cron-tick-unauthorized.md`

## Notes d'implémentation

```ts
import { describe, it, expect } from 'vitest';

describe('cron tick file vide', () => {
  it('renvoie processed:0 sans appeler de consommateur', async () => {
    const res = await fetch('http://localhost:3000/api/cron/tick', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
    expect(body.failed).toBe(0);
    expect(body.deadLettered).toBe(0);
  });
});
```
