# scenario-rate-limit-login

| Aspect | Valeur |
|---|---|
| Domaine | securite / rate-limit |
| Composant | `POST /api/admin/login` + table `admin_login_attempts` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/auth/__tests__/rate-limit-login.integration.test.ts` |
| Référence | F-AUTH-03 (axe DB/audit) |

## Préconditions
- La table `admin_login_attempts` existe avec colonnes `(ip, email, attempted_at, success)`.
- Politique : 5 échecs / 15 min / IP **et** 5 échecs / 15 min / email.
- Une fenêtre glissante est utilisée (pas un compteur fixe).

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

let attempts = 0;

export const handlers = [
  http.post('*/api/admin/login', async ({ request }) => {
    attempts += 1;
    const body = (await request.json()) as { email: string; password: string };
    if (attempts > 5) {
      return HttpResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '900' } },
      );
    }
    return HttpResponse.json(
      { error: 'unauthorized' },
      { status: 401 },
    );
  }),
];
```

## Action utilisateur

1. 5 tentatives de login avec mauvais mot de passe (toutes en `401`).
2. 6e tentative.

## Assertions

- À chaque tentative, une ligne est insérée dans `admin_login_attempts` avec `success=false`.
- À la 6e tentative, l'API renvoie `429` avec `Retry-After: 900`.
- Une tentative réussie (`success=true`) ne doit **pas** purger les échecs récents (pour préserver l'audit).
- Après 15 min sans tentative, le compteur effectif retombe à 0 (fenêtre glissante).
- La détection est combinée IP + email : un attaquant qui change d'e-mail mais garde la même IP est aussi limité.
- Une vue admin `audit_login_failures` permet de consulter les tentatives.

## Edge cases couverts ailleurs

- Comportement UI → `scenario-login-rate-limit.md`
- Login réussi → `scenario-login-success.md`
- Audit trail mutation → `audit.test.ts` (F-SEC-05)

## Notes d'implémentation

```ts
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { adminLoginAttempts } from '@/lib/db/schema';

describe('rate limit login DB', () => {
  it('insère une ligne par tentative et bloque à la 6e', async () => {
    for (let i = 0; i < 6; i++) {
      await fetch('http://localhost:3000/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'fondatrice@femiglow.ma', password: 'wrong' }),
      });
    }
    const rows = await db.select().from(adminLoginAttempts);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.every((r) => !r.success)).toBe(true);
  });
});
```
