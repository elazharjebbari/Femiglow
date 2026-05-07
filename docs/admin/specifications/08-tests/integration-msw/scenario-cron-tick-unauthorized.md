# scenario-cron-tick-unauthorized

| Aspect | Valeur |
|---|---|
| Domaine | cron |
| Composant | `POST /api/cron/tick` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/webhooks/__tests__/cron-tick.integration.test.ts` |
| Référence | F-CRON-03 |

## Préconditions
- Le scheduler (ou attaquant) appelle la route sans bearer ou avec un bearer invalide.
- `CRON_SECRET` est défini côté serveur.

## Handlers MSW

```ts
// Aucun handler MSW nécessaire : la route est bloquée AVANT toute sortie HTTP.
export const handlers = [];
```

## Action utilisateur

1. Cas A : appel sans header `Authorization`.
2. Cas B : appel avec `Authorization: Bearer mauvais_secret`.
3. Cas C : appel avec un autre schéma (`Basic xxx`).

## Assertions

- Tous les cas renvoient `401` avec body `{ error: 'unauthorized' }`.
- Aucune requête SQL de sélection n'est exécutée (court-circuit early).
- Aucune requête sortante consommateur n'est émise.
- Aucun log de "stack trace" n'est émis (juste un warning d'audit).
- Le timing constant : pas de différence mesurable entre "secret manquant" et "secret invalide" (anti-timing-attack via `crypto.timingSafeEqual`).
- La table `audit_log` reçoit une entrée `cron.unauthorized`.

## Edge cases couverts ailleurs

- Batch autorisé → `scenario-cron-tick-batch.md`
- File vide autorisée → `scenario-cron-tick-empty.md`

## Notes d'implémentation

```ts
import { describe, it, expect } from 'vitest';

describe('cron tick non autorisé', () => {
  it.each([
    ['sans header', undefined],
    ['mauvais secret', 'Bearer wrong'],
    ['mauvais schéma', 'Basic xxx'],
  ])('renvoie 401 %s', async (_, header) => {
    const res = await fetch('http://localhost:3000/api/cron/tick', {
      method: 'POST',
      headers: header ? { Authorization: header } : {},
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
  });
});
```
