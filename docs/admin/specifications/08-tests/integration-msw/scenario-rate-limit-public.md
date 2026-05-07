# scenario-rate-limit-public

| Aspect | Valeur |
|---|---|
| Domaine | securite / rate-limit |
| Composant | `POST /api/public/*` + table `public_form_submissions` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/public/__tests__/rate-limit-public.integration.test.ts` |
| Référence | F-PUB-05 (axe DB/stats) |

## Préconditions
- Une table `public_form_submissions` (ou compteur Redis) trace les soumissions.
- Politique : 10 req / heure / IP, par route publique.
- Les soumissions sont conservées pour audit même au-delà du rate limit.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

let count = 0;

export const handlers = [
  http.post('*/api/public/contact', async () => {
    count += 1;
    if (count > 10) {
      return HttpResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '1800' } },
      );
    }
    return HttpResponse.json(
      { ok: true, leadId: `lead_${count}` },
      { status: 201 },
    );
  }),
];
```

## Action utilisateur

1. Émettre 10 soumissions valides depuis la même IP.
2. Émettre une 11e soumission.

## Assertions

- Les 10 premières soumissions renvoient `201` et insèrent un lead.
- La 11e renvoie `429`.
- La table `public_form_submissions` a 11 lignes (la 11e est conservée même rejetée, pour audit).
- Le compteur DB permet d'afficher dans `/admin/security` :
  - top 5 IPs avec soumissions sur les dernières 24 h,
  - nombre de blocs `429` par jour.
- La fenêtre est glissante : après 1 h sans soumission, l'IP retrouve son quota.
- Le rate limit est par route : `/api/public/contact` n'impacte pas `/api/public/newsletter`.

## Edge cases couverts ailleurs

- Comportement UI sur 429 → `scenario-public-rate-limit.md`
- Sans consent → `scenario-public-no-consent.md`
- Rate limit login → `scenario-rate-limit-login.md`

## Notes d'implémentation

```ts
import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { publicFormSubmissions } from '@/lib/db/schema';

describe('rate limit public DB', () => {
  it('trace les 11 tentatives et bloque la 11e', async () => {
    for (let i = 0; i < 11; i++) {
      await fetch('http://localhost:3000/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'X',
          email: `x${i}@example.ma`,
          message: 'm',
          consentAt: new Date().toISOString(),
        }),
      });
    }
    const rows = await db.select().from(publicFormSubmissions);
    expect(rows.length).toBe(11);
  });
});
```
