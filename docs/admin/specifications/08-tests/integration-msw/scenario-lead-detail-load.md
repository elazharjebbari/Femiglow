# scenario-lead-detail-load

| Aspect | Valeur |
|---|---|
| Domaine | leads-detail |
| Composant | `LeadDetail` |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/components/admin/LeadDetail.integration.test.tsx` |
| Référence | F-LEADS-07 |

## Préconditions
- Utilisateur authentifié sur `/admin/leads/lead_001`.
- Le lead existe avec timeline et livraisons webhook attachées.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';
import { makeLead } from '@/test/msw/factories/lead';

export const handlers = [
  http.get('*/api/admin/leads/lead_001', () =>
    HttpResponse.json({
      ...makeLead({ id: 'lead_001', fullName: 'Leïla Bennani' }),
      events: [
        {
          id: 'evt_001',
          leadId: 'lead_001',
          type: 'created',
          actor: null,
          meta: { source: 'form:contact' },
          body: null,
          createdAt: '2026-05-03T14:32:00Z',
        },
        {
          id: 'evt_002',
          leadId: 'lead_001',
          type: 'note_added',
          actor: 'usr_admin',
          meta: {},
          body: 'Relancée par téléphone',
          createdAt: '2026-05-03T15:00:00Z',
        },
      ],
      deliveries: [
        {
          id: 'del_001',
          endpointId: 'wh_slack',
          eventName: 'lead.created',
          status: 'delivered',
          attempt: 1,
          maxAttempts: 8,
          scheduledAt: '2026-05-03T14:32:01Z',
          lastAttemptAt: '2026-05-03T14:32:02Z',
          nextAttemptAt: null,
          httpStatus: 200,
          durationMs: 142,
          responseBody: 'ok',
          idempotencyKey: 'idem_001',
          signature: 'sha256=abc',
          payload: {},
        },
      ],
    }),
  ),
];
```

## Action utilisateur

1. Charger la page `/admin/leads/lead_001`.
2. Attendre la fin du chargement (Suspense).

## Assertions

- L'identité du lead est rendue (nom, e-mail, téléphone, ville).
- La timeline affiche 2 événements ordonnés du plus récent au plus ancien.
- La section "Livraisons webhook" affiche 1 ligne avec `delivered` + `200`.
- Les actions principales sont visibles : changer statut, ajouter note, supprimer.
- Aucun toast d'erreur n'est rendu.

## Edge cases couverts ailleurs

- 404 lead → `e2e/lead-detail-404.spec.ts`
- Changement statut → `scenario-lead-status-change.md`
- Ajout note → `scenario-lead-note-add.md`

## Notes d'implémentation

```ts
import { render, screen } from '@testing-library/react';
import { LeadDetail } from './LeadDetail';

it('rend identité, timeline et livraisons', async () => {
  render(<LeadDetail leadId="lead_001" />);
  expect(await screen.findByRole('heading', { name: /leïla bennani/i })).toBeInTheDocument();
  expect(screen.getByText(/relancée par téléphone/i)).toBeInTheDocument();
  expect(screen.getByText(/delivered/i)).toBeInTheDocument();
});
```
