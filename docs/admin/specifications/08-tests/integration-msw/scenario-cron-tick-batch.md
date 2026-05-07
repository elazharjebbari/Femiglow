# scenario-cron-tick-batch

| Aspect | Valeur |
|---|---|
| Domaine | cron |
| Composant | `POST /api/cron/tick` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/webhooks/__tests__/cron-tick.integration.test.ts` |
| Référence | F-CRON-01 |

## Préconditions
- 50 livraisons `pending` avec `next_attempt_at <= NOW()`.
- Authentification : header `Authorization: Bearer ${CRON_SECRET}`.
- Le consommateur externe est mocké : tous renvoient `200`.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

let dispatched = 0;

export const handlers = [
  http.post('https://hooks.slack.com/services/T0/B0/XXXX', () => {
    dispatched += 1;
    return HttpResponse.json({ ok: true });
  }),
  // Le tick interne est appelé via la route Next.js, pas via MSW.
  // MSW intercepte uniquement les sorties consommateurs.
];
```

## Action utilisateur

1. Le scheduler Vercel Cron déclenche `POST /api/cron/tick` avec le bearer.
2. La route lit ≤ 50 livraisons `pending` éligibles.
3. Chaque livraison est dispatch en parallèle (concurrence limitée à 10).
4. Toutes réussissent (`200`).

## Assertions

- La réponse renvoie `{ processed: 50, failed: 0, deadLettered: 0 }`.
- 50 requêtes sortantes ont été émises vers le consommateur (compteur `dispatched`).
- Le batch respecte la limite : exactement 50, pas 51 ni 49.
- Les 50 livraisons ont `status = 'delivered'` après le tick.
- La concurrence est plafonnée à 10 (vérifiable via timing si nécessaire).
- Le tick complète en moins de 30 s (timeout Vercel = 60 s).

## Edge cases couverts ailleurs

- File vide → `scenario-cron-tick-empty.md`
- Sans bearer → `scenario-cron-tick-unauthorized.md`
- Échec individuel → `scenario-delivery-5xx.md`

## Notes d'implémentation

```ts
import { describe, it, expect } from 'vitest';

describe('cron tick batch', () => {
  it('traite 50 livraisons et renvoie le compteur', async () => {
    const res = await fetch('http://localhost:3000/api/cron/tick', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(50);
    expect(body.failed).toBe(0);
  });
});
```
